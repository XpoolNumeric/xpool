<<<<<<< HEAD
import React, { useState } from 'react';
import { ArrowLeft, Calendar, Car, Bike, Search, Star } from 'lucide-react';
=======
import React, { useState, useRef } from 'react';
import { ArrowLeft, Calendar, Car, Bike, Search, Star, MapPin, Clock, User } from 'lucide-react';
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
import { supabase } from '../../../supabaseClient';
import { calculateDistance } from '../../../utils/googleMapsHelper';
import toast from 'react-hot-toast';
import '../css/SearchTrips.css';

const SearchTrips = ({ onBack, onTripSelect, searchParams, session }) => {
    const [searchData, setSearchData] = useState({
        fromLocation: searchParams?.from_location || searchParams?.from || '',
        toLocation: searchParams?.to_location || searchParams?.to || '',
        fromCoords: searchParams?.from_coords || null,
        toCoords: searchParams?.to_coords || null,
        travelDate: searchParams?.travel_date || searchParams?.date || '',
        vehiclePreference: searchParams?.vehiclePreference || searchParams?.vehicle || 'any'
    });

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [routeInfo, setRouteInfo] = useState(null);

    // Filter & Sort State
    const [sortBy, setSortBy] = useState('earliest');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const sortedResults = React.useMemo(() => {
        let sorted = [...results];
        if (sortBy === 'price_asc') {
            sorted.sort((a, b) => (a.price_per_seat || 9999) - (b.price_per_seat || 9999));
        } else if (sortBy === 'price_desc') {
            sorted.sort((a, b) => (b.price_per_seat || 0) - (a.price_per_seat || 0));
        } else if (sortBy === 'earliest') {
            sorted.sort((a, b) => {
                const timeA = a.travel_time || '23:59';
                const timeB = b.travel_time || '23:59';
                return timeA.localeCompare(timeB);
            });
        }
        return sorted;
    }, [results, sortBy]);

    // Sheet expansion states
    const [isExpanded, setIsExpanded] = useState(false);
    const [touchStartPos, setTouchStartPos] = useState(0);
    const sheetRef = useRef(null);

    const handleTouchStart = (e) => {
        setTouchStartPos(e.targetTouches[0].clientY);
    };

    const handleTouchEnd = (e) => {
        if (!touchStartPos) return;
        const touchEndPos = e.changedTouches[0].clientY;
        const diff = touchStartPos - touchEndPos;

        // Check if the scroll area is at the top. If they are scrolled down,
        // we shouldn't collapse the sheet on a downward swipe.
        const isAtTop = sheetRef.current ? sheetRef.current.scrollTop === 0 : true;

        if (diff > 50) {
            // Swiped up -> expand sheet to full screen
            setIsExpanded(true);
        } else if (diff < -50 && isAtTop) {
            // Swiped down and at top -> collapse to default layout map view
            setIsExpanded(false);
        }
    };

    // Fetch real distance/duration from Google Maps on mount
    React.useEffect(() => {
        const fetchRouteInfo = async () => {
            const origin = searchData.fromCoords ? searchData.fromCoords : searchData.fromLocation;
            const dest = searchData.toCoords ? searchData.toCoords : searchData.toLocation;
            if (origin && dest) {
                try {
                    const info = await calculateDistance(origin, dest);
                    setRouteInfo(info);
                } catch (e) {
                    console.error('Route info fetch failed:', e);
                }
            }
        };
        fetchRouteInfo();
    }, [searchData.fromLocation, searchData.toLocation, searchData.fromCoords, searchData.toCoords]);

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

            // Extract city names (first comma-separated part) for cleaner matching
            // This prevents issues where full Google Places addresses cause fuzzy match failures
            const extractCity = (location) => {
                if (!location) return '';
                const trimmed = location.trim();
                // Pass "Current Location" as-is — SQL handles this specially
                if (trimmed.toLowerCase() === 'current location') return trimmed;
                // Extract the first part before comma (the city name)
                return trimmed.split(',')[0].trim();
            };

            const fromCity = extractCity(searchData.fromLocation);
            const toCity = extractCity(searchData.toLocation);

            console.log('Search cities:', { fromCity, toCity });

            const { data, error } = await supabase.functions.invoke('search-trips', {
                body: {
                    fromLocation: fromCity,
                    toLocation: toCity,
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
<<<<<<< HEAD
                            supabase.from('drivers').select('user_id, profile_photo_url').in('user_id', driverIds),
=======
                            supabase.from('drivers').select('user_id, profile_photo_url, vehicle_number, vehicle_type').in('user_id', driverIds),
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
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
<<<<<<< HEAD
                                reviewCount: ratingData ? ratingData.count : 0
=======
                                reviewCount: ratingData ? ratingData.count : 0,
                                vehicleNumber: driver?.vehicle_number || null,
                                vehicleType: driver?.vehicle_type || null,
                                vehicleColor: driver?.vehicle_color || null
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                            };
                        });

                        trips.forEach(trip => {
                            const dId = trip.user_id || trip.driver_id;
                            if (dId && driverInfoMap[dId]) {
                                trip.extended_driver_info = driverInfoMap[dId];
<<<<<<< HEAD
=======
                                // Fill in vehicle details from driver profile if trip doesn't have them
                                if (!trip.vehicle_number && driverInfoMap[dId].vehicleNumber) {
                                    trip.vehicle_number = driverInfoMap[dId].vehicleNumber;
                                }
                                if (!trip.vehicle_color && driverInfoMap[dId].vehicleColor) {
                                    trip.vehicle_color = driverInfoMap[dId].vehicleColor;
                                }
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                            }
                        });
                    }
                } catch (e) {
                    console.error('Failed to fetch extended driver info', e);
                }
            }

            setResults(trips);

            // Removed redundant toast notifications (empty state and results counter handle this)


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

    const formatLocationShort = (loc) => {
        if (!loc) return '';
        const parts = loc.split(',');
        const first = parts[0].trim();
        return first.length > 12 ? first.substring(0, 12) + '...' : first;
    };

    return (
        <div className="search-trips-layout">
            
            <div 
                className={`search-trips-sheet ${isExpanded ? 'expanded' : ''}`}
                ref={sheetRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div className="drag-handle"></div>

                <div className="sheet-header">
                    <button className="edit-search-btn" onClick={onBack}>
                        <div className="back-icon-wrapper">
                            <ArrowLeft size={16} />
                        </div>
                        Edit Search
                    </button>
                    <div className="route-pill-top">
                        <MapPin size={12} />
                        <span>{formatLocationShort(searchData.fromLocation)}</span>
                        <span style={{color: '#f59e0b'}}>→</span>
                        <span>{formatLocationShort(searchData.toLocation)}</span>
                    </div>
                </div>

                <div className="title-row" style={{position: 'relative'}}>
                    <h1>Available Rides</h1>
                    <button 
                        className={`filter-btn-outline ${isFilterOpen ? 'active' : ''}`} 
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                        </svg>
                    </button>
                    
                    {isFilterOpen && (
                        <div className="sort-dropdown" style={{
                            position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                            background: 'white', borderRadius: '12px', padding: '0.5rem',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 100,
                            minWidth: '180px', border: '1px solid #fde68a'
                        }}>
                            <div style={{fontSize: '0.75rem', fontWeight: 800, color: '#9ca3af', padding: '0.5rem', textTransform: 'uppercase'}}>Sort By</div>
                            <button 
                                onClick={() => { setSortBy('earliest'); setIsFilterOpen(false); }}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', 
                                    background: sortBy === 'earliest' ? '#fffbeb' : 'transparent', border: 'none', 
                                    borderRadius: '8px', color: sortBy === 'earliest' ? '#d97706' : '#4b5563', 
                                    fontWeight: sortBy === 'earliest' ? 700 : 600, fontSize: '0.85rem'
                                }}>
                                Earliest Departure
                            </button>
                            <button 
                                onClick={() => { setSortBy('price_asc'); setIsFilterOpen(false); }}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', 
                                    background: sortBy === 'price_asc' ? '#fffbeb' : 'transparent', border: 'none', 
                                    borderRadius: '8px', color: sortBy === 'price_asc' ? '#d97706' : '#4b5563', 
                                    fontWeight: sortBy === 'price_asc' ? 700 : 600, fontSize: '0.85rem', marginTop: '4px'
                                }}>
                                Lowest Price
                            </button>
                            <button 
                                onClick={() => { setSortBy('price_desc'); setIsFilterOpen(false); }}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', 
                                    background: sortBy === 'price_desc' ? '#fffbeb' : 'transparent', border: 'none', 
                                    borderRadius: '8px', color: sortBy === 'price_desc' ? '#d97706' : '#4b5563', 
                                    fontWeight: sortBy === 'price_desc' ? 700 : 600, fontSize: '0.85rem', marginTop: '4px'
                                }}>
                                Highest Price
                            </button>
                        </div>
                    )}
                </div>

                <div className="summary-pills">
                    <div className="info-pill"><MapPin size={12} /> {routeInfo ? routeInfo.distance : '...'}</div>
                    <div className="info-pill"><Clock size={12} /> {routeInfo ? routeInfo.duration : '...'}</div>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Searching for preferred rides...</p>
                    </div>
                ) : hasSearched && results.length === 0 ? (
                    <div className="empty-state">
                        <Search size={48} color="#fcd34d" style={{marginBottom: '1rem'}} />
                        <h3 style={{fontSize: '1.2rem', margin: '0 0 0.5rem', color: '#1f2937'}}>No rides found</h3>
                        <p style={{fontSize: '0.85rem', color: '#6b7280'}}>Try adjusting your route, date or check back later.</p>
                    </div>
                ) : (
<<<<<<< HEAD
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
=======
                    hasSearched && (
                        <>
                            <div className="results-divider">
                                <span>{results.length} RIDES FOUND</span>
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                            </div>

                            <div className="rides-list">
                                {sortedResults.map(trip => (
                                    <div
                                        key={trip.id}
                                        className="ride-card"
                                        onClick={() => onTripSelect(trip)}
                                    >
                                        <div className="card-left">
                                            <div className="avatar-wrapper" style={{ padding: trip.extended_driver_info?.avatar ? '0' : undefined, overflow: 'hidden' }}>
                                                {trip.extended_driver_info?.avatar ? (
                                                    <img 
                                                        src={trip.extended_driver_info.avatar} 
                                                        alt="Driver" 
                                                    />
                                                ) : (
                                                    <User size={24} />
                                                )}
                                            </div>

                                            <div className="driver-info-block">
                                                <div className="driver-name-row">
                                                    <h3>{trip.extended_driver_info?.fullName || trip.driver_name || 'Driver'}</h3>
                                                    <svg className="verified-badge" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                                                    </svg>
                                                </div>

                                                <div className="rating-row">
                                                    <div className="rating-pill-card">
                                                        <Star size={10} fill="currentColor" />
                                                        {trip.extended_driver_info?.rating || "4.8"}
                                                    </div>
                                                    <span className="rides-count">{trip.extended_driver_info?.reviewCount || 0} rides</span>
                                                </div>

                                                <div className="vehicle-info">
                                                    <div className="vehicle-icon-circle">
                                                        {trip.vehicle_type === 'car' ? <Car size={12} /> : <Bike size={12} />}
                                                    </div>
                                                    <div className="vehicle-details">
                                                        <span className="name">{trip.vehicle_type === 'car' ? 'Car' : 'Bike'} • {trip.vehicle_color || 'Standard'}</span>
                                                        <span className="plate">{trip.vehicle_number || 'Not provided'}</span>
                                                    </div>
                                                </div>

                                                <div className="driver-actual-route" style={{ marginTop: '8px', padding: '6px 10px', background: '#fdfce8', border: '1px solid #fef08a', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', color: '#854d0e', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                    <MapPin size={12} color="#eab308" />
                                                    <span>{formatLocationShort(trip.from_location)}</span>
                                                    <span style={{color: '#d97706', margin: '0 2px'}}>→</span>
                                                    <span>{formatLocationShort(trip.to_location)}</span>
                                                </div>

                                                {trip.ac_available !== false && <div className="feature-pill">AC</div>}
                                            </div>
                                        </div>

                                        <div className="card-right">
                                            <div className="price-block">
                                                <span className="currency-symbol">₹</span>
                                                <span className="price-amount">{trip.price_per_seat || '—'}</span>
                                            </div>
                                            
                                            {trip.price_per_seat && (
                                                <div className="save-pill">
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                                                    Save ₹{Math.floor(trip.price_per_seat * 0.05)}
                                                </div>
                                            )}

                                            <div className="seat-label">
                                                FOR 1 SEAT
                                            </div>

                                            <div className="time-pill-right">
                                                <Clock size={10} />
                                                {trip.formatted_time || formatTime(trip.travel_time) || '2:00 PM'}
                                            </div>

                                            <div className="seats-left-pill">
                                                <User size={10} />
                                                {trip.available_seats} left
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )
                )}
            </div>
        </div>
    );
};

export default SearchTrips;