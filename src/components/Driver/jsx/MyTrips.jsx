import React, { useState, useEffect } from 'react';
import { ArrowLeft, Car, Bike, MapPin, Calendar, Clock, Users, X, Filter, Key, Bell } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { isTripToday, canStartJourney, formatDate, formatTime } from '../../../utils/dateHelper';
import { generateAndSaveOTP } from '../../../utils/otpHelper';
import '../css/MyTrips.css';

const MyTrips = ({ onBack, onRideStart }) => {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [bookingCounts, setBookingCounts] = useState({});
    const [newBookingAlert, setNewBookingAlert] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);

    useEffect(() => {
        const initialize = async () => {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                console.log('[MyTrips] Current driver ID:', user.id);
            }
            
            // Fetch initial trips
            fetchTrips();
        };

        initialize();

        // Setup real-time subscriptions
        const subscriptions = setupRealtimeSubscriptions();

        // Cleanup subscriptions on unmount
        return () => {
            console.log('[MyTrips] Cleaning up subscriptions');
            if (subscriptions?.tripsChannel) {
                supabase.removeChannel(subscriptions.tripsChannel);
            }
            if (subscriptions?.bookingsChannel) {
                supabase.removeChannel(subscriptions.bookingsChannel);
            }
            if (subscriptions?.broadcastChannel) {
                supabase.removeChannel(subscriptions.broadcastChannel);
            }
        };
    }, []);

    const setupRealtimeSubscriptions = () => {
        const user = supabase.auth.getUser();
        
        // 1. PostgreSQL changes subscription for trips
        const tripsChannel = supabase
            .channel('my_trips_updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'trips',
                filter: `user_id=eq.${currentUserId}`,
            }, (payload) => {
                console.log('[MyTrips] Trip update received:', payload.event);
                fetchTrips();
            })
            .subscribe((status) => {
                console.log('[MyTrips] Trips subscription status:', status);
            });

        // 2. PostgreSQL changes for booking_requests
        const bookingsChannel = supabase
            .channel('my_trips_bookings')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'booking_requests',
            }, (payload) => {
                console.log('[MyTrips] Booking update received:', payload.event);
                fetchTrips(); // Refresh to update booking counts
            })
            .subscribe((status) => {
                console.log('[MyTrips] Bookings subscription status:', status);
            });

        // 3. NEW: Real-time broadcast for Edge Function notifications
        const broadcastChannel = supabase.channel(`driver_${currentUserId}_trips`, {
            config: {
                broadcast: { self: false }
            }
        });

        broadcastChannel
            .on('broadcast', { event: 'new_booking' }, (payload) => {
                console.log('[MyTrips] 🚨 NEW BOOKING NOTIFICATION:', payload);
                
                // Show notification even when on MyTrips page
                if (payload.payload && payload.payload.passenger_name) {
                    toast.success(
                        `New booking request from ${payload.payload.passenger_name}!`,
                        {
                            duration: 5000,
                            position: 'top-right',
                            icon: '🚗',
                            style: {
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                fontWeight: 'bold'
                            }
                        }
                    );

                    // Set alert for visual feedback
                    setNewBookingAlert({
                        trip_id: payload.payload.trip_id,
                        passenger: payload.payload.passenger_name || 'New Passenger',
                        time: new Date().toLocaleTimeString()
                    });

                    // Clear alert after 3 seconds
                    setTimeout(() => {
                        setNewBookingAlert(null);
                    }, 3000);

                    // Refresh trips to update booking counts
                    fetchTrips();
                }
            })
            .on('system', { event: 'join' }, () => {
                console.log('[MyTrips] Joined broadcast channel successfully');
            })
            .subscribe((status) => {
                console.log('[MyTrips] Broadcast subscription status:', status);
            });

        return { tripsChannel, bookingsChannel, broadcastChannel };
    };

    const fetchTrips = async () => {
        try {
            setLoading(true);
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError) throw authError;

            if (user) {
                console.log('[MyTrips] Fetching trips for driver:', user.id);
                const { data, error } = await supabase
                    .from('trips')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('travel_date', { ascending: false });

                if (error) throw error;
                console.log('[MyTrips] Trips fetched:', data?.length || 0);

                if (data && data.length > 0) {
                    // Fetch booking counts for all trips efficiently in one go
                    const tripIds = data.map(t => t.id);
                    const { data: countsData, error: countsError } = await supabase
                        .from('booking_requests')
                        .select('trip_id')
                        .in('trip_id', tripIds)
                        .eq('status', 'approved');

                    if (countsError) {
                        console.error('[MyTrips] Error fetching booking counts:', countsError);
                    }

                    const counts = {};
                    tripIds.forEach(id => counts[id] = 0);

                    if (countsData) {
                        countsData.forEach(row => {
                            counts[row.trip_id] = (counts[row.trip_id] || 0) + 1;
                        });
                    }

                    setBookingCounts(counts);
                } else {
                    setBookingCounts({});
                }
                setTrips(data || []);
            } else {
                console.warn('[MyTrips] No active session found');
                toast.error('Session expired. Please login again.');
            }
        } catch (error) {
            console.error('[MyTrips] Error fetching trips:', error);
            toast.error(error.message || 'Failed to load trips');
        } finally {
            setLoading(false);
        }
    };

    const updateTripStatus = async (tripId, newStatus) => {
        try {
            // If starting journey, check if it's allowed
            if (newStatus === 'in_progress') {
                const trip = trips.find(t => t.id === tripId);
                if (trip && !canStartJourney(trip.travel_date, trip.travel_time)) {
                    toast.error('Journey can only be started 30 minutes before scheduled time');
                    return;
                }

                // Generate OTP
                const otp = await generateAndSaveOTP(tripId);
                toast.success(`Journey Started! OTP: ${otp}`);
            }

            const { error } = await supabase
                .from('trips')
                .update({ status: newStatus })
                .eq('id', tripId);

            if (error) throw error;

            setTrips(prev => prev.map(t =>
                t.id === tripId ? { ...t, status: newStatus } : t
            ));

            if (newStatus === 'completed') {
                toast.success('Journey Completed! Wallet updated.');
            }

            if (newStatus === 'in_progress' && onRideStart) {
                const trip = trips.find(t => t.id === tripId);
                if (trip) onRideStart({ ...trip, status: 'in_progress' });
            }
        } catch (error) {
            console.error(`[MyTrips] Error updating trip to ${newStatus}:`, error);
            toast.error('Failed to update trip status');
        }
    };

    const handleCancelTrip = async () => {
        if (!selectedTrip) return;

        try {
            const { error } = await supabase
                .from('trips')
                .update({ status: 'cancelled' })
                .eq('id', selectedTrip.id);

            if (error) throw error;

            setTrips(prev => prev.map(t =>
                t.id === selectedTrip.id ? { ...t, status: 'cancelled' } : t
            ));

            toast.success('Trip cancelled successfully');
            setShowCancelModal(false);
            setSelectedTrip(null);
        } catch (error) {
            console.error('[MyTrips] Error cancelling trip:', error);
            toast.error('Failed to cancel trip');
        }
    };

    const filteredTrips = trips.filter(trip => {
        if (filter === 'all') return true;
        return trip.status === filter;
    });

    return (
        <div className="my-trips-container animate-page-in">
            {/* Header */}
            <div className="my-trips-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <div className="header-title-section">
                    <h1>My Trips</h1>
                    {newBookingAlert && (
                        <div className="new-booking-alert">
                            <Bell size={16} />
                            <span>New request for Trip ID: {newBookingAlert.trip_id?.substring(0, 8)}...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Real-time status indicator */}
            <div className="realtime-status">
                <div className="status-dot active"></div>
                <span>Listening for booking requests</span>
            </div>

            {/* Filter Tabs */}
            <div className="trip-filters">
                <button
                    className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All
                </button>
                <button
                    className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
                    onClick={() => setFilter('active')}
                >
                    Active
                </button>
                <button
                    className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
                    onClick={() => setFilter('completed')}
                >
                    Completed
                </button>
                <button
                    className={`filter-tab ${filter === 'cancelled' ? 'active' : ''}`}
                    onClick={() => setFilter('cancelled')}
                >
                    Cancelled
                </button>
            </div>

            {/* Trips List */}
            <div className="trips-content">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading trips...</p>
                    </div>
                ) : filteredTrips.length === 0 ? (
                    <div className="empty-state">
                        <Car size={48} />
                        <h3>No trips found</h3>
                        <p>
                            {filter === 'all'
                                ? "You haven't published any trips yet"
                                : `No ${filter} trips`}
                        </p>
                        <p className="realtime-hint">
                            <Bell size={14} />
                            Create a trip to start receiving booking requests
                        </p>
                    </div>
                ) : (
                    <div className="trips-list">
                        {filteredTrips.map(trip => {
                            const passengerCount = bookingCounts[trip.id] || 0;
                            const isTodayTrip = isTripToday(trip.travel_date);
                            const canStart = canStartJourney(trip.travel_date, trip.travel_time);

                            return (
                                <div key={trip.id} className="trip-card">
                                    <div className="trip-card-header">
                                        <div className="left-meta">
                                            <div className="vehicle-badge">
                                                {trip.vehicle_type === 'car' ? <Car size={14} /> : <Bike size={14} />}
                                                <span>{trip.vehicle_type}</span>
                                            </div>
                                            <div className="trip-time-meta">
                                                <Calendar size={14} />
                                                <span>{formatDate(trip.travel_date, 'medium')}</span>
                                                <span className="dot">•</span>
                                                <Clock size={14} />
                                                <span>{formatTime(trip.travel_time)}</span>
                                            </div>
                                        </div>
                                        <div className={`status-badge ${trip.status}`}>
                                            {trip.status.replace('_', ' ')}
                                        </div>
                                    </div>

                                    <div className="trip-card-body">
                                        <div className="vertical-route">
                                            <div className="route-point from">
                                                <div className="point-icon origin"></div>
                                                <span className="location-name">{trip.from_location}</span>
                                            </div>
                                            <div className="route-connector"></div>
                                            <div className="route-point to">
                                                <div className="point-icon destination"></div>
                                                <span className="location-name">{trip.to_location}</span>
                                            </div>
                                        </div>

                                        <div className="trip-incentives">
                                            {trip.status === 'active' && passengerCount === 0 && (
                                                <div className="incentive-badge waiting">
                                                    <Users size={14} />
                                                    <span>Waiting for passengers</span>
                                                </div>
                                            )}
                                            {trip.status === 'active' && passengerCount > 0 && (
                                                <div className="incentive-badge confirmed">
                                                    <Users size={14} />
                                                    <span>{passengerCount} Confirmed</span>
                                                </div>
                                            )}
                                            {isTodayTrip && trip.status === 'active' && (
                                                <div className="incentive-badge today">
                                                    <Key size={14} />
                                                    <span>Trip is Today</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="trip-card-footer">
                                        <div className="footer-info">
                                            <div className="seats-info">
                                                <Users size={16} />
                                                <span>{trip.available_seats} seats avail.</span>
                                            </div>
                                            {trip.price_per_seat && (
                                                <div className="price-tag">
                                                    <span>₹{trip.price_per_seat}</span>
                                                    <small>/seat</small>
                                                </div>
                                            )}
                                        </div>

                                        <div className="action-buttons">
                                            {trip.status === 'active' && (
                                                <>
                                                    <button
                                                        className={`primary-action-btn start ${!canStart ? 'disabled' : ''}`}
                                                        onClick={() => canStart && updateTripStatus(trip.id, 'in_progress')}
                                                        disabled={!canStart}
                                                    >
                                                        {canStart ? 'START TRIP' : 'Starts ' + formatTime(trip.travel_time)}
                                                    </button>
                                                    <button
                                                        className="secondary-action-btn cancel"
                                                        onClick={() => {
                                                            setSelectedTrip(trip);
                                                            setShowCancelModal(true);
                                                        }}
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </>
                                            )}

                                            {trip.status === 'in_progress' && (
                                                <>
                                                    <button
                                                        className="primary-action-btn resume"
                                                        onClick={() => onRideStart && onRideStart(trip)}
                                                    >
                                                        RESUME MAP
                                                    </button>
                                                    <button
                                                        className="secondary-action-btn finish"
                                                        onClick={() => updateTripStatus(trip.id, 'completed')}
                                                    >
                                                        FINISH
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {/* Booking request count */}
                                        {trip.status === 'active' && passengerCount > 0 && (
                                            <div className="booking-notification">
                                                <Bell size={12} />
                                                <span>{passengerCount} confirmed booking{passengerCount > 1 ? 's' : ''}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Cancel Modal */}
            {showCancelModal && (
                <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowCancelModal(false)}>
                            <X size={24} />
                        </button>
                        <div className="modal-icon warning">
                            <X size={32} />
                        </div>
                        <h2>Cancel Trip?</h2>
                        <p>Are you sure you want to cancel this trip? This action cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowCancelModal(false)}>
                                Keep Trip
                            </button>
                            <button className="btn-danger" onClick={handleCancelTrip}>
                                Cancel Trip
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyTrips;