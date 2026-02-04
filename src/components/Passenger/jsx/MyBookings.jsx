import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, User, AlertCircle, CheckCircle, XCircle, Loader } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { formatDate, formatTime, isTripToday, getTimeUntilTrip } from '../../../utils/dateHelper';
import { getOTPForTrip } from '../../../utils/otpHelper';
import { getSafeSession } from '../../../utils/webViewHelper';
import '../css/MyBookings.css';

const MyBookings = ({ onBack, onViewDetails }) => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'pending', 'approved', 'upcoming', 'completed'

    useEffect(() => {
        fetchBookings();

        // Get current user for subscription filter
      // Update the subscription in MyBookings.jsx useEffect
const setupSubscription = async () => {
    const { data: sessionData } = await getSafeSession(supabase);
    const user = sessionData?.session?.user;

    if (!user) return;

    // Subscribe to booking updates
    const bookingSubscription = supabase
        .channel('passenger_booking_updates')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'booking_requests',
            filter: `passenger_id=eq.${user.id}`,
        }, (payload) => {
            console.log('Booking update received:', payload);
            
            // If booking was approved, show notification
            if (payload.eventType === 'UPDATE' && 
                payload.new.status === 'approved' && 
                payload.old.status === 'pending') {
                toast.success('🎉 Your ride has been accepted!');
            }
            
            // Refresh bookings
            fetchBookings();
        })
        .subscribe();

    // Also subscribe to notifications table
    const notificationSubscription = supabase
        .channel('passenger_notifications')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
        }, (payload) => {
            console.log('New notification:', payload);
            if (payload.new.type === 'booking_accepted') {
                toast.success(payload.new.title || 'Ride Accepted!');
            }
        })
        .subscribe();

    return () => {
        supabase.removeChannel(bookingSubscription);
        supabase.removeChannel(notificationSubscription);
    };
};

        const subscriptionPromise = setupSubscription();

        return () => {
            subscriptionPromise.then(subscription => {
                if (subscription) {
                    console.log('Cleaning up booking updates subscription');
                    supabase.removeChannel(subscription);
                }
            });
        };
    }, []);

   // Update the fetchBookings function in MyBookings.jsx
