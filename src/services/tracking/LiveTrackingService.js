import { supabase } from '../../supabaseClient';

/**
 * LiveTrackingService — Singleton for driver location broadcast
 * 
 * Driver: watchPosition → broadcast every 3s via Supabase Realtime → throttled DB write every 30s
 * Passenger: subscribe to broadcast channel, receive driver_location events
 * 
 * Uses Supabase Realtime broadcast (no DB writes for real-time updates)
 * Only writes to DB every 30s for persistence/recovery
 */
class LiveTrackingService {
    constructor() {
        this.watchId = null;
        this.currentLocation = null;
        this.tripId = null;
        this.broadcastChannel = null;
        this.lastDbUpdate = 0;
        this.DB_UPDATE_INTERVAL = 30000; // 30 seconds — persist to DB
        this.BROADCAST_INTERVAL = 3000;  // 3 seconds — real-time updates
        this.broadcastTimer = null;
        this.isTracking = false;
    }

    /**
     * Start tracking for a trip
     * @param {string} tripId 
     * @param {function} onLocationUpdate - callback(location)
     * @param {'driver'|'passenger'} role
     */
    async startTracking(tripId, onLocationUpdate, role = 'driver') {
        // Prevent double-start
        if (this.isTracking && this.tripId === tripId) {
            console.log('[LiveTracking] Already tracking this trip');
            return;
        }

        // Clean up any previous tracking
        this.stopTracking();

        this.tripId = tripId;
        this.isTracking = true;

        console.log(`[LiveTracking] Starting ${role} tracking for trip ${tripId}`);

        // Set up broadcast channel
        this.broadcastChannel = supabase.channel(`ride_tracking_${tripId}`, {
            config: { broadcast: { self: false } }
        });

        if (role === 'passenger') {
            // Passenger just listens for driver location
            this.broadcastChannel
                .on('broadcast', { event: 'driver_location' }, ({ payload }) => {
                    this.currentLocation = payload;
                    onLocationUpdate?.(payload);
                })
                .subscribe((status) => {
                    console.log(`[LiveTracking] Passenger subscription: ${status}`);
                });
            return;
        }

        // === Driver mode ===
        this.broadcastChannel.subscribe((status) => {
            console.log(`[LiveTracking] Driver subscription: ${status}`);
        });

        if (!navigator.geolocation) {
            console.error('[LiveTracking] Geolocation not supported');
            this.isTracking = false;
            return;
        }

        // Start watching position
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                    accuracy: position.coords.accuracy,
                    timestamp: Date.now()
                };

                this.currentLocation = location;

                // Callback for local UI
                onLocationUpdate?.(location);

                // Throttle DB updates
                this._throttledDbUpdate();
            },
            (error) => {
                console.error('[LiveTracking] Geolocation error:', error.message);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 2000,
                timeout: 5000
            }
        );

        // Start periodic broadcast timer
        this._startBroadcastTimer();
    }

    /**
     * Broadcast current location to all passengers via Realtime
     */
    _broadcastLocation() {
        if (!this.broadcastChannel || !this.currentLocation) return;

        this.broadcastChannel.send({
            type: 'broadcast',
            event: 'driver_location',
            payload: this.currentLocation
        }).catch(err => {
            console.error('[LiveTracking] Broadcast error:', err);
        });
    }

    /**
     * Broadcast every BROADCAST_INTERVAL ms
     */
    _startBroadcastTimer() {
        if (this.broadcastTimer) clearInterval(this.broadcastTimer);

        this.broadcastTimer = setInterval(() => {
            this._broadcastLocation();
        }, this.BROADCAST_INTERVAL);
    }

    /**
     * Write to DB at most every DB_UPDATE_INTERVAL ms
     */
    async _throttledDbUpdate() {
        const now = Date.now();
        if (now - this.lastDbUpdate < this.DB_UPDATE_INTERVAL) return;

        if (!this.currentLocation || !this.tripId) return;

        try {
            await supabase
                .from('trips')
                .update({
                    driver_lat: this.currentLocation.lat,
                    driver_lng: this.currentLocation.lng,
                    last_location_update: new Date().toISOString()
                })
                .eq('id', this.tripId);

            this.lastDbUpdate = now;
            console.log('[LiveTracking] DB location updated');
        } catch (error) {
            console.error('[LiveTracking] DB update error:', error);
        }
    }

    /**
     * Get current location
     */
    getLocation() {
        return this.currentLocation;
    }

    /**
     * Check if tracking is active
     */
    isActive() {
        return this.isTracking;
    }

    /**
     * Stop all tracking and clean up
     */
    stopTracking() {
        console.log('[LiveTracking] Stopping tracking');

        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        if (this.broadcastTimer) {
            clearInterval(this.broadcastTimer);
            this.broadcastTimer = null;
        }

        if (this.broadcastChannel) {
            supabase.removeChannel(this.broadcastChannel);
            this.broadcastChannel = null;
        }

        this.currentLocation = null;
        this.tripId = null;
        this.isTracking = false;
        this.lastDbUpdate = 0;
    }
}

// Singleton export
export const liveTrackingService = new LiveTrackingService();
