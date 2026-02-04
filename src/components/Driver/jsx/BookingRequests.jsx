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
    const [currentUserId, setCurrentUserId] = useState(null);

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) setCurrentUserId(session.user.id);
        };
        getSession();
        fetchRequests();

        // Real-time subscription for booking requests
        const subscription = supabase
            .channel('driver_booking_requests')
            .on('postgres_changes', {
                event: '*', // Listen to INSERT, UPDATE, DELETE
                schema: 'public',
                table: 'booking_requests',
            }, (payload) => {
                console.log('Booking request change detected:', payload);
                // Refresh requests when any booking request changes
                fetchRequests();
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Successfully subscribed to booking requests');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('Error subscribing to booking requests');
                }
            });

        // Cleanup subscription on unmount
        return () => {
            console.log('Cleaning up booking requests subscription');
            supabase.removeChannel(subscription);
        };
    }, []);

    const fetchRequests = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get all trips for this driver
            const { data: trips } = await supabase
                .from('trips')
                .select('id')
                .eq('user_id', user.id);

            if (!trips || trips.length === 0) {
                setRequests([]);
                setLoading(false);
                return;
            }

            const tripIds = trips.map(t => t.id);

            // Get booking requests for these trips
            const { data, error } = await supabase
                .from('booking_requests')
                .select(`
                    *,
                    profiles (
                        full_name
                    ),
                    trips (
                        from_location,
                        to_location,
                        travel_date,
                        travel_time,
                        available_seats,
                        vehicle_type
                    )
                `)
                .in('trip_id', tripIds)
                .order('created_at', { ascending: false });

            if (error) throw error;


            // Fetch ratings for each passenger (Feature 5)
            const requestsWithPassenger = await Promise.all(
                (data || []).map(async (req) => {
                    // Fetch Ratings
                    const { data: ratings } = await supabase
                        .from('reviews')
                        .select('rating')
                        .eq('target_id', req.passenger_id);

                    let avgRating = 0;
                    if (ratings && ratings.length > 0) {
                        const total = ratings.reduce((sum, r) => sum + r.rating, 0);
                        avgRating = (total / ratings.length).toFixed(1);
                    } else {
                        avgRating = 'New';
                    }

                    let passengerName = 'Unknown Passenger';
                    if (req.profiles) {
                        passengerName = Array.isArray(req.profiles)
                            ? (req.profiles[0]?.full_name || 'Unknown Passenger')
                            : (req.profiles.full_name || 'Unknown Passenger');
                    }

                    return {
                        ...req,
                        passenger_name: passengerName,
                        passenger_rating: avgRating
                    };
                })
            );

            setRequests(requestsWithPassenger);
        } catch (error) {
            console.error('Error fetching requests:', error);
            toast.error('Failed to load requests');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (request) => {
        try {
            // Update booking request status
            const { error: updateError } = await supabase
                .from('booking_requests')
                .update({
                    status: 'approved',
                    updated_at: new Date().toISOString()
                })
                .eq('id', request.id);

            if (updateError) throw updateError;

            // Update available seats in trip
            const newSeats = request.trips.available_seats - request.seats_requested;
            const tripStatus = newSeats <= 0 ? 'full' : 'active';

            await supabase
                .from('trips')
                .update({
                    available_seats: Math.max(0, newSeats),
                    status: tripStatus
                })
                .eq('id', request.trip_id);

            // Update local state
            setRequests(prev => prev.map(r =>
                r.id === request.id ? { ...r, status: 'approved' } : r
            ));

            // Send notification to passenger
            await createNotification(
                request.passenger_id,
                'booking_approved',
                'Booking Approved!',
                `Your request for the ride to ${request.trips.to_location} has been approved.`,
                request.trip_id
            );

            toast.success('Booking approved!');
        } catch (error) {
            console.error('Error approving request:', error);
            toast.error('Failed to approve booking');
        }
    };

    const handleReject = async (request) => {
        try {
            const { error } = await supabase
                .from('booking_requests')
                .update({
                    status: 'rejected',
                    updated_at: new Date().toISOString()
                })
                .eq('id', request.id);

            if (error) throw error;

            setRequests(prev => prev.map(r =>
                r.id === request.id ? { ...r, status: 'rejected' } : r
            ));

            // Send notification to passenger
            await createNotification(
                request.passenger_id,
                'booking_rejected',
                'Booking Rejected',
                `Your request for the ride to ${request.trips.to_location} has been declined.`,
                request.trip_id
            );

            toast.success('Booking rejected');
        } catch (error) {
            console.error('Error rejecting request:', error);
            toast.error('Failed to reject booking');
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
                                <div className={`status-badge ${request.status}`}>
                                    {request.status}
                                </div>

                                {/* Passenger Info */}
                                <div className="passenger-info">
                                    <div className="passenger-avatar">
                                        <User size={24} />
                                    </div>
                                    <div className="passenger-details">
                                        <div className="passenger-header-row">
                                            <h3>{request.passenger_name}</h3>
                                            <div className="passenger-rating">
                                                <Star size={14} fill="#facc15" color="#facc15" />
                                                <span>{request.passenger_rating}</span>
                                            </div>
                                        </div>
                                        <span className="seats-requested">
                                            <Users size={14} />
                                            {request.seats_requested} seat{request.seats_requested > 1 ? 's' : ''} requested
                                        </span>
                                    </div>
                                    <div className="passenger-contact-actions">
                                        <button className="icon-btn-small chat" onClick={() => {
                                            setActiveChatTripId(request.trip_id);
                                            setShowChat(true);
                                        }}>
                                            <MessageCircle size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Trip Info */}
                                {request.trips && (
                                    <div className="trip-info">
                                        <div className="route">
                                            <MapPin size={16} className="from-icon" />
                                            <span>{request.trips.from_location}</span>
                                            <span className="arrow">→</span>
                                            <span>{request.trips.to_location}</span>
                                        </div>
                                        <div className="meta">
                                            <span>
                                                <Calendar size={14} />
                                                {formatDate(request.trips.travel_date)}
                                            </span>
                                            <span>
                                                <Clock size={14} />
                                                {formatTime(request.trips.travel_time)}
                                            </span>
                                        </div>
                                        {/* Payment Mode Badge */}
                                        <div className="payment-badge">
                                            {request.payment_mode === 'online' ? (
                                                <span className="badge online">
                                                    <CreditCard size={14} /> Online Paid
                                                </span>
                                            ) : (
                                                <span className="badge online">
                                                    <Banknote size={14} /> Cash (Pay to Driver)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Message */}
                                {request.message && (
                                    <div className="request-message">
                                        <MessageCircle size={14} />
                                        <p>"{request.message}"</p>
                                    </div>
                                )}

                                {/* Actions */}
                                {request.status === 'pending' && (
                                    <div className="request-actions">
                                        <button
                                            className="action-btn reject"
                                            onClick={() => handleReject(request)}
                                        >
                                            <X size={18} />
                                            Reject
                                        </button>
                                        <button
                                            className="action-btn approve"
                                            onClick={() => handleApprove(request)}
                                        >
                                            <Check size={18} />
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
                        currentUserId={currentUserId}
                        onBack={() => setShowChat(false)}
                    />
                </div>
            )}
        </div>
    );
};

export default BookingRequests;
