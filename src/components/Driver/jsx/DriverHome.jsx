import React, { useState, useEffect, useCallback } from 'react';
import { User, Wallet, MapPin, Calendar, LogOut, Plus, List, Bell, ChevronRight, Zap, Clock, Map, Users, Star, IndianRupee, CheckCheck, X, CheckCircle2, XCircle, Car, Flag, CreditCard, Key, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllNotifications, getUnreadCount, markAllNotificationsAsRead, markNotificationAsRead } from '../../../utils/notificationHelper';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import Chat from '../../common/Chat';
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
    const [recentReviews, setRecentReviews] = useState([]);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifList, setNotifList] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifLoading, setNotifLoading] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [activeChat, setActiveChat] = useState(null); // { tripId, bookingId }

    const fetchNotifications = useCallback(async () => {
        const userId = session?.user?.id;
        if (!userId) return;
        setNotifLoading(true);
        try {
            const [allNotifs, count] = await Promise.all([
                getAllNotifications(userId, 30),
                getUnreadCount(userId)
            ]);
            setNotifList(allNotifs);
            setUnreadCount(count);
        } catch (e) {
            console.error('Error fetching notifications:', e);
        } finally {
            setNotifLoading(false);
        }
    }, [session?.user?.id]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Real-time subscription for new notifications from DB
    useEffect(() => {
        const userId = session?.user?.id;
        if (!userId) return;
        const channel = supabase
            .channel(`driver_notif_bell_${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`
            }, () => {
                fetchNotifications();
            })
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [session?.user?.id, fetchNotifications]);

    const handleMarkAllRead = async () => {
        const userId = session?.user?.id;
        if (!userId) return;
        await markAllNotificationsAsRead(userId);
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

    const formatMessageTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const fetchConversations = async (userId) => {
        try {
            // 1. Fetch bookings that are approved or in_progress, for the driver's trips
            const { data: bookings, error: bookingsError } = await supabase
                .from('booking_requests')
                .select(`
                    id,
                    trip_id,
                    passenger_id,
                    seats_requested,
                    status,
                    trips!inner (
                        id,
                        from_location,
                        to_location,
                        travel_date,
                        travel_time,
                        status,
                        user_id
                    )
                `)
                .eq('driver_id', userId)
                .in('status', ['approved', 'in_progress']);

            if (bookingsError) throw bookingsError;

            // 2. Filter bookings where trip is active or in_progress
            const activeBookings = (bookings || []).filter(b => 
                b.trips && ['active', 'in_progress'].includes(b.trips.status)
            );

            if (activeBookings.length === 0) {
                setConversations([]);
                return;
            }

            // 3. Fetch passenger profiles
            const passengerIds = [...new Set(activeBookings.map(b => b.passenger_id).filter(Boolean))];
            let profilesMap = {};
            if (passengerIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', passengerIds);
                if (profiles) {
                    profiles.forEach(p => {
                        profilesMap[p.id] = p.full_name;
                    });
                }
            }

            // 4. Fetch last message for each booking to display/calculate unread count
            const bookingIds = activeBookings.map(b => b.id);
            const { data: messages, error: messagesError } = await supabase
                .from('messages')
                .select('id, booking_id, sender_id, content, created_at')
                .in('booking_id', bookingIds)
                .order('created_at', { ascending: false });

            // 5. Map conversations with passenger name, last message, and unread count
            const mappedConvs = activeBookings.map(b => {
                const bookingMessages = (messages || []).filter(m => m.booking_id === b.id);
                const lastMsg = bookingMessages[0] || null;
                const lastReadTimeStr = localStorage.getItem(`xpool_chat_read_${b.id}`) || '1970-01-01T00:00:00.000Z';
                const lastReadTime = new Date(lastReadTimeStr);

                // Unread messages: sender is not driver (userId) and message was created after lastReadTime
                const unreadCount = bookingMessages.filter(m => 
                    m.sender_id !== userId && new Date(m.created_at) > lastReadTime
                ).length;

                return {
                    booking_id: b.id,
                    trip_id: b.trip_id,
                    passenger_id: b.passenger_id,
                    passenger_name: profilesMap[b.passenger_id] || 'Passenger',
                    from_location: b.trips.from_location,
                    to_location: b.trips.to_location,
                    travel_date: b.trips.travel_date,
                    travel_time: b.trips.travel_time,
                    last_message: lastMsg ? lastMsg.content : 'No messages yet',
                    last_message_time: lastMsg ? lastMsg.created_at : null,
                    unread_count: unreadCount
                };
            });

            // Sort conversations so the one with the latest message is at the top
            mappedConvs.sort((a, b) => {
                if (!a.last_message_time) return 1;
                if (!b.last_message_time) return -1;
                return new Date(b.last_message_time) - new Date(a.last_message_time);
            });

            setConversations(mappedConvs);
        } catch (err) {
            console.error('Error fetching conversations:', err);
        }
    };

    const handleOpenChat = (conv) => {
        // Mark as read in localStorage
        localStorage.setItem(`xpool_chat_read_${conv.booking_id}`, new Date().toISOString());
        // Update local state immediately
        setConversations(prev => prev.map(c => 
            c.booking_id === conv.booking_id ? { ...c, unread_count: 0 } : c
        ));
        setActiveChat({ tripId: conv.trip_id, bookingId: conv.booking_id });
    };

    const handleCloseChat = () => {
        setActiveChat(null);
        const userId = session?.user?.id;
        if (userId) {
            fetchConversations(userId);
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
                        .select('id, trip_id, seats_requested, status')
                        .in('trip_id', todayTripIds)
                        .in('status', ['completed', 'paid']); // Only sum when completed

                    if (todayBookings && todayBookings.length > 0) {
                        const bookingIds = todayBookings.map(b => b.id);
                        
                        // Try to get actual calculated amounts from ride_payments
                        const { data: payments } = await supabase
                            .from('ride_payments')
                            .select('booking_id, driver_amount')
                            .in('booking_id', bookingIds);

                        todayBookings.forEach(booking => {
                            const payment = payments?.find(p => p.booking_id === booking.id);
                            if (payment && payment.driver_amount) {
                                todayEarnings += payment.driver_amount;
                            } else {
                                // Fallback if ride_payments doesn't exist
                                const trip = tripsData.find(t => t.id === booking.trip_id);
                                if (trip) {
                                    todayEarnings += (booking.seats_requested * trip.price_per_seat) * 0.85;
                                }
                            }
                        });
                    }
                }
            }

            // Fetch Reviews & Ratings
            // Check both auth user ID and driver ID to ensure retro-compatibility if reviews used either
            const targetIds = driverId ? `target_id.eq.${userId},target_id.eq.${driverId}` : `target_id.eq.${userId}`;
            
            const { data: reviewsData, error: reviewsError } = await supabase
                .from('reviews')
                .select('rating')
                .or(targetIds);

            if (reviewsError) {
                console.error("Error fetching reviews:", reviewsError);
            }

            let avgRating = 0;
            let revCount = 0;
            let fetchedRecentReviews = [];
            
            if (reviewsData && reviewsData.length > 0) {
                const validReviews = reviewsData.filter(r => r.rating != null);
                revCount = validReviews.length;
                if (revCount > 0) {
                    const sum = validReviews.reduce((a, b) => a + Number(b.rating), 0);
                    avgRating = Number((sum / revCount).toFixed(1));
                }

                // Get top 3 recent reviews that have comments
                // Need to re-query with comments since the original query only fetched rating to save bandwidth
            }

            // Fetch top 3 recent reviews with comments
            const { data: detailedReviews } = await supabase
                .from('reviews')
                .select('id, rating, comment, created_at, reviewer_id')
                .or(targetIds)
                .order('created_at', { ascending: false });
                
            if (detailedReviews && detailedReviews.length > 0) {
                fetchedRecentReviews = detailedReviews.filter(r => r.comment && r.comment.trim() !== '').slice(0, 3);
                
                if (fetchedRecentReviews.length > 0) {
                    const reviewerIds = [...new Set(fetchedRecentReviews.map(r => r.reviewer_id))];
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .in('id', reviewerIds);
                    
                    if (profiles) {
                        fetchedRecentReviews = fetchedRecentReviews.map(r => {
                            const profile = profiles.find(p => p.id === r.reviewer_id);
                            return {
                                ...r,
                                reviewer_name: profile?.full_name || 'Passenger'
                            };
                        });
                    }
                }
            }
            
            setRecentReviews(fetchedRecentReviews);

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

            setRecentTrips(recentTripsData || []);

            // Fetch conversations
            await fetchConversations(userId);


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

        // Subscribe to messages updates
        const messagesChannel = supabase
            .channel(`driver_home_messages_${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
            }, (payload) => {
                console.log('[DriverHome] Message update received:', payload);
                fetchConversations(userId);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(bookingChannel);
            supabase.removeChannel(tripsChannel);
            supabase.removeChannel(messagesChannel);
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
                        <button className="icon-btn" onClick={toggleNotifPanel} aria-label="Notifications">
                            <Bell size={20} strokeWidth={2.5} />
                            {(unreadCount > 0 || stats.pendingRequests > 0) && <div className="notif-dot"></div>}
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
                        <div className="rating-value">{stats.reviewCount > 0 ? stats.rating.toFixed(1) : 'New'}</div>
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
                        {stats.tripsToday > 0 && <div className="action-badge">{stats.tripsToday}</div>}
                    </div>
                    <div className="action-card" onClick={() => onNavigate('driverWallet')}>
                        <div className="action-icon">
                            <Wallet size={22} strokeWidth={2.2} />
                        </div>
                        <div className="action-label">Wallet</div>
                    </div>
                    <div className="action-card" onClick={() => onNavigate('bookingRequests')}>
                        <div className="action-icon">
                            <Users size={22} strokeWidth={2.2} />
                        </div>
                        <div className="action-label">Requests</div>
                        {stats.pendingRequests > 0 && <div className="action-badge">{stats.pendingRequests}</div>}
                    </div>
                </div>

                {/* Messages Section */}
                <div className="section-header anim anim-5">
                    <div className="section-title">Messages</div>
                </div>

                <div className="conversations-list anim anim-5">
                    {conversations.length === 0 ? (
                        <div className="no-conversations-message">
                            <p>No active conversations. Booked passenger chats will appear here.</p>
                        </div>
                    ) : (
                        conversations.map(conv => (
                            <div key={conv.booking_id} className="conversation-card" onClick={() => handleOpenChat(conv)}>
                                <div className="conversation-avatar">
                                    <MessageSquare size={20} />
                                    {conv.unread_count > 0 && (
                                        <div className="unread-badge-bubble">{conv.unread_count}</div>
                                    )}
                                </div>
                                <div className="conversation-body">
                                    <div className="conversation-header-row">
                                        <span className="passenger-name">{conv.passenger_name}</span>
                                        {conv.last_message_time && (
                                            <span className="message-time">
                                                {formatMessageTime(conv.last_message_time)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="trip-route-sub">
                                        {conv.from_location.split(',')[0]} → {conv.to_location.split(',')[0]}
                                    </div>
                                    <div className={`last-message-text ${conv.unread_count > 0 ? 'unread' : ''}`}>
                                        {conv.last_message}
                                    </div>
                                </div>
                                <ChevronRight size={18} className="arrow-icon" />
                            </div>
                        ))
                    )}
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

                {/* Recent Reviews */}
                {recentReviews.length > 0 && (
                    <>
                        <div className="section-header anim anim-6" style={{ marginTop: '20px' }}>
                            <div className="section-title">Recent Feedback</div>
                        </div>
                        <div className="reviews-list anim anim-6">
                            {recentReviews.map(review => (
                                <div key={review.id} className="review-card">
                                    <div className="review-header">
                                        <div className="reviewer-info">
                                            <div className="reviewer-avatar">
                                                <User size={16} />
                                            </div>
                                            <div className="reviewer-name">{review.reviewer_name}</div>
                                        </div>
                                        <div className="review-stars">
                                            <Star size={14} className="star-icon filled" />
                                            <span>{review.rating}.0</span>
                                        </div>
                                    </div>
                                    <div className="review-comment">"{review.comment}"</div>
                                    <div className="review-date">{formatDate(review.created_at)}</div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Logout */}
                <button className="logout-btn anim anim-6" onClick={onLogout}>
                    <LogOut size={18} strokeWidth={2.5} />
                    Log Out
                </button>

            </div>

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

            {/* Chat Overlay */}
            <AnimatePresence>
                {activeChat && (
                    <motion.div
                        className="chat-overlay-container"
                        initial={{ opacity: 0, y: '100%' }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 1000,
                            background: 'white',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <Chat
                            tripId={activeChat.tripId}
                            bookingId={activeChat.bookingId}
                            currentUserId={session?.user?.id}
                            onBack={handleCloseChat}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DriverHome;