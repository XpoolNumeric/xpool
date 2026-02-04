import React, { useState, useEffect } from 'react';
import { User, Wallet, MapPin, Calendar, LogOut, Plus, List, Bell, ChevronRight } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import '../css/DriverHome.css';

const DriverHome = ({
    session,
    onPublishTrip,
    onMyTrips,
    onBookingRequests,
    onProfile,
    onWallet,
    onLogout
}) => {
    const [loading, setLoading] = useState(true);
    const [driverName, setDriverName] = useState('Driver');
    const [stats, setStats] = useState({
        activeTrips: 0,
        pendingRequests: 0
    });
    const [recentTrips, setRecentTrips] = useState([]);

    useEffect(() => {
        if (session?.user) {
            fetchDriverData();
            setupRealtimeSubscriptions();
        } else {
            // Safety check: If loaded without session, don't get stuck in loading
            setLoading(false);
            // Optional: You could trigger onLogout() here if strict
        }
    }, [session]);

    const fetchDriverData = async () => {
        try {
            setLoading(true);
            const userId = session.user.id;

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

            // Fetch active trips count
            const { data: activeTripsData, error: activeTripsError } = await supabase
                .from('trips')
                .select('id', { count: 'exact' })
                .eq('user_id', userId)
                .eq('status', 'active');

            if (activeTripsError) throw activeTripsError;

            // Fetch pending booking requests count
            const { data: tripsData, error: tripsError } = await supabase
                .from('trips')
                .select('id')
                .eq('user_id', userId);

            if (tripsError) throw tripsError;

            const tripIds = tripsData?.map(t => t.id) || [];
            let pendingCount = 0;

            if (tripIds.length > 0) {
                const { data: pendingData, error: pendingError } = await supabase
                    .from('booking_requests')
                    .select('id', { count: 'exact' })
                    .in('trip_id', tripIds)
                    .eq('status', 'pending');

                if (pendingError) throw pendingError;
                pendingCount = pendingData?.length || 0;
            }

            setStats({
                activeTrips: activeTripsData?.length || 0,
                pendingRequests: pendingCount
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

        // Subscribe to booking requests updates
        const bookingChannel = supabase
            .channel('driver_home_bookings')
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
            .channel('driver_home_trips')
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
        if (!timeString) return '';
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
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
                    <div className="loading-spinner"></div>
                    <p className="loading-text">Loading Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="driver-home-container animate-page-in">
            {/* Header */}
            <div className="driver-header">
                <div className="header-content">
                    <div className="welcome-section">
                        <span className="welcome-label">Welcome Back</span>
                        <h1 className="driver-name">{driverName}</h1>
                    </div>
                    <div className="header-actions">
                        <button className="icon-btn" onClick={onProfile}>
                            <User size={22} />
                        </button>
                        <button className="icon-btn" onClick={onLogout}>
                            <LogOut size={22} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="driver-content">
                {/* Stats Grid */}
                <div className="stats-grid">
                    <div className="stat-card active" onClick={onMyTrips}>
                        <div className="stat-icon">
                            <MapPin size={24} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.activeTrips}</div>
                            <div className="stat-label">Active Trips</div>
                        </div>
                    </div>

                    <div className="stat-card pending" onClick={onBookingRequests}>
                        <div className="stat-icon">
                            <Bell size={24} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.pendingRequests}</div>
                            <div className="stat-label">Pending Requests</div>
                        </div>
                        {stats.pendingRequests > 0 && (
                            <div className="notification-badge">{stats.pendingRequests}</div>
                        )}
                    </div>
                </div>

                {/* Publish Trip Button */}
                <button className="publish-trip-btn" onClick={onPublishTrip}>
                    <div className="btn-icon">
                        <Plus size={28} />
                    </div>
                    <div className="btn-text">
                        <span className="btn-title">Publish a Trip</span>
                        <span className="btn-subtitle">Share your ride and earn</span>
                    </div>
                    <ChevronRight size={24} className="btn-arrow" />
                </button>

                {/* Quick Actions */}
                <div className="quick-actions">
                    <h2 className="section-title">Quick Actions</h2>
                    <div className="actions-grid">
                        <button className="action-card" onClick={onMyTrips}>
                            <List size={32} />
                            <span>My Trips</span>
                        </button>
                        <button className="action-card" onClick={onBookingRequests}>
                            <Bell size={32} />
                            <span>Requests</span>
                            {stats.pendingRequests > 0 && (
                                <div className="action-badge">{stats.pendingRequests}</div>
                            )}
                        </button>
                        <button className="action-card" onClick={onWallet}>
                            <Wallet size={32} />
                            <span>Wallet</span>
                        </button>
                    </div>
                </div>

                {/* Recent Trips */}
                <div className="recent-trips">
                    <div className="section-header">
                        <h2 className="section-title">Recent Trips</h2>
                        {recentTrips.length > 0 && (
                            <button className="view-all-btn" onClick={onMyTrips}>
                                View All
                            </button>
                        )}
                    </div>

                    {recentTrips.length === 0 ? (
                        <div className="no-trips-message">
                            <p>No trips yet. Publish your first trip to get started!</p>
                        </div>
                    ) : (
                        <div className="trips-list">
                            {recentTrips.map(trip => (
                                <div key={trip.id} className="trip-card" onClick={onMyTrips}>
                                    <div className="trip-icon">
                                        <MapPin size={20} />
                                    </div>
                                    <div className="trip-info">
                                        <div className="trip-route">
                                            <span className="from">{trip.from_location}</span>
                                            <span className="arrow">→</span>
                                            <span className="to">{trip.to_location}</span>
                                        </div>
                                        <div className="trip-meta">
                                            <Calendar size={12} />
                                            <span>{formatDate(trip.travel_date)}</span>
                                            <span className="dot">•</span>
                                            <span>{formatTime(trip.travel_time)}</span>
                                        </div>
                                    </div>
                                    <div className={`trip-status ${getStatusClass(trip.status)}`}>
                                        {getStatusLabel(trip.status)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DriverHome;