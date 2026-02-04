import React, { useState, useEffect } from 'react';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, ArrowLeft, Search, Menu, User, BookOpen, Clock as HistoryIcon, CreditCard, ChevronRight, Calendar, Car, Bike, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../supabaseClient';
import '../css/PassengerHome.css';
import LocationInput from '../../common/LocationInput';

// Component to handle map centering and routing updates
const MapUpdater = ({ center, destination, onRouteInfo }) => {
    const map = useMap();
    const [directionsRenderer, setDirectionsRenderer] = useState(null);

    useEffect(() => {
        if (!map) return;

        if (center) {
            map.panTo(center);
        }
    }, [map, center]);

    useEffect(() => {
        if (!map) return;

        // Initialize DirectionsRenderer if not exists
        if (!directionsRenderer) {
            const dr = new window.google.maps.DirectionsRenderer({
                map,
                suppressMarkers: true,
                polylineOptions: {
                    strokeColor: 'black',
                    strokeWeight: 5,
                    strokeOpacity: 0.7
                }
            });
            setDirectionsRenderer(dr);
        }
    }, [map, directionsRenderer]);

    useEffect(() => {
        if (!directionsRenderer || !center || !destination) {
            if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
            return;
        }

        const directionsService = new window.google.maps.DirectionsService();
        directionsService.route(
            {
                origin: center,
                destination: destination,
                travelMode: window.google.maps.TravelMode.DRIVING
            },
            (result, status) => {
                if (status === window.google.maps.DirectionsStatus.OK) {
                    directionsRenderer.setDirections(result);
                    if (onRouteInfo) {
                        const route = result.routes[0].legs[0];
                        onRouteInfo({
                            distance: route.distance.text,
                            duration: route.duration.text
                        });
                    }
                } else {
                    console.error(`Directions request failed: ${status}`);
                    if (onRouteInfo) onRouteInfo(null);
                }
            }
        );
    }, [center, destination, directionsRenderer, onRouteInfo]);

    return null;
};

// Custom Toast Component for driver details
const DriverDetailsToast = ({ driver, trip, onViewDetails, onDismiss }) => {
    return (
        <div className="custom-toast">
            <div className="toast-header">
                <div className="toast-icon">🚗</div>
                <div>
                    <h4>Ride Accepted!</h4>
                    <p>Your ride from {trip.from} to {trip.to}</p>
                </div>
            </div>
            <div className="driver-toast-details">
                <div className="toast-row">
                    <span>Driver:</span>
                    <strong>{driver.name}</strong>
                </div>
                <div className="toast-row">
                    <span>Phone:</span>
                    <a href={`tel:${driver.phone}`} className="phone-link">
                        <Phone size={14} />
                        {driver.phone}
                    </a>
                </div>
                {driver.vehicle_type && (
                    <div className="toast-row">
                        <span>Vehicle:</span>
                        <span>
                            {driver.vehicle_type}
                            {driver.vehicle_number && ` (${driver.vehicle_number})`}
                        </span>
                    </div>
                )}
            </div>
            <div className="toast-actions">
                <button
                    className="toast-action-btn view-btn"
                    onClick={onViewDetails}
                >
                    <BookOpen size={16} />
                    View Booking
                </button>
                <button
                    className="toast-action-btn close-btn"
                    onClick={onDismiss}
                >
                    Dismiss
                </button>
            </div>
        </div>
    );
};

