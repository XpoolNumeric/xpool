import React, { useState, useEffect, useCallback } from 'react';
import { Map, AdvancedMarker, useMap, APIProvider } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Search, Menu, User, BookOpen, Clock as HistoryIcon, CreditCard, ChevronRight, Calendar, Car, Bike, Phone, Bell, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../supabaseClient';
import { getCurrentLocation } from '../../../utils/googleMapsHelper';
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

const PassengerHome = ({ onBack, onSearchTrips, onNavigate, onLogout, session }) => {
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [currentLocation, setCurrentLocation] = useState(null);
    const [pickupCoords, setPickupCoords] = useState(null);
    const [destinationCoords, setDestinationCoords] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeNotification, setActiveNotification] = useState(null);

    // NEW STATES FOR DATA FETCHING
    const [passengerName, setPassengerName] = useState('Passenger');
    const [upcomingTrips, setUpcomingTrips] = useState([]);
    const [recentSearches, setRecentSearches] = useState([]);
    const [stats, setStats] = useState({
        upcomingTrips: 0,
        completedTrips: 0,
        pendingBookings: 0
    });
    const [loading, setLoading] = useState(false);

    const getTodayDate = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [travelDate, setTravelDate] = useState(getTodayDate());
    const [vehiclePreference, setVehiclePreference] = useState('any');

    // Memoized function to fetch passenger data
    const fetchPassengerData = useCallback(async () => {
        try {
            setLoading(true);

            // Use session prop first, fallback to direct auth call
            let user = session?.user || null;

            if (!user) {
                console.log('PassengerHome: No user in session prop, trying getUser()...');
                const { data: { user: fetchedUser }, error: userError } = await supabase.auth.getUser();

                if (userError) {
                    console.error('Error getting user:', userError);
                    // Don't show error toast on first mount - session might still be initializing
                    return;
                }
                user = fetchedUser;
            }

            if (!user) {
                console.log('PassengerHome: No user found from any source');
                return;
            }

            // Fetch passenger name from profiles
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .maybeSingle();

            if (profileError) {
                console.error('Error fetching profile:', profileError);
            }

            if (profile?.full_name) {
                setPassengerName(profile.full_name);
            } else {
                // Fallback to email name
                const emailName = user.email?.split('@')[0] || 'Passenger';
                setPassengerName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
            }

            // Fetch upcoming trips where passenger has bookings
            const { data: bookings, error: bookingsError } = await supabase
                .from('booking_requests')
                .select(`
                    id,
                    trip_id,
                    status,
                    seats_requested,
                    trips!inner(*)
                `)
                .eq('passenger_id', user.id)
                .in('status', ['confirmed', 'pending'])
                .order('created_at', { ascending: false })
                .limit(5);

            if (bookingsError) {
                console.error('Error fetching bookings:', bookingsError);
            }

            // Process upcoming trips from bookings
            if (bookings) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const upcoming = bookings
                    .filter(booking => {
                        if (!booking.trips) return false;
                        const tripDate = new Date(booking.trips.travel_date);
                        tripDate.setHours(0, 0, 0, 0);
                        return tripDate >= today ||
                            booking.trips.status === 'active' ||
                            booking.trips.status === 'in_progress';
                    })
                    .map(booking => ({
                        ...booking.trips,
                        booking_status: booking.status,
                        seats_booked: booking.seats_requested,
                        booking_id: booking.id,
                        total_price: booking.trips.price_per_seat * booking.seats_requested
                    }));

                setUpcomingTrips(upcoming);

                // Calculate stats
                const confirmedTrips = bookings.filter(b => b.status === 'confirmed');
                const pendingBookings = bookings.filter(b => b.status === 'pending');

                // Fetch completed trips count
                const { data: completedBookings, error: completedError } = await supabase
                    .from('booking_requests')
                    .select('id')
                    .eq('passenger_id', user.id)
                    .eq('status', 'completed');

                setStats({
                    upcomingTrips: confirmedTrips.length,
                    pendingBookings: pendingBookings.length,
                    completedTrips: completedBookings?.length || 0
                });
            }

            // Fetch recent searches from localStorage
            const savedSearches = localStorage.getItem('recentSearches');
            if (savedSearches) {
                try {
                    const searches = JSON.parse(savedSearches);
                    setRecentSearches(searches.slice(0, 3));
                } catch (e) {
                    console.error('Error parsing recent searches:', e);
                }
            }

        } catch (error) {
            console.error('Error in fetchPassengerData:', error);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }, [session?.user?.id]);

    // Handle direct logout
    const handleDirectLogout = async () => {
        try {
            console.log('[PassengerHome] Direct logout attempt');

            // Clear local state
            setPassengerName('Passenger');
            setUpcomingTrips([]);
            setRecentSearches([]);
            setStats({ upcomingTrips: 0, completedTrips: 0, pendingBookings: 0 });

            if (onLogout) {
                onLogout();
            } else {
                const toastId = toast.loading('Logging out...');
                await supabase.auth.signOut();
                window.location.href = '/login';
                toast.dismiss(toastId);
                toast.success('Logged out successfully');
            }

        } catch (error) {
            console.error('Direct logout error:', error);
            toast.error('Logout failed: ' + error.message);
        }
    };

    // Function to search rides using Edge Function
    // In PassengerHome.jsx - Update the searchRides function

    const searchRides = useCallback(async (searchParams) => {
        try {
            console.log('Invoking search-trips function with params:', searchParams);

            // Get the current session
            const { data: { session: currentSession } } = await supabase.auth.getSession();

            if (!currentSession) {
                toast.error('Please log in again');
                return [];
            }

            const { data, error } = await supabase.functions.invoke('search-trips', {
                body: {
                    fromLocation: searchParams.from_location,
                    toLocation: searchParams.to_location,
                    travelDate: searchParams.travel_date || '',
                    vehiclePreference: 'any',
                    page: 1,
                    pageSize: 20
                },
                headers: {
                    Authorization: `Bearer ${currentSession.access_token}`
                }
            });

            if (error) {
                console.error('Function error:', error);
                throw new Error(error.message || 'Search failed');
            }

            if (!data.success) {
                throw new Error(data.error || 'Search operation failed');
            }

            return data.data;
        } catch (error) {
            console.error('Error searching rides:', error);
            toast.error('Failed to search rides: ' + (error.message || 'Unknown error'));
            return [];
        }
    }, []);
    // Quick search function
    const handleQuickSearch = async (from, to) => {
        const searchParams = {
            from_location: from,
            to_location: to,
            seats_required: 1,
            travel_date: new Date().toISOString().split('T')[0]
        };

        const results = await searchRides(searchParams);

        // Save to recent searches
        const searchEntry = {
            from,
            to,
            timestamp: new Date().toISOString(),
            results: results.length
        };

        const currentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
        const updatedSearches = [searchEntry, ...currentSearches.filter(s =>
            s.from !== from || s.to !== to
        )].slice(0, 10);

        localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
        setRecentSearches(updatedSearches.slice(0, 3));

        // Navigate to search results page
        if (onSearchTrips) {
            onSearchTrips({
                from_location: from,
                to_location: to,
                travel_date: getTodayDate()
            });
        }
    };

    // Real-time notification setup — uses synchronous channel refs for reliable cleanup
    const currentUserId = session?.user?.id;
    useEffect(() => {
        if (!currentUserId) return;

        console.log('Setting up real-time notifications for passenger:', currentUserId);

        // Synchronous channel ref — no async, no race conditions
        const channel = supabase.channel(`passenger_${currentUserId}`)
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
                    duration: 10000,
                    position: 'top-right',
                    id: `booking-approved-${payload.payload.booking_id}`
                });

                // Refresh data
                fetchPassengerData();
            })
            .on('broadcast', { event: 'booking_rejected' }, (payload) => {
                console.log('Booking rejected notification received:', payload);

                toast.error('❌ Your ride request was declined', {
                    duration: 5000,
                    position: 'top-right'
                });

                // Refresh data
                fetchPassengerData();
            })
            .subscribe((status) => {
                console.log('Subscription status:', status);
            });

        // NOTE: Removed duplicate 'passenger_notifications_table' channel
        // App.jsx already has a global notification subscription,
        // and MyBookings.jsx watches booking_requests for this user.

        return () => {
            console.log('Cleaning up real-time subscriptions');
            supabase.removeChannel(channel);
        };
    }, [currentUserId]);

    // Initial data fetch - re-runs when session changes (e.g., on remount/navigation)
    useEffect(() => {
        fetchPassengerData();
    }, [fetchPassengerData]);

    // Geolocation setup using robust native helper
    useEffect(() => {
        const fetchLocation = async () => {
            try {
                const coords = await getCurrentLocation();
                setCurrentLocation({ lat: coords.lat, lng: coords.lng });
                setPickup("Current Location");
            } catch (error) {
                console.error("Location access error:", error);
                toast.error("Please enable location access for precise pickup");
                setCurrentLocation({ lat: 19.0760, lng: 72.8777 }); // Default: Mumbai
            }
        };

        fetchLocation();
    }, []);

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    const handleMenuClick = async (screen) => {
        setIsMenuOpen(false);
        console.log('Menu clicked:', screen);

        if (screen === 'logout') {
            console.log('Logout initiated from menu');
            await handleDirectLogout();
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

    const formatDate = (dateStr) => {
        try {
            const date = new Date(dateStr);
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            if (date.toDateString() === today.toDateString()) {
                return 'Today';
            } else if (date.toDateString() === tomorrow.toDateString()) {
                return 'Tomorrow';
            }

            return date.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short'
            });
        } catch (error) {
            return 'Invalid date';
        }
    };

    const formatTime = (timeStr) => {
        try {
            const [hours, minutes] = timeStr.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            return `${displayHour}:${minutes} ${ampm}`;
        } catch (error) {
            return 'Invalid time';
        }
    };

    const defaultCenter = { lat: 19.0760, lng: 72.8777 };

    return (
        <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
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

                {/* Sidebar Menu with Passenger Data */}
                <div className={`side-menu ${isMenuOpen ? 'open' : ''}`}>
                    <div className="menu-header">
                        <User size={40} className="user-icon" />
                        <div className="user-info">
                            <h3>{passengerName}</h3>
                            <p>Passenger</p>
                        </div>
                    </div>

                    {/* Stats Section in Menu */}
                    <div className="menu-stats">
                        <div className="stat-item">
                            <div className="stat-value">{stats.upcomingTrips}</div>
                            <div className="stat-label">Upcoming</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">{stats.pendingBookings}</div>
                            <div className="stat-label">Pending</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">{stats.completedTrips}</div>
                            <div className="stat-label">Completed</div>
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
                            {stats.pendingBookings > 0 && (
                                <span className="menu-badge">{stats.pendingBookings}</span>
                            )}
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
                        <button onClick={() => handleMenuClick('wallet')}>
                            <Wallet size={20} />
                            <span>Wallet</span>
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

                {/* Header with Notification Bell */}
                <div className="yellow-header">
                    <div className="header-content">
                        <button className="menu-btn" onClick={toggleMenu}>
                            <Menu size={24} />
                        </button>
                        <div className="header-text">
                            <h1>Xpool</h1>
                            <h2>Find your ride</h2>
                        </div>
                        <button className="notification-menu-btn" onClick={() => onNavigate?.('notifications')}>
                            <Bell size={22} />
                            {stats.pendingBookings > 0 && (
                                <span className="notification-dot"></span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Search Card */}
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

                {/* Bottom Buttons */}
                <div className="continue-btn-container">
                    {/* Recent Searches Quick Buttons */}
                    {recentSearches.length > 0 && (
                        <div className="recent-searches-container">
                            <div className="recent-searches-header">
                                <span>Recent Searches</span>
                                <button
                                    className="clear-recent-btn"
                                    onClick={() => {
                                        localStorage.removeItem('recentSearches');
                                        setRecentSearches([]);
                                    }}
                                >
                                    Clear
                                </button>
                            </div>
                            <div className="recent-searches-buttons">
                                {recentSearches.map((search, index) => (
                                    <button
                                        key={index}
                                        className="recent-search-btn"
                                        onClick={() => handleQuickSearch(search.from, search.to)}
                                    >
                                        <span className="recent-from">{search.from.split(',')[0]}</span>
                                        <span className="recent-arrow">→</span>
                                        <span className="recent-to">{search.to.split(',')[0]}</span>
                                        <span className="recent-count">{search.results}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        className="search-trips-btn"
                        onClick={() => {
                            if (!dropoff) {
                                toast.error('Please enter a destination');
                                return;
                            }

                            // Save search to recent
                            const searchEntry = {
                                from: pickup || "Current Location",
                                to: dropoff,
                                timestamp: new Date().toISOString(),
                                results: 0
                            };

                            const currentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
                            const updatedSearches = [searchEntry, ...currentSearches.filter(s =>
                                s.from !== searchEntry.from || s.to !== searchEntry.to
                            )].slice(0, 10);

                            localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));

                            // Navigate to search
                            onSearchTrips({
                                from: pickup,
                                to: dropoff,
                                date: travelDate,
                                vehicle: vehiclePreference
                            });
                        }}
                    >
                        <Search size={20} />
                        Find Pre-booked Trips
                    </button>
                </div>
            </div>
        </APIProvider>
    );
};

export default PassengerHome;