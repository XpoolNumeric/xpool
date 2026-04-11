import React, { useState, useEffect, useCallback, useRef } from 'react';
<<<<<<< HEAD
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Search, Menu, User, BookOpen, Clock as HistoryIcon, CreditCard, ChevronRight, Calendar, Car, Bike, Phone, Bell, Wallet, X, CheckCheck } from 'lucide-react';
=======
import { Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Search, Menu, User, BookOpen, Clock as HistoryIcon, CreditCard, ChevronRight, ChevronDown, Calendar, Car, Bike, Phone, Bell, Wallet, X, CheckCheck, Home, Zap, Shield, Download, Mail, HelpCircle, MessageCircle, ArrowRight, ExternalLink, ArrowLeft, LocateFixed, ArrowUpDown, CheckCircle2, XCircle, Flag, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
import toast from 'react-hot-toast';
import { supabase } from '../../../supabaseClient';
import { getCurrentLocation } from '../../../utils/googleMapsHelper';
import { getAllNotifications, getUnreadCount, markAllNotificationsAsRead, markNotificationAsRead } from '../../../utils/notificationHelper';
import '../css/PassengerHome.css';
import LocationInput from '../../common/LocationInput';
import logoReal from '../../../assets/logo_real.jpg';

// Component to handle map centering and routing updates
const MapUpdater = ({ center, destination, onRouteInfo, isSearchOverlayActive }) => {
    const map = useMap();
    const [directionsRenderer, setDirectionsRenderer] = useState(null);
    const [lastResult, setLastResult] = useState(null);

    useEffect(() => {
        if (!map) return;

        // Only pan strictly to center if no destination is selected
        if (center && !destination) {
            map.panTo(center);
            map.setZoom(15);
            setTimeout(() => map.panBy(0, -180), 50);
        }
    }, [map, center, destination]);

    useEffect(() => {
        if (!map) return;

        if (!directionsRenderer) {
            const dr = new window.google.maps.DirectionsRenderer({
                map,
                suppressMarkers: true,
                preserveViewport: true,
                polylineOptions: {
                    strokeColor: '#f59e0b',
                    strokeWeight: 6,
                    strokeOpacity: 1,
                    strokeLineCap: 'round',
                    strokeLineJoin: 'round',
                    zIndex: 50
                }
            });
            setDirectionsRenderer(dr);
        }
    }, [map, directionsRenderer]);

    // Refit bounds when search overlay activates (route must fit in top 30%)
    useEffect(() => {
        if (!map || !lastResult) return;
        const bounds = lastResult.routes?.[0]?.bounds;
        if (!bounds) return;

        if (isSearchOverlayActive) {
            // Sheet covers bottom 70%, so route must fit in top 30%
            map.fitBounds(bounds, {
                top: 30,
                bottom: typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.72) : 500,
                left: 50,
                right: 50
            });
        } else {
            // Normal view — center between top search card and bottom bar
            map.fitBounds(bounds, {
                top: typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.45, 420) : 380,
                bottom: 140,
                left: 40,
                right: 40
            });
        }
    }, [isSearchOverlayActive, map, lastResult]);

    useEffect(() => {
        if (!directionsRenderer || !center || !destination) {
            if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
            setLastResult(null);
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
                    setLastResult(result);

                    if (map && result.routes && result.routes[0]) {
                        const bounds = result.routes[0].bounds;
                        if (isSearchOverlayActive) {
                            map.fitBounds(bounds, {
                                top: 30,
                                bottom: typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.72) : 500,
                                left: 50,
                                right: 50
                            });
                        } else {
                            map.fitBounds(bounds, {
                                top: typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.45, 420) : 380,
                                bottom: 140,
                                left: 40,
                                right: 40
                            });
                        }
                    }

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
                <div className="toast-icon"><CheckCircle2 size={24} color="#10b981" strokeWidth={2.5} /></div>
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
                <button className="toast-action-btn view-btn" onClick={onViewDetails}>
                    <BookOpen size={16} /> View Booking
                </button>
                <button className="toast-action-btn close-btn" onClick={onDismiss}>
                    Dismiss
                </button>
            </div>
        </div>
    );
};

