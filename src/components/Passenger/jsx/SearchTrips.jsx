import React, { useState } from 'react';
import { ArrowLeft, Calendar, Car, Bike, Search, Star } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import '../css/SearchTrips.css';

const SearchTrips = ({ onBack, onTripSelect, searchParams, session }) => {
    const [searchData, setSearchData] = useState({
        fromLocation: searchParams?.from || '',
        toLocation: searchParams?.to || '',
        travelDate: searchParams?.date || '',
        vehiclePreference: searchParams?.vehicle || 'any'
    });

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Auto-search on mount if params are provided
    React.useEffect(() => {
        if (searchParams) {
            console.log('SearchTrips mounted with params:', searchParams);
            handleSearch();
        }
    }, []);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();

        if (!searchData.fromLocation.trim() || !searchData.toLocation.trim()) {
            toast.error('Please enter both From and To locations');
            return;
        }

        setLoading(true);
        setHasSearched(true);

        try {
            // Get current session for auth token
            const { data: { session: currentSession } } = await supabase.auth.getSession();

            if (!currentSession) {
                toast.error('Please log in again');
                setLoading(false);
                return;
            }

            console.log('Invoking search-trips function...');

            const { data, error } = await supabase.functions.invoke('search-trips', {
                body: {
                    fromLocation: searchData.fromLocation,
                    toLocation: searchData.toLocation,
                    travelDate: searchData.travelDate || '',
                    vehiclePreference: searchData.vehiclePreference || 'any',
                    page: 1,
                    pageSize: 20
                }
            });

            if (error) {
                console.error('Function error:', error);
                throw new Error(error.message || 'Search failed');
            }

            if (!data.success) {
                throw new Error(data.error || 'Search operation failed');
            }

            // Use the trips data directly from the RPC response
            const trips = data.data || [];

            // Fetch extra driver data (photo & ratings)
            if (trips.length > 0) {
                try {
                    const driverIds = [...new Set(trips.map(t => t.user_id || t.driver_id).filter(Boolean))];
                    
                    if (driverIds.length > 0) {
                        const [{ data: profiles }, { data: driversResult }, { data: reviews }] = await Promise.all([
                            supabase.from('profiles').select('id, full_name, avatar_url').in('id', driverIds),
                            supabase.from('drivers').select('user_id, profile_photo_url').in('user_id', driverIds),
                            supabase.from('reviews').select('target_id, rating').in('target_id', driverIds)
                        ]);

                        const ratingsMap = {};
                        if (reviews) {
                            reviews.forEach(review => {
                                if (!ratingsMap[review.target_id]) {
                                    ratingsMap[review.target_id] = { sum: 0, count: 0 };
                                }
                                ratingsMap[review.target_id].sum += review.rating;
                                ratingsMap[review.target_id].count += 1;
                            });
                        }

                        const driverInfoMap = {};
                        driverIds.forEach(id => {
                            const profile = profiles?.find(p => p.id === id);
                            const driver = driversResult?.find(d => d.user_id === id);
                            const ratingData = ratingsMap[id];
                            
                            driverInfoMap[id] = {
                                fullName: profile?.full_name || 'Driver',
                                avatar: driver?.profile_photo_url || profile?.avatar_url || null,
                                rating: ratingData && ratingData.count > 0 ? (ratingData.sum / ratingData.count).toFixed(1) : "5.0",
                                reviewCount: ratingData ? ratingData.count : 0
                            };
                        });

                        trips.forEach(trip => {
                            const dId = trip.user_id || trip.driver_id;
                            if (dId && driverInfoMap[dId]) {
                                trip.extended_driver_info = driverInfoMap[dId];
                            }
                        });
                    }
                } catch (e) {
                    console.error('Failed to fetch extended driver info', e);
                }
            }

            setResults(trips);

            if (trips.length === 0) {
                toast('No trips found', { icon: '🔍' });
            } else {
                toast.success(`Found ${trips.length} trips`);
            }

        } catch (error) {
            console.error('Search error:', error);
            toast.error(error.message || 'Search failed');
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    return (
        <div className="search-trips-container">
            {/* Header */}
            <div className="search-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1>Search Trips</h1>
                <div className="header-spacer" />
            </div>

            {/* Results */}
            <div className="results-section">
                {hasSearched && (
                    <div className="results-header">
                        <h2>
                            {results.length} {results.length === 1 ? 'Trip' : 'Trips'} Found
                        </h2>
                    </div>
                )}

                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Searching for trips...</p>
                    </div>
                ) : hasSearched && results.length === 0 ? (
                    <div className="empty-state">
                        <Search size={48} />
                        <h3>No trips found</h3>
                        <p>Try adjusting your search criteria or check back later</p>
                    </div>
                ) : (
                    <div className="results-list">
                        {results.map(trip => (
                            <div
                                key={trip.id}
                                className="trip-result-card"
                                onClick={() => onTripSelect(trip)}
                            >
                                <div className="trip-card-header">
                                    <div className="driver-info">
                                        <div className="driver-avatar" style={{ padding: trip.extended_driver_info?.avatar ? '0' : undefined, overflow: 'hidden' }}>
                                            {trip.extended_driver_info?.avatar ? (
                                                <img 
                                                    src={trip.extended_driver_info.avatar} 
                                                    alt="Driver" 
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                />
                                            ) : (
                                                (trip.extended_driver_info?.fullName || trip.driver_name || 'D').charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className="driver-header-details">
                                            <h3>{trip.extended_driver_info?.fullName || trip.driver_name || 'Driver'}</h3>
                                            
                                            {trip.extended_driver_info?.rating && (
                                                <div className="driver-rating" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', marginBottom: '4px', fontSize: '13px', color: '#4B5563' }}>
                                                    <Star size={14} fill="#EAB308" color="#EAB308" />
                                                    <span style={{ fontWeight: '700', color: '#111827' }}>{trip.extended_driver_info.rating}</span>
                                                    <span style={{ color: '#9CA3AF' }}>({trip.extended_driver_info.reviewCount})</span>
                                                </div>
                                            )}
                                            
                                            <span className="vehicle-type" style={{ marginTop: trip.extended_driver_info?.rating ? '0' : '4px' }}>
                                                {trip.vehicle_type === 'car' ? <Car size={14} /> : <Bike size={14} />}
                                                {trip.vehicle_type}
                                            </span>
                                        </div>
                                    </div>
                                    {trip.price_per_seat && (
                                        <div className="price">
                                            ₹{trip.price_per_seat}
                                            <span>/seat</span>
                                        </div>
                                    )}
                                </div>

                                <div className="trip-route">
                                    <div className="route-point from">
                                        <div className="dot"></div>
                                        <span>{trip.from_location}</span>
                                    </div>
                                    <div className="route-line"></div>
                                    <div className="route-point to">
                                        <div className="dot"></div>
                                        <span>{trip.to_location}</span>
                                    </div>
                                </div>

                                <div className="trip-meta">
                                    <span className="meta-item">
                                        <Calendar size={14} />
                                        {trip.formatted_date || formatDate(trip.travel_date)}
                                    </span>
                                    <span className="meta-item">
                                        <span className="time-icon">🕐</span>
                                        {trip.formatted_time || formatTime(trip.travel_time)}
                                    </span>
                                    <span className="meta-item seats">
                                        {trip.available_seats} seat{trip.available_seats > 1 ? 's' : ''} left
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchTrips;