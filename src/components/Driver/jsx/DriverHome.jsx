import React, { useState, useEffect } from 'react';
import { User, Wallet, MapPin, Calendar, LogOut, Plus, List, Bell, ChevronRight, Zap, Clock, Map, Users, Star, IndianRupee } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import '../css/DriverHome.css';

const DriverHome = ({
    session,
    onNavigate,
    onLogout
}) => {
    const [loading, setLoading] = useState(true);
    const [driverName, setDriverName] = useState('Driver');
    const [isOnline, setIsOnline] = useState(true);
    const [greeting, setGreeting] = useState(() => {
        // Instant local fallback while AI loads
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning 👋';
        if (hour < 18) return 'Good afternoon 👋';
        return 'Good evening 👋';
    });
    const [stats, setStats] = useState({
        activeTrips: 0,
        pendingRequests: 0,
        earningsToday: 0,
        tripsToday: 0,
        rating: 4.8,
        reviewCount: 0,
        isElite: false
    });
    const [recentTrips, setRecentTrips] = useState([]);

    useEffect(() => {
        let cleanupSubscriptions = null;

        if (session?.user) {
            fetchDriverData();
            cleanupSubscriptions = setupRealtimeSubscriptions();
            fetchDynamicGreeting();
        } else {
            // Safety check: If loaded without session, don't get stuck in loading
            setLoading(false);
        }

        return () => {
            if (cleanupSubscriptions) cleanupSubscriptions();
        };
    }, [session?.user?.id]);

    const fetchDynamicGreeting = async () => {
        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) return;

            const hour = new Date().getHours();
            const timeContext = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `Generate a highly impressive, friendly, and deeply motivating ${timeContext} greeting for our top ride-share driver. Keep it very short (3-6 words max) but extremely warm, encouraging, and inspiring. Add one cool emoji at the end. Make them feel valued, positive, and energized for their driving shift! Examples: 'Have a fantastic ${timeContext}! 🌟', 'Ready for amazing rides! 🚗', 'Wishing you smooth miles! ✨', 'Drive safe, shine bright! 💫'. Reply with ONLY the exact greeting text, no quotes or explanations.`
                            }]
                        }],
                        generationConfig: { temperature: 1.0, maxOutputTokens: 20 }
                    })
                }
            );

            if (!res.ok) {
                console.warn(`[DriverHome] Gemini greeting failed: ${res.status}`);
                return;
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                setGreeting(text.replace(/["|'\n]/g, '').trim());
            }
        } catch (err) {
            console.warn('[DriverHome] Gemini greeting error (silent):', err.message);
        }
    };

    const fetchDriverData = async () => {
        try {
            setLoading(true);
            const userId = session?.user?.id;

            if (!userId) {
                console.warn('[DriverHome] No user ID found during fetch, aborting');
                setLoading(false);
                return;
            }

            // Fetch driver profile
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', userId)
                .single();

            if (profileError) throw profileError;
            if (profileData) {
                setDriverName(profileData.full_name || 'Driver');
            }

            // Get driver ID if needed (though trips seem to use user_id here)
            const { data: driverInfo } = await supabase
                .from('drivers')
                .select('id')
                .eq('user_id', userId)
                .single();

            const driverId = driverInfo?.id;

            // Fetch active trips count
            const { data: activeTripsData, error: activeTripsError } = await supabase
                .from('trips')
                .select('id', { count: 'exact' })
                .eq('user_id', userId)
                .eq('status', 'active');

            if (activeTripsError) throw activeTripsError;

            // Fetch all trip IDs for this driver
            const { data: tripsData, error: tripsError } = await supabase
                .from('trips')
                .select('id, travel_date, price_per_seat')
                .eq('user_id', userId);

            if (tripsError) throw tripsError;

            const tripIds = tripsData?.map(t => t.id) || [];
            let pendingCount = 0;
            let todayEarnings = 0;
            let todayTripsCount = 0;

            const today = new Date().toISOString().split('T')[0];

            if (tripIds.length > 0) {
                // Pending requests
                const { data: pendingData, error: pendingError } = await supabase
                    .from('booking_requests')
                    .select('id', { count: 'exact' })
                    .in('trip_id', tripIds)
                    .eq('status', 'pending');

                if (pendingError) throw pendingError;
                pendingCount = pendingData?.length || 0;

                // Today's trips count
                todayTripsCount = tripsData.filter(t => t.travel_date === today).length;

                // Calculate earnings for today's trips
                // Get bookings for today's trips that are approved/completed
                const todayTripIds = tripsData.filter(t => t.travel_date === today).map(t => t.id);

                if (todayTripIds.length > 0) {
                    const { data: todayBookings } = await supabase
                        .from('booking_requests')
                        .select('trip_id, seats_requested, status')
                        .in('trip_id', todayTripIds)
                        .in('status', ['approved', 'completed', 'paid', 'in_progress']);

                    if (todayBookings) {
                        todayBookings.forEach(booking => {
                            const trip = tripsData.find(t => t.id === booking.trip_id);
                            if (trip) {
                                // 85% goes to driver as per app policy
                                todayEarnings += (booking.seats_requested * trip.price_per_seat) * 0.85;
                            }
                        });
                    }
                }
            }

            // Fetch Reviews & Ratings
            const { data: reviewsData } = await supabase
                .from('reviews')
                .select('rating')
                .eq('target_id', userId);

            let avgRating = 0;
            let revCount = 0;
            if (reviewsData && reviewsData.length > 0) {
                revCount = reviewsData.length;
                const sum = reviewsData.reduce((a, b) => a + (b.rating || 0), 0);
                avgRating = parseFloat((sum / revCount).toFixed(1));
            } else {
                // Default if no reviews
                avgRating = 5.0;
                revCount = 0;
            }

            setStats({
                activeTrips: activeTripsData?.length || 0,
                pendingRequests: pendingCount,
                earningsToday: Math.round(todayEarnings),
                tripsToday: todayTripsCount,
                rating: avgRating,
                reviewCount: revCount,
                isElite: avgRating >= 4.5 && revCount >= 5
            });

            // Fetch recent trips (last 3)
            const { data: recentTripsData, error: recentTripsError } = await supabase
                .from('trips')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(3);

            if (recentTripsError) throw recentTripsError;
            setRecentTrips(recentTripsData || []);

        } catch (error) {
            console.error('[DriverHome] Error fetching driver data:', error);
            toast.error('Failed to load driver data');
        } finally {
            setLoading(false);
        }
    };

    const setupRealtimeSubscriptions = () => {
        if (!session?.user) return;

        const userId = session.user.id;

        // Channel names are scoped to the userId so that when DriverHome remounts
        // on app resume, the new subscription does not collide with the previous
        // channel that may still be in the process of closing.
        const bookingChannel = supabase
            .channel(`driver_home_bookings_${userId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'booking_requests',
            }, (payload) => {
                console.log('[DriverHome] Booking update received:', payload);
                fetchDriverData(); // Refresh stats

                if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
                    toast.success('New booking request received!', {
                        icon: '🚗',
                        duration: 4000
                    });
                }
            })
            .subscribe();

        // Subscribe to trips updates
        const tripsChannel = supabase
            .channel(`driver_home_trips_${userId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'trips',
                filter: `user_id=eq.${userId}`,
            }, (payload) => {
                console.log('[DriverHome] Trip update received:', payload);
                fetchDriverData(); // Refresh stats and recent trips
            })
            .subscribe();

        return () => {
            supabase.removeChannel(bookingChannel);
            supabase.removeChannel(tripsChannel);
        };
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        } else {
            return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        }
    };

    const formatTime = (timeString) => {
        if (!timeString || typeof timeString !== 'string') return '';
        try {
            const [hours, minutes] = timeString.split(':');
            const hour = parseInt(hours);
            if (isNaN(hour)) return timeString;
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            return `${displayHour}:${minutes} ${ampm}`;
        } catch (e) {
            console.warn('Error formatting time:', timeString, e);
            return timeString || '';
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'active': return 'active';
            case 'completed': return 'completed';
            case 'cancelled': return 'cancelled';
            case 'in_progress': return 'full';
            default: return 'active';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'in_progress': return 'In Progress';
            default: return status;
        }
    };

    if (loading) {
        return (
            <div className="driver-home-container">
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <div className="loading-text">Loading your dashboard</div>
                </div>
            </div>
        );
    }

    return (
        <div className="driver-home-container">
            {/* Header */}
            <div className="driver-header">
                <div className="header-orb1"></div>
                <div className="header-orb2"></div>
                <div className="header-orb3"></div>
                <div className="header-top">
                    <div>
                        <div className="welcome-label">{greeting}</div>
                        <div className="driver-name">{driverName}</div>
                    </div>
                    <div className="header-actions">
                        <button className="icon-btn" onClick={() => onNavigate('bookingRequests')} aria-label="Notifications">
                            <Bell size={20} strokeWidth={2.5} />
                            {stats.pendingRequests > 0 && <div className="notif-dot"></div>}
                        </button>
                        <button className="icon-btn" onClick={() => onNavigate('profile')} aria-label="Profile">
                            <User size={20} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
                <div className="earnings-pill">
                    <div className="pill-col">
                        <div className="pill-label">Today's Earnings</div>
                        <div className="pill-value">₹{stats.earningsToday}</div>
                    </div>
                    <div className="pill-divider"></div>
                    <div className="pill-col pill-right">
                        <div className="pill-label">Trips Today</div>
                        <div className="pill-value">{stats.tripsToday}</div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="driver-content">
                {/* Online Toggle */}
                <div className="online-bar anim anim-1" id="onlineBar">
                    <div className="online-info-group">
                        <div className={`pulse-dot ${!isOnline ? 'offline' : ''}`} id="pulseDot"></div>
                        <div className="online-text-group">
                            <div className="online-title">{isOnline ? "You're Online" : "You're Offline"}</div>
                            <div className="online-subtitle">{isOnline ? 'Available to accept trips' : 'Not accepting new trips'}</div>
                        </div>
                    </div>
                    <button className={`toggle-btn ${!isOnline ? 'off' : ''}`} onClick={() => setIsOnline(!isOnline)} aria-label="Toggle online status">
                        <div className="toggle-thumb"></div>
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid anim anim-2">
                    <div className="stat-card amber" onClick={() => onNavigate('myTrips')}>
                        <div className="stat-icon amber">
                            <Zap size={22} strokeWidth={2.3} />
                        </div>
                        <div className="stat-bottom">
                            <div className="stat-value">{stats.activeTrips}</div>
                            <div className="stat-label">Active Trips</div>
                        </div>
                    </div>
                    <div className="stat-card blue" onClick={() => onNavigate('bookingRequests')}>
                        <div className="stat-icon blue">
                            <Clock size={22} strokeWidth={2.3} />
                        </div>
                        <div className="stat-bottom">
                            <div className="stat-value">{stats.pendingRequests}</div>
                            <div className="stat-label">Pending Requests</div>
                        </div>
                    </div>
                </div>

                {/* Rating Card */}
                <div className="rating-card anim anim-3">
                    <div className="rating-left">
                        <div className="rating-label">Your Rating</div>
                        <div className="rating-value">{stats.rating}</div>
                        <div className="rating-sub">Based on {stats.reviewCount} reviews</div>
                    </div>
                    <div className="rating-right">
                        <div className="stars">
                            {[1, 2, 3, 4, 5].map(star => (
                                <span key={star} className={`star ${star <= Math.round(stats.rating) ? 'filled' : 'dim'}`}>★</span>
                            ))}
                        </div>
                        {stats.isElite && <div className="badge-elite">🏆 Elite Driver</div>}
                    </div>
                </div>

                {/* Publish Trip Button */}
                <button className="publish-btn anim anim-3" onClick={() => onNavigate('publishTrip')}>
                    <div className="pub-icon">
                        <Plus size={26} strokeWidth={2.8} />
                    </div>
                    <div className="pub-texts">
                        <span className="pub-title">Publish a New Trip</span>
                        <span className="pub-sub">Set your route & schedule</span>
                    </div>
                    <ChevronRight size={18} strokeWidth={2.5} className="pub-arrow" />
                </button>

                {/* Quick Actions */}
                <div className="section-header anim anim-4">
                    <div className="section-title">Quick Actions</div>
                </div>
                <div className="actions-grid anim anim-4">
                    <div className="action-card" onClick={() => onNavigate('myTrips')}>
                        <div className="action-icon">
                            <List size={22} strokeWidth={2.2} />
                        </div>
                        <div className="action-label">My Trips</div>
                    </div>
                    <div className="action-card" onClick={() => onNavigate('driverWallet')}>
                        <div className="action-icon">
                            <IndianRupee size={22} strokeWidth={2.2} />
                        </div>
                        <div className="action-label">Earnings</div>
                    </div>
                    <div className="action-card" onClick={() => onNavigate('myTrips')}>
                        <div className="action-icon">
                            <Map size={22} strokeWidth={2.2} />
                        </div>
                        <div className="action-label">Route</div>
                    </div>
                    <div className="action-card" onClick={() => onNavigate('bookingRequests')}>
                        <div className="action-icon">
                            <Users size={22} strokeWidth={2.2} />
                        </div>
                        <div className="action-label">Riders</div>
                        {stats.pendingRequests > 0 && <div className="action-badge">{stats.pendingRequests}</div>}
                    </div>
                </div>

                {/* Recent Trips */}
                <div className="section-header anim anim-5">
                    <div className="section-title">Recent Trips</div>
                    {recentTrips.length > 0 && (
                        <button className="view-all" onClick={() => onNavigate('myTrips')}>View All</button>
                    )}
                </div>

                <div className="trips-list anim anim-6">
                    {recentTrips.length === 0 ? (
                        <div className="no-trips-message">
                            <p>No trips yet. Publish your first trip to get started!</p>
                        </div>
                    ) : (
                        recentTrips.map(trip => (
                            <div key={trip.id} className="trip-card" onClick={() => onNavigate('myTrips')}>
                                <div className="trip-route-visual">
                                    <div className="route-dot start"></div>
                                    <div className="route-line"></div>
                                    <div className="route-dot end"></div>
                                </div>
                                <div className="trip-body">
                                    <div className="trip-from">{trip.from_location}</div>
                                    <div className="trip-to">{trip.to_location}</div>
                                    <div className="trip-meta">
                                        <span>{formatDate(trip.travel_date)}, {formatTime(trip.travel_time)}</span>
                                        <span className="trip-meta-dot">·</span>
                                        <span>{trip.available_seats} seats</span>
                                    </div>
                                </div>
                                <div className="trip-right">
                                    <div className="trip-price">₹{trip.price_per_seat}</div>
                                    <div className={`trip-status ${getStatusClass(trip.status)}`}>
                                        {getStatusLabel(trip.status)}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Logout */}
                <button className="logout-btn anim anim-6" onClick={onLogout}>
                    <LogOut size={18} strokeWidth={2.5} />
                    Log Out
                </button>

            </div>
        </div>
    );
};

export default DriverHome;