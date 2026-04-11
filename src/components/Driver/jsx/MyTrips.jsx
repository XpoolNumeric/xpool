import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Car, Bike, Calendar, Clock, Users, X, Key, Bell, CheckCircle, AlertCircle, MapPin, Navigation } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { isTripToday, isTripPast, formatDate, formatTime, getTimeUntilTrip } from '../../../utils/dateHelper';
import '../css/MyTrips.css';

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

const TripSkeleton = () => (
    <div className="trip-card skeleton-pulse" style={{ opacity: 0.7 }}>
        <div className="trip-card-header">
            <div className="left-meta">
                <div className="skeleton-box" style={{ width: 80, height: 24, borderRadius: 8, background: '#e5e7eb' }}></div>
                <div className="skeleton-box" style={{ width: 140, height: 16, borderRadius: 4, background: '#e5e7eb' }}></div>
            </div>
            <div className="skeleton-box" style={{ width: 70, height: 24, borderRadius: 10, background: '#e5e7eb' }}></div>
        </div>
        <div className="trip-card-body" style={{ borderColor: 'transparent', background: '#f9fafb' }}>
            <div className="vertical-route">
                <div className="skeleton-box" style={{ marginLeft: 30, width: '80%', height: 18, borderRadius: 4, background: '#e5e7eb', marginBottom: 20 }}></div>
                <div className="skeleton-box" style={{ marginLeft: 30, width: '60%', height: 18, borderRadius: 4, background: '#e5e7eb' }}></div>
            </div>
        </div>
        <div className="trip-card-footer">
            <div className="skeleton-box" style={{ width: '100%', height: 52, borderRadius: 16, background: '#e5e7eb' }}></div>
        </div>
    </div>
);

