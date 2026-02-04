import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MapPin, Navigation2, Phone, MessageCircle, AlertTriangle, CheckCircle, Clock, ExternalLink, ShieldAlert, X, User, LogOut } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { loadGoogleMapsScript, initializeMap, createRoute, addMarker, getCurrentLocation } from '../../../utils/googleMapsHelper';
import Chat from '../../common/Chat';
import DriverRatingModal from './DriverRatingModal';
import '../css/ActiveRide.css';

const ActiveRide = ({ trip: initialTrip, onBack, onLogout }) => {
    const [trip, setTrip] = useState(initialTrip);
    const [passengers, setPassengers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [otpValue, setOtpValue] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [routeInfo, setRouteInfo] = useState(null);
    const [showChat, setShowChat] = useState(false);
    const [activeChatTripId, setActiveChatTripId] = useState(null);
    const [showRating, setShowRating] = useState(false);
    const [currentPassengerToRate, setCurrentPassengerToRate] = useState(null);
    const [sosActive, setSosActive] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);

    const mapInstanceRef = useRef(null);

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) setCurrentUserId(session.user.id);
        };
        getSession();

        fetchTripData();
        initializeGoogleMaps();

        // Subscribe to actual trip updates
        const tripSubscription = supabase
            .channel(`active_trip_${trip.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'trips',
                filter: `id=eq.${trip.id}`
            }, (payload) => {
                if (payload.new) setTrip(payload.new);
            })
            .subscribe();

        // Subscribe to booking requests changes
        const bookingsSubscription = supabase
            .channel(`trip_bookings_${trip.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'booking_requests',
                filter: `trip_id=eq.${trip.id}`
            }, () => {
                fetchTripData(); // Refresh passengers list
            })
            .subscribe();

        return () => {
            supabase.removeChannel(tripSubscription);
            supabase.removeChannel(bookingsSubscription);
        };
    }, [trip.id]);

    const fetchTripData = async () => {
        try {
            const { data: bookings, error } = await supabase
                .from('booking_requests')
                .select(`
                    id,
                    seats_requested,
                    status,
                    passenger_id,
                    profiles:passenger_id (
                        full_name,
                        id
                    )
                `)
                .eq('trip_id', trip.id)
                .eq('status', 'approved');

            if (error) throw error;
            setPassengers(bookings || []);
        } catch (error) {
            console.error('Error fetching passengers:', error);
            toast.error('Failed to load passengers');
        } finally {
            setLoading(false);
        }
    };

    const initializeGoogleMaps = async () => {
        try {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            if (!apiKey) return;

            await loadGoogleMapsScript(apiKey);
            const currentLocation = await getCurrentLocation();

            const map = initializeMap('active-ride-map', currentLocation, 14);
            mapInstanceRef.current = map;

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

    const handleVerifyOtp = async () => {
        if (!otpValue) {
            toast.error('Please enter OTP');
            return;
        }

        setIsVerifying(true);
        try {
            const { data, error } = await supabase
                .from('trips')
                .update({ status: 'in_progress' })
                .eq('id', trip.id)
                .eq('otp_code', otpValue)
                .select();

            if (error || !data.length) {
                toast.error('Invalid OTP code');
            } else {
                toast.success('OTP Verified! Drive safely.');
                setTrip(data[0]);
            }
        } catch (error) {
            toast.error('Verification failed');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleCompleteRide = async () => {
        try {
            const { error } = await supabase
                .from('trips')
                .update({ status: 'completed' })
                .eq('id', trip.id);

            if (error) throw error;

            toast.success('Trip completed!');

            // Trigger passenger rating for each passenger
            if (passengers.length > 0) {
                setCurrentPassengerToRate({
                    id: trip.id,
                    passenger_id: passengers[0].passenger_id,
                    passenger_name: passengers[0].profiles?.full_name
                });
                setShowRating(true);
            } else {
                onBack();
            }
        } catch (error) {
            toast.error('Failed to complete trip');
        }
    };

    const handleCall = (phone) => {
        if (phone) window.location.href = `tel:${phone}`;
        else toast.error('Phone not available');
    };

    const handleSOS = () => {
        setSosActive(!sosActive);
        if (!sosActive) {
            toast.error('SOS Activated! Alerts sent to emergency services.');
        }
    };

    const openNavigation = () => {
        const dest = encodeURIComponent(trip.to_location);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
    };

    return (
        <div className="active-ride-container animate-page-in">
            <header className="ride-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1>Active Ride</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className={`sos-btn ${sosActive ? 'active' : ''}`} onClick={handleSOS}>
                        <ShieldAlert size={20} />
                    </button>
                    {onLogout && (
                        <button
                            className="logout-btn-header"
                            onClick={onLogout}
                            style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '12px',
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                color: '#ef4444',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <LogOut size={18} />
                            Logout
                        </button>
                    )}
                </div>
            </header>

            <div className="map-section">
                <div id="active-ride-map" className="map-container"></div>
                {routeInfo && (
                    <div className="route-info-card">
                        <div className="route-stat">
                            <Navigation2 size={16} />
                            <span>{routeInfo.distance}</span>
                        </div>
                        <div className="route-stat">
                            <Clock size={16} />
                            <span>{routeInfo.duration}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="ride-content">
                <div className="navigation-card">
                    <div className="route-info-flow">
                        <div className="stop">
                            <div className="dot from"></div>
                            <span className="address">{trip.from_location}</span>
                        </div>
                        <div className="route-line"></div>
                        <div className="stop">
                            <div className="dot to"></div>
                            <span className="address">{trip.to_location}</span>
                        </div>
                    </div>
                    <button className="navigate-btn" onClick={openNavigation}>
                        <ExternalLink size={18} />
                        Start Google Navigation
                    </button>
                </div>

                {trip.status === 'active' && (
                    <div className="otp-section">
                        <h3>Start Journey</h3>
                        <p>Ask a passenger for the trip OTP to begin</p>
                        <div className="otp-input-group">
                            <input
                                type="text"
                                maxLength="4"
                                placeholder="0000"
                                value={otpValue}
                                onChange={(e) => setOtpValue(e.target.value)}
                            />
                            <button
                                className="verify-btn"
                                onClick={handleVerifyOtp}
                                disabled={isVerifying}
                            >
                                {isVerifying ? '...' : 'Verify'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="passengers-section">
                    <h3>Passengers ({passengers.length})</h3>
                    {passengers.length === 0 ? (
                        <p className="empty-text">No passengers for this ride yet.</p>
                    ) : (
                        passengers.map((p) => (
                            <div key={p.id} className="passenger-card-active">
                                <div className="p-info">
                                    <div className="p-avatar">{p.profiles?.full_name?.charAt(0) || <User size={20} />}</div>
                                    <div className="p-details">
                                        <h4>{p.profiles?.full_name}</h4>
                                        <span className="seats-count">{p.seats_requested} Seat(s)</span>
                                    </div>
                                </div>
                                <div className="p-actions">
                                    <button className="icon-btn-circle chat" onClick={() => {
                                        setActiveChatTripId(trip.id);
                                        setShowChat(true);
                                    }}>
                                        <MessageCircle size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {trip.status === 'in_progress' && (
                <div className="ride-footer">
                    <button className="complete-ride-btn" onClick={handleCompleteRide}>
                        <CheckCircle size={20} />
                        Finish Trip
                    </button>
                </div>
            )}

            {showChat && (
                <div className="chat-overlay-container">
                    <Chat
                        tripId={activeChatTripId}
                        currentUserId={currentUserId}
                        onBack={() => setShowChat(false)}
                    />
                </div>
            )}

            {showRating && currentPassengerToRate && (
                <DriverRatingModal
                    ride={currentPassengerToRate}
                    onClose={() => {
                        setShowRating(false);
                        onBack();
                    }}
                    onFinish={() => {
                        setShowRating(false);
                        onBack();
                    }}
                />
            )}
        </div>
    );
};

export default ActiveRide;
