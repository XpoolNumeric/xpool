import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, User, AlertCircle, CheckCircle, XCircle, Loader } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { formatDate, formatTime, isTripToday, getTimeUntilTrip, isTripPast } from '../../../utils/dateHelper';

import { getSafeSession } from '../../../utils/webViewHelper';
import '../css/MyBookings.css';

const MyBookings = ({ onBack, onViewDetails, onPaymentRequired }) => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'pending', 'approved', 'upcoming', 'completed'

    useEffect(() => {
        fetchBookings();

        // Track channels for synchronous cleanup
        const channels = { booking: null, notification: null, broadcast: null };

        const setupSubscription = async () => {
            const { data: sessionData } = await getSafeSession(supabase);
            const user = sessionData?.session?.user;

            if (!user) return;

            // Subscribe to booking updates (requires Realtime enabled on booking_requests table)
            channels.booking = supabase
                .channel('passenger_booking_updates')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'booking_requests',
                    filter: `passenger_id=eq.${user.id}`,
                }, (payload) => {
                    console.log('Booking update received:', payload);

                    if (payload.eventType === 'UPDATE' &&
                        payload.new.status === 'approved' &&
                        payload.old.status === 'pending') {
                        toast.success('🎉 Your ride has been accepted!');
                    }

                    if (payload.eventType === 'UPDATE' &&
                        payload.new.status === 'rejected' &&
                        payload.old.status === 'pending') {
                        toast.error('❌ Your ride request was declined');
                    }

                    // Detect OTP resend — otp_code changed
                    if (payload.eventType === 'UPDATE' &&
                        payload.new.otp_code &&
                        payload.new.otp_code !== payload.old.otp_code) {
                        toast.success('🔐 New OTP received! Check below.', { duration: 6000 });
                    }

                    fetchBookings();
                })
                .subscribe();

            // Subscribe to notifications table
            channels.notification = supabase
                .channel('passenger_notifications')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                }, (payload) => {
                    console.log('New notification:', payload);
                    // booking_approved: driver accepted the request
                    if (payload.new.type === 'booking_approved') {
                        toast.success(payload.new.title || '🎉 Ride Confirmed!');
                        fetchBookings(); // Refresh to show driver info
                    }
                    // ride_otp: OTP generated for today's ride
                    if (payload.new.type === 'ride_otp') {
                        toast.success(payload.new.title || '🔐 Your OTP is ready! Check My Bookings.', { duration: 8000 });
                        fetchBookings();
                    }
                    // ride_started: driver started the ride
                    if (payload.new.type === 'ride_started') {
                        toast.success(payload.new.title || '🚗 Your ride has started!', { duration: 8000 });
                        fetchBookings();
                    }
                })
                .subscribe();

            // ✅ Broadcast channel — reliable fallback (always works, no table config needed)
            // The generate-ride-otp edge function sends OTP directly to this channel
            channels.broadcast = supabase
                .channel(`passenger_${user.id}`)
                .on('broadcast', { event: 'ride_otp' }, (payload) => {
                    console.log('Broadcast OTP received:', payload);
                    const otp = payload.payload?.otp;
                    if (otp) {
                        toast.success(`🔐 Your Ride OTP: ${otp}`, { duration: 10000 });
                    }
                    fetchBookings(); // Re-fetch to show new OTP in the card
                })
                .on('broadcast', { event: 'ride_started' }, (payload) => {
                    console.log('Broadcast ride started:', payload);
                    toast.success('🚗 Your ride has started!', { duration: 8000 });
                    fetchBookings();
                })
                .on('broadcast', { event: 'passenger_dropped' }, (payload) => {
                    console.log('Broadcast passenger dropped:', payload);
                    toast.success(payload.payload?.message || 'You have been dropped off!');
                    fetchBookings();
                })
                .on('broadcast', { event: 'payment_received' }, (payload) => {
                    console.log('Broadcast payment received:', payload);
                    toast.success('💸 Payment confirmed by driver!');
                    fetchBookings();
                })
                .subscribe();
        };

        setupSubscription();

        return () => {
            console.log('Cleaning up booking subscriptions');
            if (channels.booking) supabase.removeChannel(channels.booking);
            if (channels.notification) supabase.removeChannel(channels.notification);
            if (channels.broadcast) supabase.removeChannel(channels.broadcast);
        };
    }, []);

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

            // Fetch bookings with trips + ride_payments (via booking_id FK)
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
                    ride_payments (
                        id,
                        total_amount,
                        payment_status,
                        cashfree_order_id
                    )
                `)
                .eq('passenger_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch driver profiles separately from the profiles table
            const driverIds = [...new Set((data || []).map(b => b.driver_id).filter(Boolean))];
            let driverProfilesMap = {};

            if (driverIds.length > 0) {
                const { data: driverProfiles } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('id', driverIds);

                if (driverProfiles) {
                    driverProfiles.forEach(p => {
                        driverProfilesMap[p.id] = p;
                    });
                }
            }

            // ✅ FIX: Map the data with driver details + payment info
            // Normalize trips and ride_payment ONCE here, then pre-compute the total amount
            // so JSX never has to deal with raw arrays or re-evaluate shape at render time.
            const bookingsWithDetails = (data || []).map(booking => {
                const driverProfile = driverProfilesMap[booking.driver_id] || null;

                // Normalize trips — Supabase can return array or object depending on query shape
                const trip = Array.isArray(booking.trips)
                    ? booking.trips[0]
                    : booking.trips;

                // Normalize ride_payments — it's a one-to-one via FK but comes as array
                const ridePayment = Array.isArray(booking.ride_payments)
                    ? booking.ride_payments[0]
                    : booking.ride_payments;

                // ✅ FIX: Use explicit ternary + Number() conversion
                // Avoids issues where ridePayment is null (record not created yet)
                // and Supabase returns numeric columns as strings e.g. "150.00"
                const pricePerSeat = Number(trip?.price_per_seat) || 0;
                const seats = Number(booking.seats_requested) || 1;
                const computedTotal = ridePayment?.total_amount
                    ? Number(ridePayment.total_amount)
                    : pricePerSeat * seats;

                console.log('[DEBUG] booking:', booking.id,
                    '| price_per_seat:', pricePerSeat,
                    '| seats:', seats,
                    '| ridePayment?.total_amount:', ridePayment?.total_amount,
                    '| computedTotal:', computedTotal
                ); // ← remove this log after confirming the fix works

                return {
                    ...booking,
                    trips: trip,                    // ✅ always a plain object now
                    ride_payment: ridePayment || null,
                    computed_total: computedTotal,  // ✅ single source of truth for amount
                    otp: booking.otp_code || null,
                    driver_details: driverProfile ? {
                        id: driverProfile.id,
                        full_name: driverProfile.full_name,
                        phone: driverProfile.phone_number || driverProfile.phone || '',
                        vehicle_type: driverProfile.vehicle_type,
                        vehicle_number: driverProfile.vehicle_number
                    } : null,
                    driver_name: driverProfile?.full_name || 'Driver'
                };
            });

            console.log('[MyBookings] Fetched', bookingsWithDetails.length, 'bookings');
            setBookings(bookingsWithDetails);
        } catch (error) {
            console.error('[MyBookings] Error fetching bookings:', error);
            toast.error('Failed to load bookings');
        } finally {
            setLoading(false);
        }
    };

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

    const getStatusIcon = (booking) => {
        if (booking.trips && isTripPast(booking.trips.travel_date) && booking.trips.status !== 'completed') {
            return <XCircle size={18} className="status-icon cancelled" />;
        }
        switch (booking.status) {
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
        if (booking.trips && isTripPast(booking.trips.travel_date) && booking.trips.status !== 'completed') {
            return 'Trip Expired';
        }
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
                                        {getStatusIcon(booking)}
                                        <span>{getStatusText(booking)}</span>
                                    </div>

                                    {/* Conditionally Render Content Based on Status */}
                                    {((booking.status === 'approved' && booking.trips?.status !== 'completed') || booking.trips?.status === 'in_progress') && !(booking.trips && isTripPast(booking.trips.travel_date) && booking.trips?.status !== 'completed') ? (
                                        <div className="active-trip-enhanced-details" onClick={(e) => {
                                            e.stopPropagation();
                                            if (onViewDetails) onViewDetails(booking);
                                        }}>
                                            {/* Active Trip Banner */}
                                            <div className="active-trip-banner" style={{ marginTop: '1rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#eef2ff', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4f46e5', fontWeight: '600' }}>
                                                <div className="pulse-dot" style={{ width: '10px', height: '10px', backgroundColor: '#4f46e5', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                                                <span>{booking.trips?.status === 'in_progress' ? 'Your trip is active now' : 'Your trip is approved'}</span>
                                            </div>

                                            {/* Map Placeholder */}
                                            <div className="mini-map-container" style={{ marginBottom: '1rem' }}>
                                                <div className="mini-map-overlay">
                                                    <MapPin size={24} className="map-pin-icon" />
                                                    <span>View Route on Map</span>
                                                </div>
                                                <img
                                                    src={`https://maps.googleapis.com/maps/api/staticmap?size=400x150&path=color:0x2563eb|weight:4|${encodeURIComponent(booking.trips?.from_location)}|${encodeURIComponent(booking.trips?.to_location)}&markers=color:green|label:A|${encodeURIComponent(booking.trips?.from_location)}&markers=color:red|label:B|${encodeURIComponent(booking.trips?.to_location)}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}`}
                                                    alt="Trip Route Map"
                                                    className="mini-map-image"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                        e.target.nextSibling.style.display = 'flex';
                                                    }}
                                                />
                                                <div className="mini-map-fallback" style={{ display: 'none' }}>
                                                    <MapPin size={24} color="#94a3b8" />
                                                    <span>Map Unavailable</span>
                                                </div>
                                            </div>

                                            {/* Driver Info Card */}
                                            {booking.driver_details && (
                                                <div className="driver-info-card" style={{ marginBottom: '1rem' }}>
                                                    <div className="card-header">
                                                        <User size={18} />
                                                        <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Driver Information</h3>
                                                    </div>
                                                    <div className="driver-main">
                                                        <div className="avatar">
                                                            {booking.driver_name?.charAt(0) || 'D'}
                                                        </div>
                                                        <div className="details">
                                                            <h4>{booking.driver_name}</h4>
                                                            {booking.driver_details.vehicle_number ? (
                                                                <p>{booking.driver_details.vehicle_type || 'Vehicle'} ({booking.driver_details.vehicle_number})</p>
                                                            ) : (
                                                                <p>{booking.driver_details.vehicle_type || 'Vehicle'}</p>
                                                            )}
                                                            {booking.driver_details.phone && (
                                                                <p className="driver-phone-text">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                                                    <a href={`tel:${booking.driver_details.phone}`} className="phone-link" onClick={(e) => e.stopPropagation()}>{booking.driver_details.phone}</a>
                                                                </p>
                                                            )}
                                                        </div>
                                                        {booking.driver_details.phone && (
                                                            <button className="call-btn" onClick={(e) => {
                                                                e.stopPropagation();
                                                                window.location.href = `tel:${booking.driver_details.phone}`;
                                                            }}>
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* OTP Display — visible for approved AND in_progress (passenger needs to show driver) */}
                                            {booking.otp && booking.trips?.status !== 'completed' && (
                                                <div className="otp-section" style={{ marginBottom: '1rem' }}>
                                                    <span className="otp-label">Your Trip OTP:</span>
                                                    <span className="otp-code">{booking.otp}</span>
                                                    <span className="otp-note">
                                                        {booking.trips?.status === 'in_progress'
                                                            ? 'Show this to your driver to verify your ride'
                                                            : 'Share this with your driver when the trip starts'}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Waiting for OTP — trip is today but driver hasn't generated OTP yet */}
                                            {!booking.otp && booking.status === 'approved' && booking.trips?.status !== 'in_progress' && booking.trips?.status !== 'completed' && isTripToday(booking.trips?.travel_date) && (
                                                <div className="otp-section" style={{ marginBottom: '1rem', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #f59e0b', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                                                    <span className="otp-label" style={{ color: '#b45309', fontSize: '0.85rem', fontWeight: 600 }}>⏳ Waiting for OTP</span>
                                                    <span className="otp-note" style={{ color: '#92400e', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                                                        Your driver will generate the OTP before the trip starts. You'll be notified automatically.
                                                    </span>
                                                </div>
                                            )}

                                            {/* ✅ FIX: Pay Now — uses pre-computed amount, no inline IIFE or array checks */}
                                            {booking.status === 'approved' && booking.trips?.status !== 'completed' && (
                                                <div className="active-trip-pay-section" style={{ marginTop: '0', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                                                    <button
                                                        className="pay-now-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const rp = booking.ride_payment;
                                                            if (onPaymentRequired) {
                                                                onPaymentRequired({
                                                                    payment_id: rp?.id,
                                                                    booking_id: booking.id,
                                                                    amount: booking.computed_total, // ✅ clean pre-computed value
                                                                    cashfree_order_id: rp?.cashfree_order_id
                                                                });
                                                            } else if (onViewDetails) {
                                                                onViewDetails(booking);
                                                            }
                                                        }}
                                                    >
                                                        {/* ✅ FIX: single reliable source, no IIFE fallback needed */}
                                                        Pay ₹{booking.computed_total}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Generic Trip Info for Pending/Cancelled */
                                        booking.trips && (
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

                                                {/* Passenger Pickup Location */}
                                                {booking.passenger_location && (
                                                    <div className="pickup-info">
                                                        <MapPin size={14} style={{ color: '#22c55e' }} />
                                                        <span>Pickup: {booking.passenger_location}</span>
                                                    </div>
                                                )}

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
                                                    {/* ✅ FIX: use computed_total for pending/cancelled view too */}
                                                    {booking.computed_total > 0 && (
                                                        <div className="detail-row total">
                                                            <span>Total:</span>
                                                            <span>₹{booking.computed_total}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )
                                    )}

                                    {/* Actions */}
                                    <div className="booking-actions">
                                        {(booking.status === 'pending' || (booking.status === 'approved' && booking.trips?.status !== 'completed')) && (
                                            <button
                                                className="btn-cancel"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCancelBooking(booking.id);
                                                }}
                                            >
                                                Cancel {booking.status === 'approved' ? 'Ride' : 'Request'}
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