import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MapPin, Calendar, Clock, User, Phone, ShieldAlert, Navigation2, CheckCircle, Smartphone, Info, AlertCircle, MessageSquare, Map as MapIcon, X, XCircle } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { initializeMap, createRoute, addMarker, getCurrentLocation } from '../../../utils/googleMapsHelper';
import { formatDate, formatTime, isTripToday, isTripPast } from '../../../utils/dateHelper';
import { getOTPForTrip } from '../../../utils/otpHelper';
import UnifiedRatingModal from '../../common/jsx/UnifiedRatingModal';
import Chat from '../../common/Chat';
import { liveTrackingService } from '../../../services/tracking/LiveTrackingService';
import PaymentScreen from './PaymentScreen';
import '../css/PassengerRideDetails.css';

const PassengerRideDetails = ({ booking, onBack, onPaymentRequired }) => {
    // Handle cases where Supabase might return trips as an array or object
    const initialTrip = Array.isArray(booking?.trips) ? booking.trips[0] : booking?.trips;

    const [bookingDetails, setBookingDetails] = useState(booking);
    const [trip, setTrip] = useState(initialTrip);
    const [driver, setDriver] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [otp, setOtp] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null);
    const [showRating, setShowRating] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [isPaid, setIsPaid] = useState(booking?.ride_payment?.payment_status === 'paid');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentModalData, setPaymentModalData] = useState(null);

    const isExpired = trip && isTripPast(trip.travel_date) && trip.status !== 'completed';

    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const driverMarkerRef = useRef(null);

    // Keep bookingDetails in sync with booking prop changes
    useEffect(() => {
        setBookingDetails(booking);
        if (booking?.ride_payment?.payment_status === 'paid') {
            setIsPaid(true);
        }
    }, [booking]);

    // Fetch booking, trip, driver and route details
    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) setCurrentUserId(session.user.id);
        };
        getSession();

        const loadData = async () => {
            setLoading(true);
            let currentBooking = booking;

            // If the booking does not have trip details populated, fetch from Supabase
            if (booking?.id && (!booking.trips || !booking.driver_id)) {
                try {
                    console.log('[PassengerRideDetails] Fetching full booking details for:', booking.id);
                    const { data, error } = await supabase
                        .from('booking_requests')
                        .select(`
                            *,
                            trips (
                                *
                            ),
                            ride_payments (
                                *
                            )
                        `)
                        .eq('id', booking.id)
                        .maybeSingle();

                    if (error) throw error;
                    if (data) {
                        currentBooking = {
                            ...data,
                            trips: Array.isArray(data.trips) ? data.trips[0] : data.trips,
                            ride_payment: Array.isArray(data.ride_payments) ? data.ride_payments[0] : data.ride_payments
                        };
                        setBookingDetails(currentBooking);
                    }
                } catch (err) {
                    console.error('[PassengerRideDetails] Error fetching booking details:', err);
                }
            } else {
                setBookingDetails(booking);
            }

            const resolvedTrip = Array.isArray(currentBooking?.trips) ? currentBooking.trips[0] : currentBooking?.trips;

            if (!resolvedTrip?.id) {
                setLoading(false);
                return;
            }

            setTrip(resolvedTrip);
            await fetchDriverAndExtraData(currentBooking, resolvedTrip);
        };

        loadData();
    }, [booking?.id]);

    // Real-time subscription to trip updates and live tracking
    useEffect(() => {
        if (!trip?.id) return;

        const subscription = supabase
            .channel(`trip_${trip.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'trips',
                filter: `id=eq.${trip.id}`
            }, (payload) => {
                const updatedTrip = Array.isArray(payload.new) ? payload.new[0] : payload.new;
                setTrip(updatedTrip);

                if (updatedTrip.status === 'completed') {
                    liveTrackingService.stopTracking(); // Stop listening
                    toast.success('Your ride has been completed!');
                    
                    const ratedTrips = JSON.parse(localStorage.getItem('rated_trips') || '{}');
                    if (!ratedTrips[trip.id]) {
                        setShowRating(true);
                    }
                } else if (updatedTrip.status === 'in_progress' && trip?.status !== 'in_progress') {
                    toast.info('Driver has started the journey!');
                }
            })
            .subscribe();

        // Handle Live Tracking
        const isExpiredTrip = isTripPast(trip.travel_date) && trip.status !== 'completed';
        if (!isExpiredTrip && trip.status === 'in_progress') {
            liveTrackingService.startTracking(trip.id, (location) => {
                if (!mapInstanceRef.current) return;

                // Update or create driver marker on map
                if (driverMarkerRef.current) {
                    if (driverMarkerRef.current.setPosition) {
                        driverMarkerRef.current.setPosition(location);
                    } else {
                        driverMarkerRef.current.position = location;
                    }
                } else {
                    driverMarkerRef.current = addMarker(
                        mapInstanceRef.current,
                        location,
                        'Driver Location',
                        'https://maps.google.com/mapfiles/kml/shapes/cabs.png' // Simple car icon
                    );
                }
            }, 'passenger');
        }

        return () => {
            supabase.removeChannel(subscription);
            liveTrackingService.stopTracking();
        };
    }, [trip?.id, trip?.status]);

    // Listen for passenger_dropped and ride_started broadcasts
    useEffect(() => {
        if (!currentUserId || !trip?.id) return;

        const passengerChannel = supabase
            .channel(`passenger_${currentUserId}`)
            .on('broadcast', { event: 'passenger_dropped' }, (payload) => {
                if (payload.payload?.trip_id === trip.id) {
                    toast.success(payload.payload.message || 'You have been dropped off!');
                    liveTrackingService.stopTracking();
                    if (payload.payload?.amount > 0 && payload.payload?.payment_id && onPaymentRequired) {
                        onPaymentRequired(payload.payload);
                    } else {
                        const ratedTrips = JSON.parse(localStorage.getItem('rated_trips') || '{}');
                        if (!ratedTrips[trip.id]) {
                            setShowRating(true);
                        }
                    }
                }
            })
            .on('broadcast', { event: 'ride_started' }, (payload) => {
                if (payload.payload?.trip_id === trip.id) {
                    toast.success('🚗 Your ride has started! Track your driver in real-time.');
                }
            })
            .on('broadcast', { event: 'ride_otp' }, (payload) => {
                if (payload.payload?.trip_id === trip.id && payload.payload?.otp) {
                    setOtp(payload.payload.otp);
                    toast.success(`🔐 Your OTP: ${payload.payload.otp}. Share it with your driver!`, { duration: 10000 });
                }
            })
            .on('broadcast', { event: 'payment_received' }, (payload) => {
                if (payload.payload?.trip_id === trip.id) {
                    toast.success('💸 Payment confirmed by driver!');
                    setIsPaid(true);
                    if (bookingDetails) {
                        fetchDriverAndExtraData(bookingDetails, trip);
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(passengerChannel);
        };
    }, [currentUserId, trip?.id]);

    const fetchDriverAndExtraData = async (currentBooking, resolvedTrip) => {
        // Use driver_details from booking if available (passed from MyBookings)
        const bookingDriverDetails = currentBooking?.driver_details;

        // Try fetching fresh driver info from profiles table using driver_id or trip.user_id
        const driverId = currentBooking?.driver_id || resolvedTrip?.user_id;

        if (driverId) {
            try {
                // Fetch from profiles table first
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, phone_number, vehicle_type, vehicle_number')
                    .eq('id', driverId)
                    .single();

                // Also fetch from drivers table (more reliable for vehicle_number)
                const { data: driverRecord } = await supabase
                    .from('drivers')
                    .select('vehicle_number, phone')
                    .eq('user_id', driverId)
                    .maybeSingle();

                const resolvedPhone =
                    profile?.phone_number ||
                    driverRecord?.phone ||
                    bookingDriverDetails?.phone ||
                    '';

                const resolvedVehicleNumber =
                    profile?.vehicle_number ||
                    driverRecord?.vehicle_number ||
                    bookingDriverDetails?.vehicle_number ||
                    '';

                const resolvedVehicleType =
                    profile?.vehicle_type ||
                    bookingDriverDetails?.vehicle_type ||
                    '';

                const resolvedName =
                    profile?.full_name ||
                    bookingDriverDetails?.full_name ||
                    'Driver';

                setDriver({
                    name: resolvedName,
                    phone: resolvedPhone,
                    vehicle_type: resolvedVehicleType,
                    vehicle_number: resolvedVehicleNumber,
                    vehicle: resolvedVehicleNumber
                        ? `${resolvedVehicleType || 'Vehicle'} (${resolvedVehicleNumber})`
                        : (resolvedVehicleType || '')
                });
            } catch (error) {
                console.error('Error fetching driver profile:', error);
                // Fallback to booking data
                if (bookingDriverDetails) {
                    setDriver({
                        name: bookingDriverDetails.full_name || 'Driver',
                        phone: bookingDriverDetails.phone || '',
                        vehicle_type: bookingDriverDetails.vehicle_type || '',
                        vehicle_number: bookingDriverDetails.vehicle_number || '',
                        vehicle: bookingDriverDetails.vehicle_number
                            ? `${bookingDriverDetails.vehicle_type || 'Vehicle'} (${bookingDriverDetails.vehicle_number})`
                            : (bookingDriverDetails.vehicle_type || '')
                    });
                } else {
                    setDriver({ name: 'Driver', phone: '', vehicle: '', vehicle_type: '', vehicle_number: '' });
                }
            }
        } else if (bookingDriverDetails) {
            setDriver({
                name: bookingDriverDetails.full_name || 'Driver',
                phone: bookingDriverDetails.phone || '',
                vehicle_type: bookingDriverDetails.vehicle_type || '',
                vehicle_number: bookingDriverDetails.vehicle_number || '',
                vehicle: bookingDriverDetails.vehicle_number
                    ? `${bookingDriverDetails.vehicle_type || 'Vehicle'} (${bookingDriverDetails.vehicle_number})`
                    : (bookingDriverDetails.vehicle_type || '')
            });
        } else {
            setDriver({ name: 'Driver', phone: '', vehicle: '', vehicle_type: '', vehicle_number: '' });
        }

        try {
            // Get OTP from booking object directly
            const finalOtp = currentBooking.otp || currentBooking.otp_code || resolvedTrip?.otp_code;
            if (resolvedTrip?.id && currentBooking.status === 'approved' && finalOtp) {
                setOtp(finalOtp);
            }

            initializeGoogleMaps(resolvedTrip);
            
            // Check if trip is already completed when opening details
            if (resolvedTrip?.status === 'completed') {
                const ratedTrips = JSON.parse(localStorage.getItem('rated_trips') || '{}');
                if (!ratedTrips[resolvedTrip.id]) {
                    setShowRating(true);
                }
            }
        } catch (error) {
            console.error('Error fetching additional details:', error);
        } finally {
            setLoading(false);
        }
    };

    const initializeGoogleMaps = async (tripInfo) => {
        try {
            // API key is now handled by APIProvider in App.jsx
            // Wait for window.google to be available (already ensured by APIProvider)
            if (!window.google) {
                console.warn('Google Maps not yet available, retrying...');
                setTimeout(() => initializeGoogleMaps(tripInfo), 500);
                return;
            }

            // Get current location for centering (initially)
            const currentLocation = await getCurrentLocation();

            const map = initializeMap('map-container-passenger', currentLocation, 13);
            mapInstanceRef.current = map;

            // Show route
            const route = await createRoute(
                map,
                tripInfo.from_location,
                tripInfo.to_location
            );

            setRouteInfo(route);
            setMapLoaded(true);
        } catch (error) {
            console.error('Map error:', error);
        }
    };

    const handleCall = () => {
        if (driver?.phone) {
            window.location.href = `tel:${driver.phone}`;
        } else {
            toast.error('Phone number not available');
        }
    };

    const handleSOS = () => {
        toast.error('SOS Activated! Safety team and emergency contacts notified.');
    };

    if (loading) {
        return (
            <div className="ride-details-passenger-container">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading ride details...</p>
                </div>
            </div>
        );
    }

    if (!trip) {
        return (
            <div className="ride-details-passenger-container">
                <div className="details-header">
                    <button className="back-btn" onClick={onBack}>
                        <ArrowLeft size={24} />
                    </button>
                    <h1>Ride Details</h1>
                </div>
                <div className="empty-state">
                    <AlertCircle size={48} color="#ef4444" />
                    <h3>Details Unavailable</h3>
                    <p>We couldn't load the details for this ride. It might have been removed.</p>
                    <button className="back-home-btn" onClick={onBack}>Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="ride-details-passenger-container">
            {/* Header */}
            <div className="details-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1>Ride Details</h1>
                <button className="sos-btn" onClick={handleSOS}>
                    <ShieldAlert size={20} />
                </button>
            </div>

            {/* Map Section */}
            <div className="map-section">
                <div id="map-container-passenger" className="map-container"></div>
                {routeInfo && (
                    <div className="route-stats">
                        <div className="stat">
                            <Navigation2 size={16} />
                            <span>{routeInfo.distance}</span>
                        </div>
                        <div className="stat">
                            <Clock size={16} />
                            <span>{routeInfo.duration}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Scrollable */}
            <div className="details-content">
                {/* Status Card */}
                <div className={`status-card ${isExpired ? 'expired' : trip.status}`}>
                    <div className="status-badge">
                        {isExpired ? <XCircle size={18} /> :
                            trip.status === 'active' ? <Clock size={18} /> :
                                trip.status === 'in_progress' ? <Navigation2 size={18} /> :
                                    <CheckCircle size={18} />}
                        <span>{isExpired ? 'Trip Expired' : trip.status === 'in_progress' ? 'Journey Started' : trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}</span>
                    </div>
                    {isExpired ? (
                        <p className="status-subtext">This trip travel date has passed.</p>
                    ) : (
                        <>
                            {trip.status === 'active' && isTripToday(trip.travel_date) && (
                                <p className="status-subtext">The trip is scheduled for today!</p>
                            )}
                            {trip.status === 'in_progress' && (
                                <div className="status-subtext" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '12px' }}>
                                    <div className="tracking-dot animate-pulse"></div>
                                    <span>Live Tracking Enabled</span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* OTP Section (If Today & Approved) */}
                {!isExpired && otp && (
                    <div className="otp-card">
                        <div className="otp-info">
                            <Smartphone size={28} />
                            <div>
                                <h3>Trip Code (OTP)</h3>
                                <p>Share this with the driver to start the ride</p>
                            </div>
                        </div>
                        <div className="otp-code">{otp}</div>
                    </div>
                )}

                {/* Driver Info Card */}
                {driver && (
                    <div className="info-card">
                        <div className="card-header">
                            <User size={18} />
                            <h3>Driver Information</h3>
                        </div>
                        <div className="driver-main">
                            <div className="avatar">
                                {driver.name.charAt(0)}
                            </div>
                            <div className="details">
                                <h4>{driver.name}</h4>
                                {driver.vehicle && <p>{driver.vehicle}</p>}
                                {!isExpired && driver.phone && (
                                    <p className="driver-phone-text">
                                        <Phone size={14} />
                                        <a href={`tel:${driver.phone}`} className="phone-link">{driver.phone}</a>
                                    </p>
                                )}
                            </div>
                            {!isExpired && (
                                <button className="call-btn" onClick={handleCall}>
                                    <Phone size={20} />
                                </button>
                            )}
                        </div>
                        {!isExpired && (
                            <div className="driver-actions">
                                <button className="msg-btn" onClick={() => setShowChat(true)}>
                                    <MessageSquare size={18} />
                                    <span>Chat with Driver</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Route Info Card */}
                <div className="info-card">
                    <div className="card-header">
                        <MapPin size={18} />
                        <h3>Route</h3>
                    </div>
                    <div className="route-flow">
                        <div className="point">
                            <div className="dot from"></div>
                            <div className="text">
                                <span className="label">From</span>
                                <span className="val">{bookingDetails.passenger_location || trip.from_location}</span>
                            </div>
                        </div>
                        <div className="line"></div>
                        <div className="point">
                            <div className="dot to"></div>
                            <div className="text">
                                <span className="label">To</span>
                                <span className="val">{bookingDetails.passenger_destination || trip.to_location}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Schedule Card */}
                <div className="info-card">
                    <div className="card-header">
                        <Calendar size={18} />
                        <h3>Trip Details</h3>
                    </div>
                    <div className="schedule-grid">
                        <div className="sched-item">
                            <span className="label">Date</span>
                            <span className="val">{formatDate(trip.travel_date, 'medium')}</span>
                        </div>
                        <div className="sched-item">
                            <span className="label">Time</span>
                            <span className="val">{formatTime(trip.travel_time)}</span>
                        </div>
                        <div className="sched-item">
                            <span className="label">Seats</span>
                            <span className="val">{bookingDetails.seats_requested} Requested</span>
                        </div>
                        <div className="sched-item">
                            <span className="label">Total Price</span>
                            <span className="val">₹{(Number(bookingDetails.agreed_price) || trip.price_per_seat) * bookingDetails.seats_requested}</span>
                        </div>
                    </div>
                </div>

                {/* Active Trip Pay Now Section */}
                {!isExpired && trip.status === 'in_progress' && (
                    <div className="active-trip-pay-section">
                        <div className="active-trip-banner">
                            <div className="pulse-dot"></div>
                            <span>Your trip is active now</span>
                        </div>
                        {isPaid || bookingDetails?.ride_payment?.payment_status === 'paid' ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', background: '#ecfdf5', color: '#10b981', borderRadius: '12px', fontWeight: 'bold' }}>
                                <CheckCircle size={20} /> Payment Completed
                            </div>
                        ) : (
                            <button 
                                className="pay-now-btn" 
                                onClick={() => {
                                    if (onPaymentRequired) {
                                        onPaymentRequired({
                                            trip_id: trip.id,
                                            booking_id: bookingDetails.id, 
                                            amount: (Number(bookingDetails.agreed_price) || trip.price_per_seat) * bookingDetails.seats_requested,
                                            payment_id: bookingDetails?.payment_id || trip?.payment_id
                                        });
                                    } else {
                                        // Show inline payment modal (preferred)
                                        setPaymentModalData({
                                            trip_id: trip.id,
                                            booking_id: bookingDetails.id,
                                            amount: (Number(bookingDetails.agreed_price) || trip.price_per_seat) * bookingDetails.seats_requested,
                                            payment_id: bookingDetails?.payment_id || trip?.payment_id
                                        });
                                        setShowPaymentModal(true);
                                    }
                                }}
                            >
                                Pay Now
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Chat Overlay */}
            {showChat && (
                <div className="chat-overlay-container">
                    <Chat
                        tripId={bookingDetails?.trip_id || trip?.id}
                        currentUserId={currentUserId}
                        onBack={() => setShowChat(false)}
                    />
                </div>
            )}

            {showRating && (
                <UnifiedRatingModal
                    targetUser={{
                        id: bookingDetails?.driver_id || trip?.user_id,
                        name: driver?.name || 'Driver'
                    }}
                    tripId={trip.id}
                    onClose={() => setShowRating(false)}
                    onFinish={() => {
                        setShowRating(false);
                        onBack(); // Go back to history or bookings after rating
                    }}
                />
            )}

            {/* Inline Payment Modal Overlay */}
            {showPaymentModal && paymentModalData && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        backdropFilter: 'blur(4px)',
                        animation: 'fadeIn 0.2s ease',
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) setShowPaymentModal(false); }}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderTopLeftRadius: '1.5rem',
                            borderTopRightRadius: '1.5rem',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            animation: 'slideUp 0.3s cubic-bezier(0.22,1,0.36,1)',
                            boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
                            position: 'relative',
                        }}
                    >
                        {/* Drag handle bar */}
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
                            <div style={{ width: '40px', height: '4px', borderRadius: '99px', background: '#e5e7eb' }} />
                        </div>
                        {/* Close button */}
                        <button
                            onClick={() => setShowPaymentModal(false)}
                            style={{
                                position: 'absolute', top: '16px', right: '16px',
                                background: '#f3f4f6', border: 'none', borderRadius: '50%',
                                width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', cursor: 'pointer', zIndex: 10
                            }}
                        >
                            <X size={18} color="#6b7280" />
                        </button>
                        <PaymentScreen
                            paymentData={paymentModalData}
                            onBack={() => setShowPaymentModal(false)}
                            onPaymentComplete={() => {
                                setShowPaymentModal(false);
                                setIsPaid(true);
                                toast.success('Payment successful! 🎉');
                                
                                if (trip?.status === 'completed') {
                                    const ratedTrips = JSON.parse(localStorage.getItem('rated_trips') || '{}');
                                    if (!ratedTrips[trip.id]) {
                                        setTimeout(() => setShowRating(true), 500);
                                    }
                                }
                            }}
                        />
                    </div>
                    <style>{`
                        @keyframes slideUp {
                            from { transform: translateY(100%); opacity: 0; }
                            to { transform: translateY(0); opacity: 1; }
                        }
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
};

export default PassengerRideDetails;
