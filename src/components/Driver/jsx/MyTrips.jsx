import React, { useState, useEffect } from 'react';
import { ArrowLeft, Car, Bike, Calendar, Clock, Users, X, Key, Bell, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { isTripToday, isTripPast, formatDate, formatTime, getTimeUntilTrip } from '../../../utils/dateHelper';
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
    const [startingTripId, setStartingTripId] = useState(null);
    const [tripInsights, setTripInsights] = useState({});

    useEffect(() => {
        const initialize = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                fetchTrips();
            }
        };

        initialize();
        const subscriptions = setupRealtimeSubscriptions();

        return () => {
            if (subscriptions?.tripsChannel) supabase.removeChannel(subscriptions.tripsChannel);
            if (subscriptions?.broadcastChannel) supabase.removeChannel(subscriptions.broadcastChannel);
        };
    }, []);

    const setupRealtimeSubscriptions = () => {
        const tripsChannel = supabase
            .channel('my_trips_updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'trips',
            }, () => {
                fetchTrips();
            })
            .subscribe();

        const broadcastChannel = supabase
            .channel(`driver_${currentUserId}_notify`)
            .on('broadcast', { event: 'new_booking' }, (payload) => {
                handleNewBooking(payload.payload);
            })
            .subscribe();

        return { tripsChannel, broadcastChannel };
    };

    const handleNewBooking = (booking) => {
        if (!booking?.passenger_name) return;
        toast.success(`🚗 New booking from ${booking.passenger_name}!`, { duration: 5000 });
        setNewBookingAlert({
            trip_id: booking.trip_id,
            passenger: booking.passenger_name,
            time: new Date().toLocaleTimeString()
        });
        setTimeout(() => setNewBookingAlert(null), 3000);
        fetchTrips();
    };

    const fetchTrips = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Please login again');
                return;
            }

            // --- Auto Cancel Old Empty Trips Before Fetching ---
            try {
                await supabase.rpc('auto_cancel_expired_trips', {
                    p_user_id: user.id
                });
            } catch (rpcError) {
                console.warn('[MyTrips] Non-critical error executing auto-cancel RPC:', rpcError);
            }
            // ---------------------------------------------------

            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .eq('user_id', user.id)
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
                tripIds.forEach(id => countsMap[id] = 0);
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

            // Bypassing edge function as requested to avoid 401 Unauthorized errors
            const trip = trips.find(t => t.id === tripId);

            // Proceed to OTP screen directly
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

            setTrips(prev => prev.map(t =>
                t.id === tripId ? { ...t, status: newStatus } : t
            ));

            if (newStatus === 'completed') {
                toast.success('🎉 Journey Completed! Payment will be processed.');
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
        if (filter === 'all') {
            // Hide cancelled and expired trips from the "All" view
            return trip.status !== 'cancelled' && trip.status !== 'expired';
        }
        if (filter === 'active') {
            return trip.status === 'active' || trip.status === 'full';
        }
        return trip.status === filter;
    });

    const TripCard = ({ trip }) => {
        const passengerCount = bookingCounts[trip.id] || 0;
        const isToday = isTripToday(trip.travel_date);
        const timeUntilTrip = getTimeUntilTrip(trip.travel_date);
        const insights = tripInsights[trip.id];
        const isStarting = startingTripId === trip.id;

        return (
            <div className="trip-card">
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
                        {trip.status === 'expired' && (
                            <div className="incentive-badge expired">
                                <AlertCircle size={14} />
                                <span>Trip Expired — No passengers booked</span>
                            </div>
                        )}
                        {trip.status === 'active' && passengerCount === 0 && (
                            <div className="incentive-badge waiting">
                                <Users size={14} />
                                <span>Waiting for passengers</span>
                            </div>
                        )}
                        {(trip.status === 'active' || trip.status === 'full') && passengerCount > 0 && (
                            <div className="incentive-badge confirmed">
                                <CheckCircle size={14} />
                                <span>{passengerCount} Confirmed</span>
                            </div>
                        )}
                        {isToday && (trip.status === 'active' || trip.status === 'full') && (
                            <div className="incentive-badge today">
                                <Key size={14} />
                                <span>Available Today!</span>
                            </div>
                        )}
                    </div>

                    {insights && (
                        <div className="passenger-insights">
                            <div className="insight-item verified">
                                <CheckCircle size={14} />
                                <span>{insights.passengers.verified} verified</span>
                            </div>
                            {insights.passengers.pending > 0 && (
                                <div className="insight-item pending">
                                    <AlertCircle size={14} />
                                    <span>{insights.passengers.pending} pending OTP</span>
                                </div>
                            )}
                        </div>
                    )}
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
                        {(trip.status === 'active' || trip.status === 'full') && (
                            <>
                                <button
                                    className={`primary-action-btn start ${!isToday ? 'disabled' : ''}`}
                                    onClick={() => isToday && !isStarting && updateTripStatus(trip.id, 'in_progress')}
                                    disabled={!isToday || isStarting}
                                >
                                    {isStarting ? (
                                        <span className="loading-spinner-small"></span>
                                    ) : isToday ? (
                                        '🚗 START TRIP'
                                    ) : (
                                        timeUntilTrip
                                    )}
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

                    {(trip.status === 'active' || trip.status === 'full') && passengerCount > 0 && (
                        <div className="booking-notification">
                            <Bell size={12} />
                            <span>{passengerCount} confirmed booking{passengerCount > 1 ? 's' : ''}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

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
                            <span>New request from {newBookingAlert.passenger}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Real-time status */}
            <div className="realtime-status">
                <div className="status-dot active"></div>
                <span>Ready for bookings • Live updates enabled</span>
            </div>

            {/* Filter Tabs */}
            <div className="trip-filters">
                {['all', 'active', 'in_progress', 'completed', 'expired', 'cancelled'].map((filterType) => (
                    <button
                        key={filterType}
                        className={`filter-tab ${filter === filterType ? 'active' : ''}`}
                        onClick={() => setFilter(filterType)}
                    >
                        {filterType === 'in_progress'
                            ? 'In Progress'
                            : filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                    </button>
                ))}
            </div>

            {/* Trips List */}
            <div className="trips-content">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading your trips...</p>
                    </div>
                ) : filteredTrips.length === 0 ? (
                    <div className="empty-state">
                        <Car size={48} />
                        <h3>No trips found</h3>
                        <p>
                            {filter === 'all'
                                ? "You haven't created any trips yet"
                                : `No ${filter.replace('_', ' ')} trips`}
                        </p>
                        <p className="realtime-hint">
                            <Bell size={14} />
                            Create a trip to start receiving bookings
                        </p>
                    </div>
                ) : (
                    <div className="trips-list">
                        {filteredTrips.map(trip => (
                            <TripCard key={trip.id} trip={trip} />
                        ))}
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
                            <AlertCircle size={32} />
                        </div>
                        <h2>Cancel Trip?</h2>
                        <p>Are you sure you want to cancel this trip? This action cannot be undone.</p>
                        {selectedTrip && bookingCounts[selectedTrip.id] > 0 && (
                            <p className="warning-text">
                                ⚠️ {bookingCounts[selectedTrip.id]} passenger(s) will be notified of the cancellation.
                            </p>
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