const fetchBookings = async () => {
    try {
        console.log('Fetching bookings...');
        const { data: sessionData, error: sessionError } = await getSafeSession(supabase);

        if (sessionError) {
            console.error('Session check failed:', sessionError);
            throw new Error('Failed to verify session');
        }

        const user = sessionData?.session?.user;
        if (!user) {
            console.log('No active user found');
            return;
        }

        // UPDATED QUERY: Get driver details when booking is approved
        const { data, error } = await supabase
            .from('booking_requests')
            .select(`
                *,
                trips (
                    id,
                    from_location,
                    to_location,
                    travel_date,
                    travel_time,
                    vehicle_type,
                    price_per_seat,
                    status
                ),
                driver:driver_id (
                    id,
                    full_name,
                    phone,
                    vehicle_type,
                    vehicle_number
                )
            `)
            .eq('passenger_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Map the data
        const bookingsWithDetails = (data || []).map(booking => {
            let driverDetails = booking.driver;
            
            // If driver is an array, get first element
            if (Array.isArray(driverDetails) && driverDetails.length > 0) {
                driverDetails = driverDetails[0];
            }
            
            return {
                ...booking,
                driver_details: driverDetails || null
            };
        });

        // Fetch OTPs for today's trips
        const bookingsWithOTP = await Promise.all(
            bookingsWithDetails.map(async (booking) => {
                if (booking.trips && isTripToday(booking.trips.travel_date) && booking.status === 'approved') {
                    const otp = await getOTPForTrip(booking.trips.id);
                    return { ...booking, otp };
                }
                return booking;
            })
        );

        setBookings(bookingsWithOTP);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        toast.error('Failed to load bookings');
    } finally {
        setLoading(false);
    }
};

// Add driver details section in the booking card render
<div className="booking-card">
    {/* Status Badge */}
    <div className="booking-status">
        {getStatusIcon(booking.status)}
        <span>{getStatusText(booking)}</span>
    </div>

    {/* DRIVER DETAILS SECTION - SHOW WHEN APPROVED */}
    {booking.status === 'approved' && booking.driver_details && (
        <div className="driver-details-section">
            <div className="section-header">
                <User size={16} />
                <span>Your Driver</span>
            </div>
            <div className="driver-info">
                <div className="driver-row">
                    <span className="label">Name:</span>
                    <span className="value">{booking.driver_details.full_name}</span>
                </div>
                <div className="driver-row">
                    <span className="label">Phone:</span>
                    <a 
                        href={`tel:${booking.driver_details.phone}`}
                        className="value phone-link"
                    >
                        {booking.driver_details.phone}
                    </a>
                </div>
                {booking.driver_details.vehicle_type && (
                    <div className="driver-row">
                        <span className="label">Vehicle:</span>
                        <span className="value">
                            {booking.driver_details.vehicle_type}
                            {booking.driver_details.vehicle_number && 
                                ` (${booking.driver_details.vehicle_number})`}
                        </span>
                    </div>
                )}
            </div>
        </div>
    )}

    {/* Trip Info */}
    {booking.trips && (
        <>
            <div className="trip-route">
                {/* ... existing route code ... */}
            </div>

            {/* ... rest of your existing code ... */}
        </>
    )}
</div>

    const handleCancelBooking = async (bookingId) => {
        if (!window.confirm('Are you sure you want to cancel this booking?')) return;

        try {
            const { error } = await supabase
                .from('booking_requests')
                .update({ status: 'cancelled' })
                .eq('id', bookingId);

            if (error) throw error;

            toast.success('Booking cancelled');
            fetchBookings();
        } catch (error) {
            console.error('Error cancelling booking:', error);
            toast.error('Failed to cancel booking');
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'pending':
                return <Loader size={18} className="status-icon pending" />;
            case 'approved':
                return <CheckCircle size={18} className="status-icon approved" />;
            case 'rejected':
                return <XCircle size={18} className="status-icon rejected" />;
            case 'cancelled':
                return <XCircle size={18} className="status-icon cancelled" />;
            default:
                return <AlertCircle size={18} className="status-icon" />;
        }
    };

    const getStatusText = (booking) => {
        if (booking.status === 'pending') return 'Waiting for driver approval';
        if (booking.status === 'approved' && booking.trips) {
            if (booking.trips.status === 'completed') return 'Trip completed';
            if (booking.trips.status === 'in_progress') return 'Trip in progress';
            if (isTripToday(booking.trips.travel_date)) return 'Trip is today!';
            return `Trip ${getTimeUntilTrip(booking.trips.travel_date)}`;
        }
        if (booking.status === 'rejected') return 'Booking declined';
        if (booking.status === 'cancelled') return 'Booking cancelled';
        return booking.status;
    };

    const filteredBookings = bookings.filter(booking => {
        if (filter === 'all') return true;
        if (filter === 'pending') return booking.status === 'pending';
        if (filter === 'approved') return booking.status === 'approved';
        if (filter === 'upcoming') {
            return booking.status === 'approved' && booking.trips &&
                new Date(booking.trips.travel_date) >= new Date();
        }
        if (filter === 'completed') {
            return booking.trips?.status === 'completed';
        }
        return true;
    });

    // Loading state is now handled inside the main return to keep header visible

    return (
        <div className="my-bookings-container">
            {/* Header */}
            <div className="bookings-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1>My Bookings</h1>
                <div className="header-spacer" />
            </div>

            {/* Filter Tabs */}
            {!loading && (
                <div className="filter-tabs">
                    {['all', 'pending', 'approved', 'upcoming', 'completed'].map(tab => (
                        <button
                            key={tab}
                            className={`filter-tab ${filter === tab ? 'active' : ''}`}
                            onClick={() => setFilter(tab)}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading bookings...</p>
                </div>
            ) : (
                <div className="bookings-content">
                    {filteredBookings.length === 0 ? (
                        <div className="empty-state">
                            <Calendar size={64} />
                            <h3>No Bookings</h3>
                            <p>
                                {filter === 'all'
                                    ? "You haven't made any bookings yet"
                                    : `No ${filter} bookings`}
                            </p>
                        </div>
                    ) : (
                        <div className="bookings-list">
                            {filteredBookings.map(booking => (
                                <div key={booking.id} className={`booking-card ${booking.status}`}>
                                    {/* Status Badge */}
                                    <div className="booking-status">
                                        {getStatusIcon(booking.status)}
                                        <span>{getStatusText(booking)}</span>
                                    </div>

                                    {/* Trip Info */}
                                    {booking.trips && (
                                        <>
                                            <div className="trip-route">
                                                <div className="route-point">
                                                    <div className="dot from"></div>
                                                    <span>{booking.trips.from_location}</span>
                                                </div>
                                                <div className="route-line"></div>
                                                <div className="route-point">
                                                    <div className="dot to"></div>
                                                    <span>{booking.trips.to_location}</span>
                                                </div>
                                            </div>

                                            <div className="trip-meta">
                                                <div className="meta-item">
                                                    <Calendar size={16} />
                                                    <span>{formatDate(booking.trips.travel_date, 'medium')}</span>
                                                </div>
                                                <div className="meta-item">
                                                    <Clock size={16} />
                                                    <span>{formatTime(booking.trips.travel_time)}</span>
                                                </div>
                                                <div className="meta-item">
                                                    <User size={16} />
                                                    <span>{booking.driver_name}</span>
                                                </div>
                                            </div>

                                            <div className="booking-details">
                                                <div className="detail-row">
                                                    <span>Seats:</span>
                                                    <span>{booking.seats_requested}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span>Payment:</span>
                                                    <span>{booking.payment_mode === 'cod' ? 'Cash' : 'Online'}</span>
                                                </div>
                                                {booking.trips.price_per_seat && (
                                                    <div className="detail-row total">
                                                        <span>Total:</span>
                                                        <span>₹{booking.trips.price_per_seat * booking.seats_requested}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* OTP Display */}
                                            {booking.otp && (
                                                <div className="otp-section">
                                                    <span className="otp-label">Your Trip OTP:</span>
                                                    <span className="otp-code">{booking.otp}</span>
                                                    <span className="otp-note">Share this with your driver</span>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Actions */}
                                    <div className="booking-actions">
                                        {booking.status === 'pending' && (
                                            <button
                                                className="btn-cancel"
                                                onClick={() => handleCancelBooking(booking.id)}
                                            >
                                                Cancel Request
                                            </button>
                                        )}
                                        {onViewDetails && (
                                            <button
                                                className="btn-details"
                                                onClick={() => onViewDetails(booking)}
                                            >
                                                View Details
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MyBookings;
