import React, { useState, useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, X } from 'lucide-react';
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

        // Try to initialize AutocompleteService (Legacy) or check for AutocompleteSuggestion (New)
        if (placesLibrary) {
            if (placesLibrary.AutocompleteService) {
                try {
                    autocompleteService.current = new placesLibrary.AutocompleteService();
                } catch (error) {
                    console.warn('Legacy AutocompleteService init failing (expected for new keys):', error);
                }
            }

            if (!placesLibrary.AutocompleteSuggestion && !autocompleteService.current) {
                console.warn('Neither AutocompleteSuggestion nor AutocompleteService available. Using Geocoding fallback.');
                setUseGeocodingFallback(true);
            }
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
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(input)}&components=country:IN&key=${API_KEY}`
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
            if (useGeocodingFallback) {
                console.log('Using Geocoding fallback for:', val);
                fetchGeocodingPredictions(val);
            } else {
                // Try AutocompleteSuggestion (New API) first
                if (placesLibrary && placesLibrary.AutocompleteSuggestion) {
                    try {
                        const request = {
                            input: val,
                            includedRegionCodes: ['in'], // Restrict to India
                            // sessionToken: ... // Consider adding session token management later
                        };

                        // The new API is promise-based
                        placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
                            .then((response) => {
                                const { suggestions } = response;
                                if (suggestions && suggestions.length > 0) {
                                    const formattedResults = suggestions.map(suggestion => {
                                        const pp = suggestion.placePrediction;
                                        return {
                                            place_id: pp.placeId,
                                            description: pp.text.text, // Full text
                                            structured_formatting: {
                                                main_text: pp.structuredFormat?.mainText?.text || pp.text.text,
                                                secondary_text: pp.structuredFormat?.secondaryText?.text || ''
                                            }
                                        };
                                    });
                                    setPredictions(formattedResults);
                                    setShowPredictions(true);
                                } else {
                                    setPredictions([]);
                                    setShowPredictions(false);
                                }
                            })
                            .catch((err) => {
                                console.warn('AutocompleteSuggestion failed:', err);
                                // Fallback to Geocoding if new API fails (e.g. billing, errors)
                                setUseGeocodingFallback(true);
                                fetchGeocodingPredictions(val);
                            });
                    } catch (err) {
                        console.error('Error calling AutocompleteSuggestion:', err);
                        setUseGeocodingFallback(true);
                        fetchGeocodingPredictions(val);
                    }
                } else if (autocompleteService.current) {
                    // Fallback to old AutocompleteService if new one isn't found (though it's deprecated)
                    // This path might be dead if the service is fully removed for new keys, but good for safety.
                    try {
                        autocompleteService.current.getPlacePredictions({
                            input: val,
                            componentRestrictions: { country: 'in' },
                        }, (results, status) => {
                            if (status === 'OK' && results) {
                                setPredictions(results);
                                setShowPredictions(true);
                            } else if (status === 'ZERO_RESULTS') {
                                setPredictions([]);
                                setShowPredictions(false);
                            } else {
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
                } else {
                    // No services available
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

    const handleClear = () => {
        setInputValue('');
        setPredictions([]);
        setShowPredictions(false);
        onChange({ target: { name, value: '' } });
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

                {inputValue && (
                    <button
                        type="button"
                        className="location-input-clear-btn"
                        onClick={handleClear}
                        aria-label={`Clear ${name}`}
                    >
                        <X size={16} strokeWidth={2.5} />
                    </button>
                )}
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
                            <div className="prediction-icon">
                                <MapPin size={16} />
                            </div>
                            <div className="prediction-content">
                                <span className="prediction-main-text">
                                    {place.structured_formatting.main_text}
                                </span>
                                {place.structured_formatting.secondary_text && (
                                    <span className="prediction-secondary-text">
                                        {place.structured_formatting.secondary_text}
                                    </span>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default LocationInput;

