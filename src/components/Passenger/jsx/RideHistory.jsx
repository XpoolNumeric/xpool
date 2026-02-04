import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, MapPin, User, Star } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { formatDate, formatTime } from '../../../utils/dateHelper';
import '../css/RideHistory.css';

const RideHistory = ({ onBack, onViewDetails }) => {
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'completed', 'cancelled'

    useEffect(() => {
        fetchRideHistory();
    }, []);

    const fetchRideHistory = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

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
            status,
            user_id
          )
        `)
                .eq('passenger_id', user.id)
                .in('status', ['approved', 'cancelled'])
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch driver details
            const ridesWithDrivers = await Promise.all(
                (data || []).map(async (ride) => {
                    if (ride.trips?.user_id) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('full_name')
                            .eq('id', ride.trips.user_id)
                            .single();

                        // Fetch driver rating
                        const { data: ratings } = await supabase
                            .from('reviews')
                            .select('rating')
                            .eq('target_id', ride.trips.user_id);

                        let avgRating = 0;
                        if (ratings && ratings.length > 0) {
                            avgRating = (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1);
                        }

                        return {
                            ...ride,
                            driver_name: profile?.full_name || 'Driver',
                            driver_rating: avgRating || 'New',
                        };
                    }
                    return ride;
                })
            );

            setRides(ridesWithDrivers);
        } catch (error) {
            console.error('Error fetching ride history:', error);
            toast.error('Failed to load ride history');
        } finally {
            setLoading(false);
        }
    };

    const filteredRides = rides.filter(ride => {
        if (filter === 'all') return true;
        if (filter === 'completed') return ride.trips?.status === 'completed';
        if (filter === 'cancelled') return ride.status === 'cancelled';
        return true;
    });

    // Loading state is now handled inside the main return to keep header visible

    return (
        <div className="ride-history-container">
            {/* Header */}
            <div className="history-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1>Ride History</h1>
                <div className="header-spacer" />
            </div>

            {/* Filter Tabs */}
            {!loading && (
                <div className="filter-tabs">
                    <button
                        className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </button>
                    <button
                        className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
                        onClick={() => setFilter('completed')}
                    >
                        Completed
                    </button>
                    <button
                        className={`filter-tab ${filter === 'cancelled' ? 'active' : ''}`}
                        onClick={() => setFilter('cancelled')}
                    >
                        Cancelled
                    </button>
                </div>
            )}

            {/* Content Section */}
            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading ride history...</p>
                </div>
            ) : (
                <div className="history-content">
                    {filteredRides.length === 0 ? (
                        <div className="empty-state">
                            <Calendar size={64} />
                            <h3>No Ride History</h3>
                            <p>
                                {filter === 'all'
                                    ? "You haven't completed any rides yet"
                                    : `No ${filter} rides`}
                            </p>
                        </div>
                    ) : (
                        <div className="rides-list">
                            {filteredRides.map(ride => (
                                <div key={ride.id} className={`ride-card ${ride.trips?.status || ride.status}`}>
                                    {/* Date Badge */}
                                    <div className="date-badge">
                                        <Calendar size={14} />
                                        {formatDate(ride.trips?.travel_date, 'short')}
                                    </div>

                                    {/* Route */}
                                    <div className="ride-route">
                                        <div className="route-point">
                                            <div className="dot from"></div>
                                            <div className="location-info">
                                                <span className="location">{ride.trips?.from_location}</span>
                                            </div>
                                        </div>
                                        <div className="route-line"></div>
                                        <div className="route-point">
                                            <div className="dot to"></div>
                                            <div className="location-info">
                                                <span className="location">{ride.trips?.to_location}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Driver Info */}
                                    <div className="driver-info">
                                        <div className="driver-avatar">
                                            <User size={20} />
                                        </div>
                                        <div className="driver-details">
                                            <span className="driver-name">{ride.driver_name}</span>
                                            <div className="driver-rating">
                                                <Star size={12} fill="#FFD700" color="#FFD700" />
                                                <span>{ride.driver_rating}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Trip Details */}
                                    <div className="trip-details">
                                        <div className="detail-item">
                                            <span className="label">Time:</span>
                                            <span className="value">{formatTime(ride.trips?.travel_time)}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Seats:</span>
                                            <span className="value">{ride.seats_requested}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Payment:</span>
                                            <span className="value">{ride.payment_mode === 'cod' ? 'Cash' : 'Online'}</span>
                                        </div>
                                        {ride.trips?.price_per_seat && (
                                            <div className="detail-item total">
                                                <span className="label">Total:</span>
                                                <span className="value">₹{ride.trips.price_per_seat * ride.seats_requested}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Status Badge */}
                                    <div className={`status-badge ${ride.trips?.status || ride.status}`}>
                                        {ride.trips?.status === 'completed' ? 'Completed' :
                                            ride.status === 'cancelled' ? 'Cancelled' : ride.trips?.status}
                                    </div>

                                    {/* Actions */}
                                    {onViewDetails && (
                                        <button
                                            className="view-details-btn"
                                            onClick={() => onViewDetails(ride)}
                                        >
                                            View Details
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RideHistory;