const PassengerHome = ({ onBack, onSearchTrips, onNavigate, onLogout }) => {
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [currentLocation, setCurrentLocation] = useState(null);
    const [pickupCoords, setPickupCoords] = useState(null);
    const [destinationCoords, setDestinationCoords] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeNotification, setActiveNotification] = useState(null);

    const getTodayDate = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [travelDate, setTravelDate] = useState(getTodayDate());
    const [vehiclePreference, setVehiclePreference] = useState('any');

    // Real-time notification setup
    useEffect(() => {
        const setupRealTimeNotifications = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            console.log('Setting up real-time notifications for passenger:', user.id);

            // Subscribe to booking approval notifications
            const channel = supabase.channel(`passenger_${user.id}`)
                .on('broadcast', { event: 'booking_approved' }, (payload) => {
                    console.log('Booking approved notification received:', payload);

                    const { trip, driver_info } = payload.payload;

                    // Set active notification to show custom toast
                    setActiveNotification({
                        driver: driver_info,
                        trip: trip,
                        booking_id: payload.payload.booking_id
                    });

                    // Also show a regular toast for quick notification
                    toast.custom((t) => (
                        <DriverDetailsToast
                            driver={driver_info}
                            trip={trip}
                            onViewDetails={() => {
                                toast.dismiss(t.id);
                                onNavigate('myBookings');
                            }}
                            onDismiss={() => toast.dismiss(t.id)}
                        />
                    ), {
                        duration: 10000, // 10 seconds
                        position: 'top-right',
                        id: `booking-approved-${payload.payload.booking_id}`
                    });
                })
                .on('broadcast', { event: 'booking_rejected' }, (payload) => {
                    console.log('Booking rejected notification received:', payload);

                    toast.error('❌ Your ride request was declined', {
                        duration: 5000,
                        position: 'top-right'
                    });
                })
                .subscribe((status) => {
                    console.log('Subscription status:', status);
                });

            // Also subscribe to notifications table changes
            const notificationSubscription = supabase
                .channel('passenger_notifications_table')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                }, (payload) => {
                    console.log('New notification from table:', payload);

                    if (payload.new.type === 'booking_accepted') {
                        const data = payload.new.data || {};
                        const driverInfo = typeof data === 'string' ? JSON.parse(data) : data;

                        setActiveNotification({
                            driver: driverInfo,
                            booking_id: payload.new.booking_id
                        });
                    }
                })
                .subscribe();

            return () => {
                console.log('Cleaning up real-time subscriptions');
                supabase.removeChannel(channel);
                supabase.removeChannel(notificationSubscription);
            };
        };

        const cleanup = setupRealTimeNotifications();

        return () => {
            cleanup.then(fn => fn && fn());
        };
    }, [onNavigate]);

    // Clear active notification after some time
    useEffect(() => {
        if (activeNotification) {
            const timer = setTimeout(() => {
                setActiveNotification(null);
            }, 15000); // Clear after 15 seconds

            return () => clearTimeout(timer);
        }
    }, [activeNotification]);

    // Geolocation setup
    useEffect(() => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setCurrentLocation({ lat: latitude, lng: longitude });
                setPickup("Current Location");
            },
            () => {
                toast.error("Please enable location access");
                setCurrentLocation({ lat: 19.0760, lng: 72.8777 }); // Default: Mumbai
            }
        );
    }, []);

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    const handleMenuClick = async (screen) => {
        setIsMenuOpen(false);
        console.log('Menu clicked:', screen);

        if (screen === 'logout') {
            console.log('Logout initiated from menu');
            if (onLogout) {
                console.log('Using onLogout prop');
                await onLogout();
            } else {
                console.log('onLogout prop not available, using direct logout');
                const { error } = await supabase.auth.signOut();
                if (error) {
                    console.error('Logout error:', error);
                    toast.error('Logout failed');
                } else {
                    console.log('Direct logout successful');
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = window.location.origin;
                }
            }
            return;
        }

        if (onNavigate) {
            console.log('Navigating to:', screen);
            onNavigate(screen);
        } else {
            console.error('onNavigate prop not available');
        }
    };

    const getCoordinates = async (placeId, callback) => {
        if (window.google && window.google.maps && window.google.maps.places) {
            try {
                const service = new window.google.maps.places.PlacesService(document.createElement('div'));
                service.getDetails({ placeId }, (place, status) => {
                    if (status === 'OK' && place.geometry && place.geometry.location) {
                        callback({
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng()
                        });
                        return;
                    }
                    fetchCoordsFromGeocoding(placeId, callback);
                });
            } catch (error) {
                console.error('PlacesService crashed:', error);
                fetchCoordsFromGeocoding(placeId, callback);
            }
        } else {
            fetchCoordsFromGeocoding(placeId, callback);
        }
    };

    const fetchCoordsFromGeocoding = async (placeId, callback) => {
        try {
            let url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${placeId}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.results && data.results[0]?.geometry?.location) {
                callback(data.results[0].geometry.location);
            } else {
                console.error('Geocoding API for Coords failed:', data.status);
                toast.error('Could not get location details');
            }
        } catch (error) {
            console.error('Geocoding API network error:', error);
        }
    };

    const handlePlaceSelect = (type, prediction) => {
        getCoordinates(prediction.place_id, (coords) => {
            if (type === 'pickup') {
                setPickupCoords(coords);
            } else {
                setDestinationCoords(coords);
            }
        });
    };

    const handleDropoffChange = (e) => {
        const val = e.target.value;
        setDropoff(val);
        if (!val) {
            setDestinationCoords(null);
            setRouteInfo(null);
        }
    };

    const handleViewBookingDetails = () => {
        if (onNavigate) {
            onNavigate('myBookings');
        }
        setActiveNotification(null);
    };

    const defaultCenter = { lat: 19.0760, lng: 72.8777 };

    return (
        <div className="passenger-home-container">
            {/* Active Notification Banner */}
            {activeNotification && (
                <div className="active-notification-banner">
                    <div className="banner-content">
                        <div className="banner-icon">🚗</div>
                        <div className="banner-text">
                            <h4>Ride Accepted!</h4>
                            <p>
                                Driver: <strong>{activeNotification.driver.name}</strong> •
                                Vehicle: <strong>{activeNotification.driver.vehicle_type}</strong>
                            </p>
                        </div>
                    </div>
                    <div className="banner-actions">
                        <a
                            href={`tel:${activeNotification.driver.phone}`}
                            className="banner-btn call-btn"
                        >
                            <Phone size={16} />
                            Call Driver
                        </a>
                        <button
                            className="banner-btn view-btn"
                            onClick={handleViewBookingDetails}
                        >
                            View Details
                        </button>
                        <button
                            className="banner-btn close-btn"
                            onClick={() => setActiveNotification(null)}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* Sidebar Menu */}
            <div className={`side-menu ${isMenuOpen ? 'open' : ''}`}>
                <div className="menu-header">
                    <User size={40} className="user-icon" />
                    <div className="user-info">
                        <h3>Hi there!</h3>
                        <p>Passenger</p>
                    </div>
                </div>
                <div className="menu-items">
                    <button onClick={() => handleMenuClick('passengerProfile')}>
                        <User size={20} />
                        <span>My Profile</span>
                        <ChevronRight size={16} />
                    </button>
                    <button onClick={() => handleMenuClick('myBookings')}>
                        <BookOpen size={20} />
                        <span>My Bookings</span>
                        <ChevronRight size={16} />
                    </button>
                    <button onClick={() => handleMenuClick('rideHistory')}>
                        <HistoryIcon size={20} />
                        <span>Ride History</span>
                        <ChevronRight size={16} />
                    </button>
                    <button onClick={() => handleMenuClick('paymentDetails')}>
                        <CreditCard size={20} />
                        <span>Payment Details</span>
                        <ChevronRight size={16} />
                    </button>
                </div>
                <div className="menu-footer">
                    <button
                        className="logout-btn"
                        onClick={() => handleMenuClick('logout')}
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* Overlay */}
            {isMenuOpen && <div className="menu-overlay" onClick={toggleMenu}></div>}

            {/* Header */}
            <div className="yellow-header">
                <div className="header-content">
                    <button className="menu-btn" onClick={toggleMenu}>
                        <Menu size={24} />
                    </button>
                    <div className="header-text">
                        <h1>Xpool</h1>
                        <h2>Find your ride</h2>
                    </div>
                </div>
            </div>

            <div className="floating-card">
                <LocationInput
                    name="pickup"
                    placeholder="Current Location"
                    value={pickup}
                    onChange={(e) => {
                        setPickup(e.target.value);
                        if (!e.target.value) setPickupCoords(null);
                    }}
                    onPlaceSelect={(p) => handlePlaceSelect('pickup', p)}
                    Icon={Navigation}
                    iconColor="gray"
                    className="input-group"
                />

                <div className="connector-line"></div>

                <LocationInput
                    name="dropoff"
                    placeholder="Search Destination"
                    value={dropoff}
                    onChange={handleDropoffChange}
                    onPlaceSelect={(p) => handlePlaceSelect('dropoff', p)}
                    Icon={MapPin}
                    iconColor="yellow"
                    className="input-group input-group-last"
                />

                <div className="filter-row-home">
                    <div className="filter-item">
                        <div className="icon-box-small">
                            <Calendar size={16} />
                        </div>
                        <input
                            type="date"
                            className="date-input-home"
                            value={travelDate}
                            onChange={(e) => setTravelDate(e.target.value)}
                            min={getTodayDate()}
                        />
                    </div>
                    <div className="vehicle-selector-home">
                        {['any', 'car', 'bike'].map(type => (
                            <button
                                key={type}
                                className={`vehicle-tab ${vehiclePreference === type ? 'active' : ''}`}
                                onClick={() => setVehiclePreference(type)}
                                title={type.charAt(0).toUpperCase() + type.slice(1)}
                            >
                                {type === 'any' && <span className="text-any">Any</span>}
                                {type === 'car' && <Car size={16} />}
                                {type === 'bike' && <Bike size={16} />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Map */}
            <div className="map-layer">
                {routeInfo && (
                    <div className="route-info-overlay">
                        <div className="info-item">
                            <span className="label">Distance:</span>
                            <span className="value">{routeInfo.distance}</span>
                        </div>
                        <div className="info-divider"></div>
                        <div className="info-item">
                            <span className="label">Time:</span>
                            <span className="value">{routeInfo.duration}</span>
                        </div>
                    </div>
                )}
                <Map
                    defaultCenter={defaultCenter}
                    defaultZoom={15}
                    mapId="XPOOL_MAP_ID"
                    gestureHandling={'greedy'}
                    disableDefaultUI={true}
                    className="map-container"
                    style={{ width: '100%', height: '100%' }}
                >
                    {(pickupCoords || currentLocation) && (
                        <>
                            <AdvancedMarker position={pickupCoords || currentLocation} />
                            <MapUpdater
                                center={pickupCoords || currentLocation}
                                destination={destinationCoords}
                                onRouteInfo={setRouteInfo}
                            />
                        </>
                    )}
                    {destinationCoords && (
                        <AdvancedMarker position={destinationCoords} />
                    )}
                </Map>
            </div>

            <div className="continue-btn-container">
                <button
                    className="search-trips-btn"
                    onClick={() => onSearchTrips({
                        from: pickup,
                        to: dropoff,
                        date: travelDate,
                        vehicle: vehiclePreference
                    })}
                >
                    <Search size={20} />
                    Find Pre-booked Trips
                </button>
            </div>
        </div>
    );
};

export default PassengerHome;