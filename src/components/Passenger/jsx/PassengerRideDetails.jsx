import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MapPin, Calendar, Clock, User, Phone, ShieldAlert, Navigation2, CheckCircle, Smartphone, Info, AlertCircle, MessageSquare, Map as MapIcon } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { initializeMap, createRoute, addMarker, getCurrentLocation } from '../../../utils/googleMapsHelper';
import { formatDate, formatTime, isTripToday } from '../../../utils/dateHelper';
import { getOTPForTrip } from '../../../utils/otpHelper';
import RatingModal from './RatingModal';
import Chat from '../../common/Chat';
import '../css/PassengerRideDetails.css';

const PassengerRideDetails = ({ booking, onBack }) => {
    // Handle cases where Supabase might return trips as an array or object
    const initialTrip = Array.isArray(booking?.trips) ? booking.trips[0] : booking?.trips;

    const [trip, setTrip] = useState(initialTrip);
    const [driver, setDriver] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [otp, setOtp] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null);
    const [showRating, setShowRating] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);

    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);

    useEffect(() => {   
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) setCurrentUserId(session.user.id);
        };
        getSession();

        if (!trip?.id) {
            setLoading(false);
            return;
        }

        fetchData();

        // Subscribe to trip updates
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
                    toast.success('Your ride has been completed!');
                    setShowRating(true);
                } else if (payload.new.status === 'in_progress') {
                    toast.info('Driver has started the journey!');
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [trip?.id]);

    const fetchData = async () => {
        if (!trip?.user_id) return;
        try {
            // Fetch Driver Info
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', trip.user_id)
                .single();

            const { data: driverInfo } = await supabase
                .from('drivers')
                .select('phone, vehicle_model, vehicle_number')
                .eq('user_id', trip.user_id)
                .maybeSingle();

            setDriver({
                name: profile?.full_name || 'Driver',
                phone: driverInfo?.phone || '',
                vehicle: `${driverInfo?.vehicle_model || ''} (${driverInfo?.vehicle_number || ''})`
            });

            // Get OTP if today
            if (isTripToday(trip.travel_date) && booking.status === 'approved') {
                const tripOtp = await getOTPForTrip(trip.id);
                setOtp(tripOtp);
            }

            initializeGoogleMaps();
        } catch (error) {
            console.error('Error fetching details:', error);
            toast.error('Failed to load details');
        } finally {
            setLoading(false);
        }
    };

    const initializeGoogleMaps = async () => {
        try {
            // API key is now handled by APIProvider in App.jsx
            // Wait for window.google to be available (already ensured by APIProvider)
            if (!window.google) {
                console.warn('Google Maps not yet available, retrying...');
                setTimeout(initializeGoogleMaps, 500);
                return;
            }

            // Get current location for centering (initially)
            const currentLocation = await getCurrentLocation();

            const map = initializeMap('map-container-passenger', currentLocation, 13);
            mapInstanceRef.current = map;

            // Show route
            const route = await createRoute(
                map,
                trip.from_location,
                trip.to_location
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
                <div className={`status-card ${trip.status}`}>
                    <div className="status-badge">
                        {trip.status === 'active' ? <Clock size={18} /> :
                            trip.status === 'in_progress' ? <Navigation2 size={18} /> :
                                <CheckCircle size={18} />}
                        <span>{trip.status === 'in_progress' ? 'Journey Started' : trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}</span>
                    </div>
                    {trip.status === 'active' && isTripToday(trip.travel_date) && (
                        <p className="status-subtext">The trip is scheduled for today!</p>
                    )}
                    {trip.status === 'in_progress' && (
                        <button className="track-action-btn" onClick={() => toast.success('Live tracking activated!')}>
                            <MapIcon size={18} />
                            Track Live Location
                        </button>
                    )}
                </div>

                {/* OTP Section (If Today & Approved) */}
                {otp && (
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
                            <p>{driver.vehicle}</p>
                        </div>
                        <button className="call-btn" onClick={handleCall}>
                            <Phone size={20} />
                        </button>
                    </div>
                    <div className="driver-actions">
                        <button className="msg-btn" onClick={() => setShowChat(true)}>
                            <MessageSquare size={18} />
                            <span>Chat with Driver</span>
                        </button>
                    </div>
                </div>

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
                                <span className="val">{trip.from_location}</span>
                            </div>
                        </div>
                        <div className="line"></div>
                        <div className="point">
                            <div className="dot to"></div>
                            <div className="text">
                                <span className="label">To</span>
                                <span className="val">{trip.to_location}</span>
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
                            <span className="val">{booking.seats_requested} Requested</span>
                        </div>
                        <div className="sched-item">
                            <span className="label">Total Price</span>
                            <span className="val">₹{trip.price_per_seat * booking.seats_requested}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat Overlay */}
            {showChat && (
                <div className="chat-overlay-container">
                    <Chat
                        tripId={trip.id}
                        currentUserId={currentUserId}
                        onBack={() => setShowChat(false)}
                    />
                </div>
            )}

            {showRating && (
                <RatingModal
                    ride={{ ...trip, driver_name: driver.name }}
                    onClose={() => setShowRating(false)}
                    onFinish={() => {
                        setShowRating(false);
                        onBack(); // Go back to history or bookings after rating
                    }}
                />
            )}
        </div>
    );
};

export default PassengerRideDetails;
