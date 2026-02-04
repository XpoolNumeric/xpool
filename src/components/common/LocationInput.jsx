import React, { useState, useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin } from 'lucide-react';
import './LocationInput.css';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const LocationInput = ({ label, placeholder, value, onChange, onPlaceSelect, className, iconColor, name, Icon }) => {
    const placesLibrary = useMapsLibrary('places');
    const [predictions, setPredictions] = useState([]);
    const [showPredictions, setShowPredictions] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const [useGeocodingFallback, setUseGeocodingFallback] = useState(false);
    const autocompleteService = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!placesLibrary) return;

        // Try to initialize AutocompleteService
        try {
            autocompleteService.current = new placesLibrary.AutocompleteService();
        } catch (error) {
            console.warn('AutocompleteService not available, using Geocoding API fallback:', error);
            setUseGeocodingFallback(true);
        }
    }, [placesLibrary]);

    useEffect(() => {
        setInputValue(value);
    }, [value]);

    // Geocoding API fallback for mobile/deprecated API
    const fetchGeocodingPredictions = async (input) => {
        try {
            if (!API_KEY) {
                console.error('Google Maps API Key missing');
                return;
            }

            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(input)}&components=country:IN&key=${API_KEYAIzaSyB7_39jR-kqbchHlKHzBtmWbtAbY8jrtbw}`
            );
            const data = await response.json();

            if (data.status === 'OK' && data.results) {
                // Convert geocoding results to autocomplete-like format
                const formattedResults = data.results.slice(0, 5).map((result, index) => ({
                    place_id: result.place_id || `geocode_${index}`,
                    description: result.formatted_address,
                    structured_formatting: {
                        main_text: result.address_components[0]?.long_name || result.formatted_address.split(',')[0],
                        secondary_text: result.formatted_address.split(',').slice(1).join(',').trim()
                    }
                }));
                setPredictions(formattedResults);
                setShowPredictions(true);
            } else if (data.status === 'ZERO_RESULTS') {
                setPredictions([]);
                setShowPredictions(false);
            } else {
                console.error('Geocoding API error status:', data.status, data.error_message);
                // Only toast on error if it's not ZERO_RESULTS
                toast.error(`Search Error: ${data.status} - ${data.error_message || 'Unknown'}`);
                setPredictions([]);
                setShowPredictions(false);
            }
        } catch (error) {
            console.error('Geocoding API network error:', error);
            setPredictions([]);
            setShowPredictions(false);
        }
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        onChange({ target: { name, value: val } }); // Propagate change to parent

        if (val.length > 2) {
            // Use Geocoding API fallback if AutocompleteService is not available or explicitly enabled
            if (useGeocodingFallback || !autocompleteService.current) {
                console.log('Using Geocoding fallback for:', val);
                fetchGeocodingPredictions(val);
            } else {
                // Try AutocompleteService first
                try {
                    autocompleteService.current.getPlacePredictions({
                        input: val,
                        componentRestrictions: { country: 'in' }, // Restrict to India
                    }, (results, status) => {
                        console.log('Autocomplete status:', status);
                        if (status === 'OK' && results) {
                            setPredictions(results);
                            setShowPredictions(true);
                        } else if (status === 'ZERO_RESULTS') {
                            setPredictions([]);
                            setShowPredictions(false);
                        } else {
                            // Detailed error logging
                            console.warn(`Autocomplete failed with status: ${status}. Switching to Geocoding API.`);
                            setUseGeocodingFallback(true);
                            fetchGeocodingPredictions(val);
                        }
                    });
                } catch (err) {
                    console.error('AutocompleteService crashed:', err);
                    setUseGeocodingFallback(true);
                    fetchGeocodingPredictions(val);
                }
            }
        } else {
            setPredictions([]);
            setShowPredictions(false);
        }
    };

    const handlePredictionSelect = (prediction) => {
        const val = prediction.description;
        setInputValue(val);
        setPredictions([]);
        setShowPredictions(false);
        onChange({ target: { name, value: val } });
        if (onPlaceSelect) {
            onPlaceSelect(prediction);
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (inputRef.current && !inputRef.current.contains(event.target)) {
                setShowPredictions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="location-input-container" ref={inputRef}>
            {/* Standard Input Structure matching existing CSS */}
            <div className={`search-input-group ${className}`}>
                {label && <label className="input-label-hidden">{label}</label>} {/* Hidden but accessible */}
                {iconColor && (
                    <div className={`search-input-icon ${iconColor}`}>
                        {Icon ? <Icon size={18} /> : <MapPin size={18} />}
                    </div>
                )}

                <input
                    type="text"
                    name={name}
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={handleInputChange}
                    className={!iconColor ? "form-input location-input-field" : "location-input-field"}
                    autoComplete="off"
                />
            </div>

            {/* Predictions List */}
            {showPredictions && predictions.length > 0 && (
                <ul className="predictions-list">
                    {predictions.map((place) => (
                        <li
                            key={place.place_id}
                            onClick={() => handlePredictionSelect(place)}
                            className="prediction-item"
                        >
                            <MapPin size={14} color="#666" />
                            {place.structured_formatting.main_text}
                            <span className="prediction-secondary-text">
                                {place.structured_formatting.secondary_text}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default LocationInput;