const TripCard = ({ trip, passengerCount, isStarting, insights, onUpdateStatus, onCancelRequest, onRideStart }) => {
    const isToday = isTripToday(trip.travel_date);
    const timeUntilTrip = getTimeUntilTrip(trip.travel_date);

    return (
        <div className="trip-card">
            <div className="trip-card-header">
                <div className="left-meta">
                    <div className="vehicle-badge">
                        {trip.vehicle_type === 'car' ? <Car size={14} /> : <Bike size={14} />}
                        <span>{trip.vehicle_type}</span>
                    </div>
                    <div className="trip-time-meta">
                        <Calendar size={13} />
                        <span>{formatDate(trip.travel_date, 'medium')}</span>
                        <span className="dot">•</span>
                        <Clock size={13} />
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
                    {trip.status === 'expired' && (
                        <div className="incentive-badge expired">
                            <AlertCircle size={13} />
                            <span>Trip Expired — No passengers booked</span>
                        </div>
                    )}
                    {trip.status === 'active' && passengerCount === 0 && (
                        <div className="incentive-badge waiting">
                            <Users size={13} />
                            <span>Waiting for passengers</span>
                        </div>
                    )}
                    {['active', 'full'].includes(trip.status) && passengerCount > 0 && (
                        <div className="incentive-badge confirmed">
                            <CheckCircle size={13} />
                            <span>{passengerCount} Confirmed</span>
                        </div>
                    )}
                    {isToday && ['active', 'full'].includes(trip.status) && (
                        <div className="incentive-badge today">
                            <Key size={13} />
                            <span>Available Today!</span>
                        </div>
                    )}
                </div>

                {insights && (
                    <div className="passenger-insights">
                        <div className="insight-item verified">
                            <CheckCircle size={13} />
                            <span>{insights.passengers.verified} verified</span>
                        </div>
                        {insights.passengers.pending > 0 && (
                            <div className="insight-item pending">
                                <AlertCircle size={13} />
                                <span>{insights.passengers.pending} pending OTP</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="trip-card-footer">
                <div className="footer-info">
                    <div className="seats-info">
                        <Users size={15} />
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
                    {['active', 'full'].includes(trip.status) && (
                        <>
                            <button
                                className={`primary-action-btn start ${!isToday ? 'disabled' : ''}`}
                                onClick={() => isToday && !isStarting && onUpdateStatus(trip.id, 'in_progress')}
                                disabled={!isToday || isStarting}
                            >
                                {isStarting ? (
                                    <span className="loading-spinner-small"></span>
                                ) : isToday ? (
                                    <><Navigation size={16} style={{ marginRight: 6 }} /> START TRIP</>
                                ) : (
                                    timeUntilTrip
                                )}
                            </button>
                            <button
                                className="secondary-action-btn cancel"
                                onClick={() => onCancelRequest(trip)}
                                aria-label="Cancel trip"
                            >
                                <X size={20} />
                            </button>
                        </>
                    )}

                    {trip.status === 'in_progress' && (
                        <>
                            <button
                                className="primary-action-btn resume"
                                onClick={() => onRideStart && onRideStart(trip)}
                            >
                                <Navigation size={16} style={{ marginRight: 6 }} /> RESUME MAP
                            </button>
                            <button
                                className="secondary-action-btn finish"
                                onClick={() => onUpdateStatus(trip.id, 'completed')}
                                aria-label="Finish trip"
                            >
                                <CheckCircle size={22} />
                            </button>
                        </>
                    )}
                </div>

                {['active', 'full'].includes(trip.status) && passengerCount > 0 && (
                    <div className="booking-notification">
                        <Bell size={13} />
                        <span>{passengerCount} confirmed booking{passengerCount > 1 ? 's' : ''}</span>
                    </div>
                )}
            </div>
        </div>
    );
};


// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

const MyTrips = ({ onBack, onRideStart }) => {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [bookingCounts, setBookingCounts] = useState({});
    const [newBookingAlert, setNewBookingAlert] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [startingTripId, setStartingTripId] = useState(null);
    const [tripInsights, setTripInsights] = useState({});

    useEffect(() => {
        let mounted = true;

        const initialize = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && mounted) {
                setCurrentUserId(user.id);
                fetchTrips(user.id);
            }
        };

        initialize();

        return () => {
            mounted = false;
        };
    }, []);

    // Separated realtime setup safely avoiding multiple unneeded hooks inside fetch
    useEffect(() => {
        if (!currentUserId) return;

        const tripsChannel = supabase
            .channel('my_trips_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
                fetchTrips(currentUserId);
            })
            .subscribe();

        const broadcastChannel = supabase
            .channel(`driver_${currentUserId}_notify`)
            .on('broadcast', { event: 'new_booking' }, (payload) => handleNewBooking(payload.payload))
            .subscribe();

        return () => {
            supabase.removeChannel(tripsChannel);
            supabase.removeChannel(broadcastChannel);
        };
    }, [currentUserId]);

    const handleNewBooking = useCallback((booking) => {
        if (!booking?.passenger_name) return;
        toast.success(`New booking from ${booking.passenger_name}!`, { duration: 5000 });
        setNewBookingAlert({
            trip_id: booking.trip_id,
            passenger: booking.passenger_name,
            time: new Date().toLocaleTimeString()
        });
        setTimeout(() => setNewBookingAlert(null), 3500);

        if (currentUserId) fetchTrips(currentUserId);
    }, [currentUserId]);

    const fetchTrips = async (userId) => {
        try {
            setLoading(true);

            // Background auto-canceler
            try {
                await supabase.rpc('auto_cancel_expired_trips', { p_user_id: userId });
            } catch (rpcError) {
                console.warn('[MyTrips] Non-critical error executing auto-cancel RPC:', rpcError);
            }

            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .eq('user_id', userId)
                .order('travel_date', { ascending: false });

            if (error) throw error;

            if (data?.length > 0) {
                const tripIds = data.map(t => t.id);
                const { data: counts } = await supabase
                    .from('booking_requests')
                    .select('trip_id')
                    .in('trip_id', tripIds)
                    .eq('status', 'approved');

                const countsMap = {};
                counts?.forEach(row => {
                    countsMap[row.trip_id] = (countsMap[row.trip_id] || 0) + 1;
                });
                setBookingCounts(countsMap);
            } else {
                setBookingCounts({});
            }

            setTrips(data || []);
        } catch (error) {
            console.error('[MyTrips] Error fetching trips:', error);
            toast.error('Failed to load trips');
        } finally {
            setLoading(false);
        }
    };

    const validateAndStartTrip = async (tripId) => {
        try {
            setStartingTripId(tripId);
            const trip = trips.find(t => t.id === tripId);

            // Artificial tiny delay for smoother UI feedback
            await new Promise(resolve => setTimeout(resolve, 600));

            if (onRideStart) {
                onRideStart(trip);
            }
        } catch (error) {
            console.error('[MyTrips] Error validating trip:', error);
            toast.error('Failed to validate trip. Please try again.');
        } finally {
            setStartingTripId(null);
        }
    };

    const updateTripStatus = async (tripId, newStatus) => {
        try {
            if (newStatus === 'in_progress') {
                await validateAndStartTrip(tripId);
                return;
            }

            const { error } = await supabase
                .from('trips')
                .update({ status: newStatus })
                .eq('id', tripId);

            if (error) throw error;

            setTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: newStatus } : t));

            if (newStatus === 'completed') {
                toast.success('Journey Completed! Payment details updated.');
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

            setTrips(prev => prev.map(t => t.id === selectedTrip.id ? { ...t, status: 'cancelled' } : t));

            toast.success('Trip cancelled successfully');
            setShowCancelModal(false);
            setSelectedTrip(null);
        } catch (error) {
            console.error('[MyTrips] Error cancelling trip:', error);
            toast.error('Failed to cancel trip');
        }
    };

    const filteredTrips = useMemo(() => {
        return trips.filter(trip => {
            if (filter === 'all') {
                return trip.status !== 'cancelled' && trip.status !== 'expired';
            }
            if (filter === 'active') {
                return trip.status === 'active' || trip.status === 'full';
            }
            return trip.status === filter;
        });
    }, [trips, filter]);

    const FILTERS = [
        { id: 'all', label: 'All Trips' },
        { id: 'active', label: 'Active' },
        { id: 'in_progress', label: 'In Progress' },
        { id: 'completed', label: 'Completed' },
        { id: 'expired', label: 'Expired' },
        { id: 'cancelled', label: 'Cancelled' }
    ];

    return (
        <div className="my-trips-container animate-page-in">
            {/* ── HEADER ── */}
            <div className="my-trips-header">
                <button className="back-btn" onClick={onBack} aria-label="Go back">
                    <ArrowLeft size={22} />
                </button>
                <div className="header-title-section">
                    <h1>My Trips</h1>
                    {newBookingAlert && (
                        <div className="new-booking-alert">
                            <Bell size={12} style={{ fill: 'currentColor' }} />
                            <span>New request from {newBookingAlert.passenger}</span>
                        </div>
                    )}
                </div>
                {/* Spacer block for flex centering */}
                <div style={{ width: 40 }} />
            </div>

            {/* ── REAL-TIME STATUS & FILTERS ── */}
            <div className="realtime-status">
                <div className="status-dot active"></div>
                <span>Ready for bookings • Live updates enabled</span>
            </div>

            <div className="trip-filters">
                {FILTERS.map(({ id, label }) => (
                    <button
                        key={id}
                        className={`filter-tab ${filter === id ? 'active' : ''}`}
                        onClick={() => setFilter(id)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* ── MAIN CONTENT ── */}
            <div className="trips-content">
                {loading ? (
                    <div className="trips-list">
                        <TripSkeleton />
                        <TripSkeleton />
                    </div>
                ) : filteredTrips.length === 0 ? (
                    <div className="empty-state">
                        <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.04)', borderRadius: '24px' }}>
                            <Car size={32} strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3>No trips found</h3>
                            <p>
                                {filter === 'all'
                                    ? "You haven't published any trips yet"
                                    : `No ${filter.replace('_', ' ')} trips available`}
                            </p>
                        </div>
                        <div className="realtime-hint">
                            <Bell size={13} fill="currentColor" />
                            <span>Publish a trip to receive bookings</span>
                        </div>
                    </div>
                ) : (
                    <div className="trips-list">
                        {filteredTrips.map(trip => (
                            <TripCard
                                key={trip.id}
                                trip={trip}
                                passengerCount={bookingCounts[trip.id] || 0}
                                isStarting={startingTripId === trip.id}
                                insights={tripInsights[trip.id]}
                                onUpdateStatus={updateTripStatus}
                                onCancelRequest={(t) => { setSelectedTrip(t); setShowCancelModal(true); }}
                                onRideStart={onRideStart}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── CANCEL MODAL ── */}
            {showCancelModal && (
                <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowCancelModal(false)}>
                            <X size={20} />
                        </button>
                        <div className="modal-icon warning">
                            <AlertCircle size={28} />
                        </div>
                        <h2>Cancel Trip?</h2>
                        <p>Are you sure you want to cancel this trip? This action cannot be undone.</p>

                        {selectedTrip && bookingCounts[selectedTrip.id] > 0 && (
                            <div className="warning-text" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <AlertCircle size={16} />
                                <span>{bookingCounts[selectedTrip.id]} passenger(s) will be notified immediately.</span>
                            </div>
                        )}

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