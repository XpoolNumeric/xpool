import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, X, User, MapPin, Calendar, Clock, Users, MessageCircle, Banknote, CreditCard, Star } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { createNotification } from '../../../utils/notificationHelper';
import Chat from '../../common/Chat';
import '../css/BookingRequests.css';

const BookingRequests = ({ onBack }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending');
    const [showChat, setShowChat] = useState(false);
    const [activeChatTripId, setActiveChatTripId] = useState(null);
    const [activeChatBookingId, setActiveChatBookingId] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);

    useEffect(() => {
        let subscription;

        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            const userId = session.user.id;
            setCurrentUserId(userId);

            // Fetch requests immediately
            fetchRequests(userId);

            // Real-time subscription filtered to this driver's bookings
            subscription = supabase
                .channel(`driver_bookings_${userId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'booking_requests',
                    filter: `driver_id=eq.${userId}`,
                }, (payload) => {
                    console.log('Booking request change for this driver:', payload);
                    fetchRequests(userId);
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('Subscribed to driver booking requests');
                    }
                });
        };

        init();

        return () => {
            if (subscription) {
                supabase.removeChannel(subscription);
            }
        };
    }, []);

    const fetchRequests = async (driverId) => {
        try {
            // If no driverId passed, get it from session
            let userId = driverId;
            if (!userId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                userId = user.id;
            }

            console.log('[BookingRequests] Fetching requests for driver:', userId);

            // Single query: get all booking requests for this driver directly
            // (book-trip edge function stores driver_id on each booking)
            const { data, error } = await supabase
                .from('booking_requests')
                .select(`
                    *,
                    trips (
                        from_location,
                        to_location,
                        travel_date,
                        travel_time,
                        available_seats,
                        vehicle_type
                    )
                `)
                .eq('driver_id', userId)
                .order('created_at', { ascending: false });

            console.log('[BookingRequests] Query result - data:', data, 'error:', error);

            if (error) throw error;

            // Batch fetch passenger profiles
            const passengerIds = [...new Set((data || []).map(r => r.passenger_id).filter(Boolean))];
            let profilesMap = {};

            if (passengerIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', passengerIds);

                if (profilesData) {
                    profilesData.forEach(p => {
                        profilesMap[p.id] = p.full_name;
                    });
                }
            }

            // Batch fetch ratings: collect unique passenger IDs (non-critical, fail gracefully)
            let ratingsMap = {};

            if (passengerIds.length > 0) {
                try {
                    const { data: allRatings } = await supabase
                        .from('reviews')
                        .select('target_id, rating')
                        .in('target_id', passengerIds);

                    if (allRatings) {
                        // Group ratings by target_id and compute average
                        allRatings.forEach(r => {
                            if (!ratingsMap[r.target_id]) ratingsMap[r.target_id] = [];
                            ratingsMap[r.target_id].push(r.rating);
                        });
                    }
                } catch (ratingsError) {
                    console.warn('[BookingRequests] Reviews query failed (non-critical):', ratingsError);
                }
            }

            // Map results with passenger names and ratings
            const requestsWithPassenger = (data || []).map(req => {
                const ratings = ratingsMap[req.passenger_id];
                let avgRating = 'New';
                if (ratings && ratings.length > 0) {
                    const total = ratings.reduce((sum, r) => sum + r, 0);
                    avgRating = (total / ratings.length).toFixed(1);
                }

                return {
                    ...req,
                    passenger_name: profilesMap[req.passenger_id] || 'Unknown Passenger',
                    passenger_rating: avgRating
                };
            });

            console.log('[BookingRequests] Processed requests:', requestsWithPassenger.length, requestsWithPassenger);
            setRequests(requestsWithPassenger);
        } catch (error) {
            console.error('[BookingRequests] Error fetching requests:', error);
            toast.error('Failed to load requests');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (request) => {
        try {
            console.log('[BookingRequests] Approving booking:', request.id);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Session expired. Please login again.');

            const { data, error } = await supabase.functions.invoke('approve-booking', {
                body: { booking_id: request.id },
                headers: { Authorization: `Bearer ${session.access_token}` }
            });

            console.log('[BookingRequests] Approve response - data:', data, 'error:', error);

            if (error) {
                // Extract actual error message from edge function response
                let errorMessage = 'Failed to approve booking';
                try {
                    if (error.context && error.context.json) {
                        const errorBody = await error.context.json();
                        errorMessage = errorBody?.error || error.message || errorMessage;
                    } else {
                        errorMessage = error.message || errorMessage;
                    }
                } catch (parseErr) {
                    errorMessage = error.message || errorMessage;
                }
                throw new Error(errorMessage);
            }
            if (!data?.success) throw new Error(data?.error || 'Approval failed');

            // Update local state
            setRequests(prev => prev.map(r =>
                r.id === request.id ? { ...r, status: 'approved' } : r
            ));

            toast.success('🎉 Ride confirmed! Passenger has been notified.');
        } catch (error) {
            console.error('[BookingRequests] Error approving request:', error);
            toast.error(error.message || 'Failed to approve booking');
        }
    };

    const handleReject = async (request) => {
        try {
            console.log('[BookingRequests] Rejecting booking:', request.id);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Session expired. Please login again.');

            const { data, error } = await supabase.functions.invoke('reject-booking', {
                body: { booking_id: request.id },
                headers: { Authorization: `Bearer ${session.access_token}` }
            });

            console.log('[BookingRequests] Reject response - data:', data, 'error:', error);

            if (error) {
                let errorMessage = 'Failed to reject booking';
                try {
                    if (error.context && error.context.json) {
                        const errorBody = await error.context.json();
                        errorMessage = errorBody?.error || error.message || errorMessage;
                    } else {
                        errorMessage = error.message || errorMessage;
                    }
                } catch (parseErr) {
                    errorMessage = error.message || errorMessage;
                }
                throw new Error(errorMessage);
            }
            if (!data?.success) throw new Error(data?.error || 'Rejection failed');

            setRequests(prev => prev.map(r =>
                r.id === request.id ? { ...r, status: 'rejected' } : r
            ));

            toast.success('Booking declined');
        } catch (error) {
            console.error('[BookingRequests] Error rejecting request:', error);
            toast.error(error.message || 'Failed to reject booking');
        }
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatTime = (timeStr) => {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const filteredRequests = requests.filter(req => {
        if (filter === 'all') return true;
        return req.status === filter;
    });

    const statusCount = {
        all: requests.length,
        pending: requests.filter(r => r.status === 'pending').length,
        approved: requests.filter(r => r.status === 'approved').length,
        rejected: requests.filter(r => r.status === 'rejected').length
    };

    return (
        <div className="booking-requests-container animate-page-in">
            {/* Header */}
            <div className="requests-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1>Booking Requests</h1>
                <div className="header-spacer" />
            </div>

            {/* Filter Tabs */}
            <div className="filter-tabs">
                {['pending', 'approved', 'rejected', 'all'].map(status => (
                    <button
                        key={status}
                        className={`filter-tab ${filter === status ? 'active' : ''}`}
                        onClick={() => setFilter(status)}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                        <span className="count">{statusCount[status]}</span>
                    </button>
                ))}
            </div>

            {/* Requests List */}
            <div className="requests-content">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading requests...</p>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="empty-state">
                        <MessageCircle size={48} />
                        <h3>No requests</h3>
                        <p>
                            {filter === 'pending'
                                ? "You don't have any pending requests"
                                : `No ${filter} requests`}
                        </p>
                    </div>
                ) : (
                    <div className="requests-list">
                        {filteredRequests.map(request => (
                            <div key={request.id} className="request-card">
                                {/* Top Status Badge */}
                                <div className={`card-status-label ${request.status}`}>
                                    {request.status.toUpperCase()}
                                </div>

                                {/* Passenger Info */}
                                <div className="card-passenger-section">
                                    <div className="passenger-avatar-box">
                                        <User size={22} strokeWidth={2.5} />
                                    </div>
                                    <div className="passenger-meta">
                                        <div className="meta-top-row">
                                            <h3>{request.passenger_name}</h3>
                                            <div className="rating-pill">
                                                <Star size={12} fill="#f59e0b" color="#f59e0b" />
                                                <span>{request.passenger_rating}</span>
                                            </div>
                                        </div>
                                        <div className="meta-bottom-row">
                                            <Users size={12} strokeWidth={2.5} className="meta-icon" />
                                            <span>{request.seats_requested} seat{request.seats_requested > 1 ? 's' : ''} requested</span>
                                        </div>
                                    </div>
                                    <button className="chat-circle-btn" onClick={() => {
                                        setActiveChatTripId(request.trip_id);
                                        setActiveChatBookingId(request.id);
                                        setShowChat(true);
                                    }}>
                                        <MessageCircle size={18} strokeWidth={2.5} />
                                    </button>
                                </div>

                                {/* Trip Info */}
                                {request.trips && (
                                    <div className="card-trip-section">
                                        <div className="route-display">
                                            <div className="route-node">
                                                <div className="node-icon pickup"></div>
                                                <span className="node-text">{request.trips.from_location}</span>
                                            </div>
                                            <div className="route-arrow">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                            </div>
                                            <div className="route-node">
                                                <span className="node-text">{request.trips.to_location}</span>
                                            </div>
                                        </div>

                                        {/* Passenger Pickup & Destination Detail Box */}
                                        {(request.passenger_location || request.passenger_destination) && (
                                            <div className="pickup-drop-box">
                                                {request.passenger_location && (
                                                    <div className="pd-row">
                                                        <MapPin size={12} strokeWidth={2.5} className="pd-icon pickup" />
                                                        <span>Pickup: {request.passenger_location}</span>
                                                    </div>
                                                )}
                                                {request.passenger_destination && (
                                                    <div className="pd-row">
                                                        <MapPin size={12} strokeWidth={2.5} className="pd-icon drop" />
                                                        <span>Drop: {request.passenger_destination}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="datetime-row">
                                            <div className="dt-item">
                                                <Calendar size={13} strokeWidth={2.5} className="dt-icon" />
                                                <span>{formatDate(request.trips.travel_date)}</span>
                                            </div>
                                            <div className="dt-item">
                                                <Clock size={13} strokeWidth={2.5} className="dt-icon" />
                                                <span>{formatTime(request.trips.travel_time)}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Payment Mode Badge */}
                                        <div className="payment-row">
                                            {request.payment_mode === 'online' ? (
                                                <div className="pay-badge online">
                                                    <CreditCard size={13} strokeWidth={2.5} /> ONLINE PAID
                                                </div>
                                            ) : (
                                                <div className="pay-badge cod">
                                                    <Banknote size={13} strokeWidth={2.5} /> CASH PAYMENT
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Message */}
                                {request.message && (
                                    <div className="passenger-message-box">
                                        <MessageCircle size={14} strokeWidth={2.5} className="msg-icon" />
                                        <p>"{request.message}"</p>
                                    </div>
                                )}

                                {/* Actions */}
                                {request.status === 'pending' && (
                                    <div className="card-actions-row">
                                        <button
                                            className="action-btn-premium reject"
                                            onClick={() => handleReject(request)}
                                        >
                                            <X size={18} strokeWidth={2.5} />
                                            Reject
                                        </button>
                                        <button
                                            className="action-btn-premium approve"
                                            onClick={() => handleApprove(request)}
                                        >
                                            <Check size={18} strokeWidth={2.5} />
                                            Approve
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showChat && (
                <div className="chat-overlay-container">
                    <Chat
                        tripId={activeChatTripId}
                        bookingId={activeChatBookingId}
                        currentUserId={currentUserId}
                        onBack={() => setShowChat(false)}
                    />
                </div>
            )}
        </div>
    );
};

export default BookingRequests;