// Animation Variants
const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};
const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

// Premium Warm Natural Map Style — highway shields visible, warm terrain, clean
const customMapStyle = [
    // Base geometry — soft warm cream
    { elementType: "geometry", stylers: [{ color: "#f5f0e8" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#5c5c5c" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f0e8" }, { weight: 3 }] },

    // Keep highway shield icons visible for realism
    { elementType: "labels.icon", stylers: [{ visibility: "simplified" }, { saturation: -30 }] },

    // POI — hide business clutter but keep parks/landmarks subtle
    { featureType: "poi.business", stylers: [{ visibility: "off" }] },
    { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
    { featureType: "poi.school", stylers: [{ visibility: "off" }] },
    { featureType: "poi.sports_complex", stylers: [{ visibility: "off" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e8ecd5" }] },
    { featureType: "poi.park", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },

    // Water
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9daf0" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#92adc9" }] },

    // Landscape
    { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#f0ebe0" }] },
    { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#ece7db" }] },

    // Local roads — warm light beige
    { featureType: "road.local", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.local", elementType: "geometry.stroke", stylers: [{ color: "#e0dace" }] },
    { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },

    // Arterial roads
    { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#faf6ef" }] },
    { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: "#d9d2c4" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#6e6e6e" }] },

    // Highways — slightly warm off-white with visible labels
    { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#fde9a8" }, { weight: 2.5 }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#e8c55a" }, { weight: 0.8 }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#4a4a4a" }] },
    { featureType: "road.highway", elementType: "labels.icon", stylers: [{ visibility: "on" }] },

    // Controlled-access highways
    { featureType: "road.highway.controlled_access", elementType: "geometry.fill", stylers: [{ color: "#fbd76e" }, { weight: 3 }] },
    { featureType: "road.highway.controlled_access", elementType: "geometry.stroke", stylers: [{ color: "#d4a931" }] },

    // Admin labels
    { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#3a3a3a" }, { weight: 0.5 }] },
    { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#888" }] },
];

const PassengerHome = ({ onBack, onSearchTrips, onNavigate, onLogout, session, isSearchOverlayActive }) => {
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [currentLocation, setCurrentLocation] = useState(null);
    const [pickupCoords, setPickupCoords] = useState(null);
    const [destinationCoords, setDestinationCoords] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null);

    // UI States
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isVehicleDropdownOpen, setIsVehicleDropdownOpen] = useState(false);
    const [isSupportOpen, setIsSupportOpen] = useState(false);
    const [expandedFaq, setExpandedFaq] = useState(null);
    const [activeNotification, setActiveNotification] = useState(null);
<<<<<<< HEAD
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifList, setNotifList] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifLoading, setNotifLoading] = useState(false);
=======
    const [notifList, setNotifList] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifLoading, setNotifLoading] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)

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

            // Extract city name (first comma part) for cleaner matching
            const extractCity = (loc) => {
                if (!loc) return '';
                const trimmed = loc.trim();
                if (trimmed.toLowerCase() === 'current location') return trimmed;
                return trimmed.split(',')[0].trim();
            };

            const { data, error } = await supabase.functions.invoke('search-trips', {
                body: {
                    fromLocation: extractCity(searchParams.from_location),
                    toLocation: extractCity(searchParams.to_location),
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

    // Real-time notification setup â€” uses synchronous channel refs for reliable cleanup
    const currentUserId = session?.user?.id;
    useEffect(() => {
        if (!currentUserId) return;

        console.log('Setting up real-time notifications for passenger:', currentUserId);

        // Synchronous channel ref â€” no async, no race conditions
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

<<<<<<< HEAD
    // ── Notification Fetch & Real-time ──
=======
    // â”€â”€ Notification Fetch & Real-time â”€â”€
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
    const fetchNotifications = useCallback(async () => {
        if (!currentUserId) return;
        setNotifLoading(true);
        try {
            const [allNotifs, count] = await Promise.all([
                getAllNotifications(currentUserId, 30),
                getUnreadCount(currentUserId)
            ]);
            setNotifList(allNotifs);
            setUnreadCount(count);
        } catch (e) {
            console.error('Error fetching notifications:', e);
        } finally {
            setNotifLoading(false);
        }
    }, [currentUserId]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Real-time subscription for new notifications from DB
    useEffect(() => {
        if (!currentUserId) return;
        const channel = supabase
            .channel(`notif_bell_${currentUserId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${currentUserId}`
            }, () => {
                fetchNotifications();
            })
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [currentUserId, fetchNotifications]);

    const handleMarkAllRead = async () => {
        if (!currentUserId) return;
        await markAllNotificationsAsRead(currentUserId);
        setNotifList(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    const handleNotifClick = async (notif) => {
        if (!notif.read) {
            await markNotificationAsRead(notif.id);
            setNotifList(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    const toggleNotifPanel = () => {
        const opening = !isNotifOpen;
        setIsNotifOpen(opening);
        if (opening) fetchNotifications();
    };

    const formatNotifTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHrs = Math.floor(diffMin / 60);
        if (diffHrs < 24) return `${diffHrs}h ago`;
        const diffDays = Math.floor(diffHrs / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

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

    const handleSwapLocations = () => {
        const tempPickup = pickup;
        setPickup(dropoff);
        setDropoff(tempPickup);

        const tempPickupCoords = pickupCoords;
        setPickupCoords(destinationCoords);
        setDestinationCoords(tempPickupCoords);

        setRouteInfo(null);
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
        <div className="passenger-home-container">
<<<<<<< HEAD
=======
            {/* Map Background Layer (Full Screen behind cards) */}
            <div className="map-layer">

                <Map
                    defaultCenter={defaultCenter}
                    defaultZoom={15}
                    gestureHandling={'greedy'}
                    disableDefaultUI={true}
                    styles={customMapStyle}
                    className="map-container"
                    style={{ width: '100%', height: '100%' }}
                >
                    {(pickupCoords || currentLocation) && (
                        <>
                            <Marker
                                position={pickupCoords || currentLocation}
                                icon={{
                                    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="24" fill="rgba(245, 158, 11, 0.12)" /><circle cx="32" cy="32" r="16" fill="rgba(245, 158, 11, 0.2)" /><circle cx="32" cy="32" r="10" fill="#ffffff" stroke="rgba(0,0,0,0.08)" stroke-width="1"/><circle cx="32" cy="32" r="5" fill="#f59e0b" /><animateTransform attributeName="transform" type="scale" values="1;1.06;1" dur="2s" begin="0s" repeatCount="indefinite" additive="sum" from="32 32" /></svg>')}`,
                                    scaledSize: typeof window !== 'undefined' && window.google ? new window.google.maps.Size(64, 64) : null,
                                    anchor: typeof window !== 'undefined' && window.google ? new window.google.maps.Point(32, 32) : null
                                }}
                                zIndex={100}
                            />
                            <MapUpdater
                                center={pickupCoords || currentLocation}
                                destination={destinationCoords}
                                onRouteInfo={setRouteInfo}
                                isSearchOverlayActive={isSearchOverlayActive}
                            />
                        </>
                    )}
                    {destinationCoords && (
                        <Marker
                            position={destinationCoords}
                            icon={{
                                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="24" fill="rgba(245, 158, 11, 0.12)" /><circle cx="32" cy="32" r="16" fill="rgba(245, 158, 11, 0.25)" /><circle cx="32" cy="32" r="10" fill="#f59e0b" /><circle cx="32" cy="32" r="4" fill="#ffffff" /></svg>')}`,
                                scaledSize: typeof window !== 'undefined' && window.google ? new window.google.maps.Size(64, 64) : null,
                                anchor: typeof window !== 'undefined' && window.google ? new window.google.maps.Point(32, 32) : null
                            }}
                            zIndex={100}
                        />
                    )}
                </Map>
            </div>

            {/* Overlaid UI Container */}
            <div className={`overlaid-ui-layer ${isSearchOverlayActive ? 'hidden-search-overlay' : ''}`}>
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                {/* Active Notification Banner */}
                <AnimatePresence>
                    {activeNotification && (
                        <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="active-notification-banner">
                            <div className="banner-content">
                                <div className="banner-icon"><CheckCircle2 size={28} color="#10b981" strokeWidth={2.5} /></div>
                                <div className="banner-text">
                                    <h4>Ride Accepted!</h4>
                                    <p>Driver: <strong>{activeNotification.driver.name}</strong> â€¢ Vehicle: <strong>{activeNotification.driver.vehicle_type}</strong></p>
                                </div>
                            </div>
                            <div className="banner-actions">
                                <a href={`tel:${activeNotification.driver.phone}`} className="banner-btn call-btn">
                                    <Phone size={16} /> Call
                                </a>
                                <button className="banner-btn view-btn" onClick={handleViewBookingDetails}>View</button>
                                <button className="banner-btn close-btn" onClick={() => setActiveNotification(null)}>Ã—</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

<<<<<<< HEAD
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
                        <button onClick={() => handleMenuClick('passengerWallet')}>
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

                {/* Notification Panel */}
                {isNotifOpen && <div className="menu-overlay notif-overlay" onClick={toggleNotifPanel}></div>}
                <div className={`notif-panel ${isNotifOpen ? 'open' : ''}`}>
                    <div className="notif-panel-header">
                        <h3>Notifications</h3>
                        <div className="notif-header-actions">
                            {unreadCount > 0 && (
                                <button className="mark-all-read-btn" onClick={handleMarkAllRead}>
                                    <CheckCheck size={16} />
                                    Mark all read
                                </button>
                            )}
                            <button className="notif-close-btn" onClick={toggleNotifPanel}>
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                    <div className="notif-panel-body">
                        {notifLoading ? (
                            <div className="notif-loading">
                                <div className="spinner"></div>
                                <p>Loading...</p>
                            </div>
                        ) : notifList.length === 0 ? (
                            <div className="notif-empty">
                                <Bell size={40} />
                                <h4>No notifications</h4>
                                <p>You'll see updates from drivers and ride status here</p>
                            </div>
                        ) : (
                            notifList.map(notif => (
                                <div
                                    key={notif.id}
                                    className={`notif-item ${!notif.read ? 'unread' : ''}`}
                                    onClick={() => handleNotifClick(notif)}
                                >
                                    <div className="notif-item-icon">
                                        {notif.type === 'booking_approved' ? '✅' :
                                         notif.type === 'booking_rejected' ? '❌' :
                                         notif.type === 'ride_started' ? '🚗' :
                                         notif.type === 'ride_completed' ? '🏁' :
                                         notif.type === 'payment' ? '💰' : '🔔'}
                                    </div>
                                    <div className="notif-item-content">
                                        <div className="notif-item-title">{notif.title}</div>
                                        <div className="notif-item-message">{notif.message}</div>
                                        <div className="notif-item-time">{formatNotifTime(notif.created_at)}</div>
                                    </div>
                                    {!notif.read && <div className="notif-unread-dot"></div>}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Header with Notification Bell */}
                <div className="yellow-header">
                    <div className="header-content">
                        <button className="menu-btn" onClick={toggleMenu}>
=======
                {/* Top Glass Header */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="glass-header">
                    <div className="glass-header-content">
                        <button className="glass-menu-btn" onClick={toggleMenu}>
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                            <Menu size={24} />
                        </button>
                        <div className="glass-header-text" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                            <p className="caption-professional" style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.65rem', color: '#f59e0b', fontWeight: '800', margin: 0, marginBottom: '-2px' }}>India Moves On</p>
                            <h2 className="heading-professional" style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', letterSpacing: '-0.5px' }}>
                                <span style={{ color: '#f59e0b' }}>X</span>
                                <span style={{ color: '#1a0800' }}>pool</span>
                            </h2>
                        </div>
<<<<<<< HEAD
                        <button className="notification-menu-btn" onClick={toggleNotifPanel}>
                            <Bell size={22} />
                            {unreadCount > 0 && (
                                <span className="notification-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>
                            )}
=======
                        <button className="glass-notification-btn" onClick={toggleNotifPanel}>
                            <Bell size={22} />
                            {unreadCount > 0 && <span className="notification-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>}
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                        </button>
                    </div>
                </motion.div>

                {/* Floating Search Card */}
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="glass-floating-card bs-card">
                    <div style={{ position: 'relative' }}>
                        <motion.div variants={fadeUp} className="input-group">
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
                                className="input-wrapper bs-input-wrap"
                            />
                        </motion.div>

                        <div className="connector-line"></div>
                        <button
                            className="swap-locations-btn"
                            onClick={handleSwapLocations}
                            aria-label="Swap pickup and dropoff"
                        >
                            <ArrowUpDown size={16} strokeWidth={2.5} />
                        </button>

                        <motion.div variants={fadeUp} className="input-group input-group-last">
                            <LocationInput
                                name="dropoff"
                                placeholder="Where to?"
                                value={dropoff}
                                onChange={handleDropoffChange}
                                onPlaceSelect={(p) => handlePlaceSelect('dropoff', p)}
                                Icon={MapPin}
                                iconColor="yellow"
                                className="input-wrapper bs-input-wrap"
                            />
                        </motion.div>
                    </div>

                    <motion.div variants={fadeUp} className="filter-row-home">
                        <div className="filter-item bs-input-wrap">
                            <div className="icon-box-small">
                                <Calendar size={18} />
                            </div>
                            <input
                                type="date"
                                className="date-input-home"
                                value={travelDate}
                                onChange={(e) => setTravelDate(e.target.value)}
                                min={getTodayDate()}
                            />
                        </div>
                        <div className="vehicle-selector-wrapper" style={{ position: 'relative' }}>
                            <button
                                className="bs-tab bs-tab-active"
                                onClick={() => setIsVehicleDropdownOpen(!isVehicleDropdownOpen)}
                                style={{ width: '90px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    {vehiclePreference === 'any' ? 'Any' : vehiclePreference === 'car' ? <Car size={16} /> : <Bike size={16} />}
                                </span>
                                <ChevronDown size={14} />
                            </button>

                            <AnimatePresence>
                                {isVehicleDropdownOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                        className="vehicle-dropdown-menu bs-card"
                                    >
                                        {['any', 'car', 'bike'].map(type => (
                                            <button
                                                key={type}
                                                className={`vehicle-dropdown-item ${vehiclePreference === type ? 'active' : ''}`}
                                                onClick={() => {
                                                    setVehiclePreference(type);
                                                    setIsVehicleDropdownOpen(false);
                                                }}
                                            >
                                                {type === 'any' ? 'Any' : type === 'car' ? <><Car size={16} /> Car</> : <><Bike size={16} /> Bike</>}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Bottom Area Wrapper */}
                <div className="bottom-area-wrapper" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', pointerEvents: 'none', width: '100%', zIndex: 35 }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '20px', paddingBottom: '16px' }}>
                        {/* My Location GPS Button */}
                        <motion.button
                            className={`my-location-btn ${isLocating ? 'locating' : ''}`}
                            disabled={isLocating}
                            onClick={async () => {
                                if (isLocating) return;
                                setIsLocating(true);
                                try {
                                    const coords = await getCurrentLocation();
                                    setCurrentLocation({ lat: coords.lat, lng: coords.lng });
                                    setPickupCoords(null);
                                    setPickup('Current Location');
                                    toast.success('Centered to your location');
                                } catch (err) {
                                    toast.error('Could not get your location');
                                } finally {
                                    setIsLocating(false);
                                }
                            }}
                            whileTap={{ scale: isLocating ? 1 : 0.9 }}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                            aria-label="Center to my location"
                            style={{ pointerEvents: 'auto' }}
                        >
                            {isLocating ? (
                                <span className="gps-spinner" />
                            ) : (
                                <LocateFixed size={22} strokeWidth={2.5} />
                            )}
                        </motion.button>
                    </div>

                    {/* Bottom Buttons Container */}
                    <div className="continue-btn-container" style={{ marginTop: 0 }}>
                    {/* Recent Searches Quick Buttons */}
                    {recentSearches.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="recent-searches-carousel">
                            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                                {recentSearches.map((search, index) => {
                                    // Make sure we extract city names safely
                                    const fromName = search.from ? search.from.split(',')[0].trim() : "Current Location";
                                    const toName = search.to ? search.to.split(',')[0].trim() : "";

                                    return (
                                        <button
                                            key={index}
                                            className="recent-search-chip"
                                            onClick={() => handleQuickSearch(search.from, search.to)}
                                            style={{ display: 'flex', alignItems: 'center' }}
                                        >
                                            <HistoryIcon size={14} className="text-gray-400" />
                                            <span className="truncate" style={{ maxWidth: '140px' }}>
                                                {fromName} <span style={{ opacity: 0.5, margin: '0 2px' }}>→</span> {toName}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    <motion.button
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        whileTap={{ scale: 0.98 }}
                        className="bs-book-btn w-full flex items-center justify-center gap-2"
                        onClick={() => {
                            if (!dropoff) {
                                toast.error('Please enter a destination');
                                return;
                            }
                            const searchEntry = {
                                from: pickup || "Current Location",
                                to: dropoff,
                                timestamp: new Date().toISOString(),
                                results: 0
                            };

                            // Get existing searches and prepend new one, ensuring uniqueness
                            const currentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
                            const updatedSearches = [
                                searchEntry,
                                ...currentSearches.filter(s => !(s.from === searchEntry.from && s.to === searchEntry.to))
                            ].slice(0, 10);

                            localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
                            // Update local state without forcing a full reload immediately 
                            setRecentSearches(updatedSearches);

                            onSearchTrips({
                                from: pickup,
                                from_coords: pickupCoords || currentLocation,
                                to: dropoff,
                                to_coords: destinationCoords,
                                date: travelDate,
                                vehicle: vehiclePreference
                            });
                        }}
                    >
                        <Search size={22} className="stroke-black stroke-2" />
                        Search Rides
                    </motion.button>
                </div>
                </div>
            </div>

            {/* Sidebar Menu with Match Theme UI */}
            <div className={`side-menu ${isMenuOpen ? 'open' : ''}`}>
                <div className="sm-header">
                    <div className="sm-logo-group">
                        <img src={logoReal} alt="Xpool" className="sm-logo-img" draggable={false} />
                        <span className="sm-brand"><span className="sm-brand-x">X</span>pool</span>
                    </div>
                    <button className="sm-close-btn" onClick={toggleMenu} aria-label="Close menu">
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="sm-body">
                    <p className="sm-eyebrow">NAVIGATION</p>
                    <div className="sm-nav-group">
                        <button className="sm-nav-item sm-active" onClick={() => toggleMenu()}>
                            <div className="sm-nav-icon"><Home size={18} strokeWidth={2.5} /></div>
                            <span>Home</span>
                            <ChevronRight size={16} className="sm-chevron" strokeWidth={2.5} />
                        </button>

                        <button className="sm-nav-item" onClick={() => handleMenuClick('passengerProfile')}>
                            <div className="sm-nav-icon"><User size={18} strokeWidth={2.5} /></div>
                            <span>My Profile</span>
                            <ChevronRight size={16} className="sm-chevron" strokeWidth={2.5} />
                        </button>

                        <button className="sm-nav-item" onClick={() => handleMenuClick('myBookings')}>
                            <div className="sm-nav-icon"><BookOpen size={18} strokeWidth={2.5} /></div>
                            <span>My Bookings</span>
                            {stats.pendingBookings > 0 && <span className="sm-nav-pill">{stats.pendingBookings}</span>}
                            <ChevronRight size={16} className="sm-chevron" strokeWidth={2.5} />
                        </button>

                        <button className="sm-nav-item" onClick={() => handleMenuClick('passengerWallet')}>
                            <div className="sm-nav-icon"><Wallet size={18} strokeWidth={2.5} /></div>
                            <span>Wallet</span>
                            <ChevronRight size={16} className="sm-chevron" strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div className="sm-footer">
                    <button className="sm-support-btn" onClick={() => { setIsMenuOpen(false); setIsSupportOpen(true); }}>
                        <Phone size={16} strokeWidth={2.5} /> Support
                    </button>
                    <button className="sm-logout-btn" onClick={() => handleMenuClick('logout')}>
                        <span style={{ color: 'currentColor' }}>Log out</span>
                    </button>
                </div>
            </div>
<<<<<<< HEAD
=======

            {isMenuOpen && <div className="menu-overlay" onClick={toggleMenu}></div>}

            {/* ═══ SUPPORT PANEL ═══ */}
            <AnimatePresence>
                {isSupportOpen && (
                    <>
                        <motion.div
                            className="sup-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSupportOpen(false)}
                        />
                        <motion.div
                            className="sup-panel"
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        >
                            {/* Header */}
                            <div className="sup-header">
                                <div className="sup-header-left">
                                    <button className="sup-back-btn" onClick={() => setIsSupportOpen(false)}>
                                        <ArrowLeft size={20} strokeWidth={2.5} />
                                    </button>
                                    <div>
                                        <h2 className="sup-title">Help & Support</h2>
                                        <p className="sup-sub">We're here for you 24/7</p>
                                    </div>
                                </div>
                                <div className="sup-header-icon">
                                    <HelpCircle size={24} strokeWidth={2} />
                                </div>
                            </div>

                            {/* Contact Cards */}
                            <div className="sup-cards">
                                {/* Phone Card */}
                                <div className="sup-card">
                                    <div className="sup-card-top">
                                        <div className="sup-card-icon sup-card-icon-phone">
                                            <Phone size={20} strokeWidth={2.5} />
                                        </div>
                                        <span className="sup-card-badge sup-badge-live">24/7 Live</span>
                                    </div>
                                    <h3 className="sup-card-title">Customer Support</h3>
                                    <p className="sup-card-desc">Need help with a ride, payment, or app issue? Our support team is available 24/7.</p>
                                    <div className="sup-card-value">
                                        <Phone size={14} strokeWidth={2.5} />
                                        <span>+91 7904790007</span>
                                    </div>
                                    <a href="tel:+917904790007" className="sup-card-cta">
                                        <span>Call Now</span>
                                        <ArrowRight size={16} strokeWidth={2.5} />
                                    </a>
                                </div>

                                {/* Email Card */}
                                <div className="sup-card">
                                    <div className="sup-card-top">
                                        <div className="sup-card-icon sup-card-icon-mail">
                                            <Mail size={20} strokeWidth={2.5} />
                                        </div>
                                        <span className="sup-card-badge sup-badge-quick">Quick Reply</span>
                                    </div>
                                    <h3 className="sup-card-title">Email Support</h3>
                                    <p className="sup-card-desc">For partnerships, business inquiries, or detailed support requests, drop us an email.</p>
                                    <div className="sup-card-value">
                                        <Mail size={14} strokeWidth={2.5} />
                                        <span>xpool.help@gmail.com</span>
                                    </div>
                                    <a href="mailto:xpool.help@gmail.com" className="sup-card-cta">
                                        <span>Email Support</span>
                                        <ArrowRight size={16} strokeWidth={2.5} />
                                    </a>
                                </div>
                            </div>

                            {/* FAQs */}
                            <div className="sup-faq-section">
                                <h3 className="sup-faq-heading">Frequently Asked Questions</h3>
                                {[
                                    { q: 'How do I book a ride?', a: 'Enter your pickup and destination, choose a vehicle type, and tap "Search Rides" to find available drivers near you.' },
                                    { q: 'How do I cancel a booking?', a: 'Go to My Bookings from the sidebar, find your active booking, and tap the Cancel button. Cancellation is free before the driver starts the trip.' },
                                    { q: 'What payment methods are accepted?', a: 'We accept UPI, debit/credit cards, and wallet balance. You can add payment methods in the Wallet section.' },
                                    { q: 'How do I contact my driver?', a: 'Once your booking is confirmed, you can directly call or message the driver from the Active Ride screen.' },
                                    { q: 'Is my personal information secure?', a: 'Absolutely! All your data is encrypted end-to-end. We never share your personal information with third parties.' },
                                    { q: 'What if my driver doesn\'t arrive?', a: 'If your driver doesn\'t show up within the expected time, you can cancel the ride for free and rebook. Contact support if you need immediate help.' },
                                ].map((faq, i) => (
                                    <div
                                        key={i}
                                        className={`sup-faq-item ${expandedFaq === i ? 'sup-faq-open' : ''}`}
                                    >
                                        <button
                                            className="sup-faq-q"
                                            onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                                        >
                                            <span>{faq.q}</span>
                                            <ChevronDown size={18} strokeWidth={2.5} className={`sup-faq-chevron ${expandedFaq === i ? 'sup-rotated' : ''}`} />
                                        </button>
                                        <AnimatePresence>
                                            {expandedFaq === i && (
                                                <motion.div
                                                    className="sup-faq-a"
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                                >
                                                    <p>{faq.a}</p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>

                            {/* Live Chat CTA */}
                            <div className="sup-bottom">
                                <div className="sup-live-badge">
                                    <div className="sup-live-dot" />
                                    <span>Support team is online</span>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ═══ NOTIFICATION PANEL ═══ */}
            <AnimatePresence>
                {isNotifOpen && (
                    <motion.div
                        className="notif-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={toggleNotifPanel}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {isNotifOpen && (
                    <motion.div
                        className="notif-panel open"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                    >
                        {/* Header */}
                        <div className="notif-panel-header">
                            <div className="notif-header-left">
                                <Bell size={22} strokeWidth={2.5} />
                                <div>
                                    <h3>Notifications</h3>
                                    {unreadCount > 0 && <p className="notif-header-sub">{unreadCount} unread</p>}
                                </div>
                            </div>
                            <div className="notif-header-actions">
                                {unreadCount > 0 && (
                                    <button className="mark-all-read-btn" onClick={handleMarkAllRead}>
                                        <CheckCheck size={14} strokeWidth={2.5} /> Read all
                                    </button>
                                )}
                                <button className="notif-close-btn" onClick={toggleNotifPanel}>
                                    <X size={18} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="notif-panel-body">
                            {notifLoading ? (
                                <div className="notif-loading">
                                    <div className="notif-spinner" />
                                    <p>Loading notifications...</p>
                                </div>
                            ) : notifList.length === 0 ? (
                                <div className="notif-empty">
                                    <div className="notif-empty-icon-wrap">
                                        <Bell size={36} strokeWidth={1.5} />
                                    </div>
                                    <h4>All caught up!</h4>
                                    <p>No new notifications right now.<br />We will let you know when something arrives.</p>
                                </div>
                            ) : (
                                <motion.div
                                    initial="hidden"
                                    animate="visible"
                                    variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
                                >
                                    {notifList.map(notif => {
                                        const iconType =
                                            notif.type === 'booking_approved' ? 'approved' :
                                            notif.type === 'booking_rejected' ? 'rejected' :
                                            notif.type === 'ride_started' ? 'started' :
                                            notif.type === 'ride_completed' ? 'completed' :
                                            notif.type === 'payment' ? 'payment' :
                                            (notif.type === 'otp' || (notif.title && notif.title.toLowerCase().includes('otp'))) ? 'otp' :
                                            'default';
                                        const iconMap = {
                                            approved: <CheckCircle2 size={22} strokeWidth={2.5} />,
                                            rejected: <XCircle size={22} strokeWidth={2.5} />,
                                            started: <Car size={22} strokeWidth={2.5} />,
                                            completed: <Flag size={22} strokeWidth={2.5} />,
                                            payment: <CreditCard size={22} strokeWidth={2.5} />,
                                            otp: <Key size={22} strokeWidth={2.5} />,
                                            default: <Bell size={22} strokeWidth={2.5} />,
                                        };
                                        return (
                                            <motion.div
                                                key={notif.id}
                                                className={`notif-card ${!notif.read ? 'unread' : ''}`}
                                                variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                                                onClick={() => handleNotifClick(notif)}
                                            >
                                                <div className={`notif-card-icon notif-icon-${iconType}`}>
                                                    {iconMap[iconType]}
                                                </div>
                                                <div className="notif-card-body">
                                                    <div className="notif-card-row">
                                                        <span className="notif-card-title">{notif.title}</span>
                                                        {!notif.read && <span className="notif-live-dot" />}
                                                    </div>
                                                    <p className="notif-card-msg">{notif.message}</p>
                                                    <span className="notif-card-time">{formatNotifTime(notif.created_at)}</span>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
    );
};

export default PassengerHome;






