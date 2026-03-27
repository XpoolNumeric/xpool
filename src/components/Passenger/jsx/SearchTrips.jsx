import React, { useState } from 'react';
import { ArrowLeft, Calendar, Car, Bike, Search } from 'lucide-react';
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
                                        <div className="driver-avatar">
                                            {(trip.driver_name || 'D').charAt(0)}
                                        </div>
                                        <div>
                                            <h3>{trip.driver_name || 'Driver'}</h3>
                                            <span className="vehicle-type">
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