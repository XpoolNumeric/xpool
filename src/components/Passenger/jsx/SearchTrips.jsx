import React, { useState } from 'react';
import { ArrowLeft, Calendar, Car, Bike, Search, WifiOff } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { APIProvider } from '@vis.gl/react-google-maps';
import LocationInput from '../../common/LocationInput';
import { isOnline, waitForNetwork, isWebView, getSafeSession } from '../../../utils/webViewHelper';
import '../css/SearchTrips.css';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const SearchTrips = ({ onBack, onTripSelect, searchParams }) => {
    const [searchData, setSearchData] = useState({
        fromLocation: searchParams?.from || '',
        toLocation: searchParams?.to || '',
        travelDate: searchParams?.date || '',
        vehiclePreference: searchParams?.vehicle || 'any'
    });

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSearchData(prev => ({
            ...prev,
            [name]: value
        }));
    };

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
            console.log('Invoking find-rides function...');

            const { data, error } = await supabase.functions.invoke('find-rides', {
                body: {
                    from_location: searchData.fromLocation,
                    to_location: searchData.toLocation,
                    travel_date: searchData.travelDate || '',
                    seats_required: 1,
                    vehicle_type: searchData.vehiclePreference || 'any',
                    page: 1,
                    limit: 20
                }
            });

            if (error) {
                console.error('Function error:', error);
                throw new Error(error.message || 'Search failed');
            }

            if (!data.success) {
                throw new Error(data.error || 'Search operation failed');
            }

            // Transform to your UI format
            const formattedTrips = data.data.map(trip => ({
                id: trip.id,
                driver_name: trip.driver.name,
                vehicle_type: trip.vehicle_type,
                price_per_seat: trip.price_per_seat,
                from_location: trip.from_location,
                to_location: trip.to_location,
                travel_date: trip.travel_date,
                travel_time: trip.travel_time,
                available_seats: trip.available_seats,
                status: trip.status,
                ladies_only: trip.preferences.ladies_only,
                no_smoking: trip.preferences.no_smoking,
                pet_friendly: trip.preferences.pet_friendly,
                match_score: trip.match_score,
                driver_avatar: trip.driver.avatar
            }));

            setResults(formattedTrips);

            if (formattedTrips.length === 0) {
                toast('No trips found', { icon: '🔍' });
            } else {
                toast.success(`Found ${formattedTrips.length} trips`);
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
        return new Date(dateStr).toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
    };

    const formatTime = (timeStr) => {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    // Get today's date as minimum (Local time fix)
    const today = (() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    })();

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

            {/* Results - No Form here as it's now on Home page */}

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
                                            {trip.driver_name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3>{trip.driver_name}</h3>
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
                                        {formatDate(trip.travel_date)}
                                    </span>
                                    <span className="meta-item">
                                        <span className="time-icon">🕐</span>
                                        {formatTime(trip.travel_time)}
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
