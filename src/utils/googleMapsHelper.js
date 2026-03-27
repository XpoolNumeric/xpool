import { supabase } from '../supabaseClient';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Google Maps Helper Functions
 * Handles Google Maps JavaScript API integration
 */

let mapsScriptLoaded = false;
let mapsScriptPromise = null;

/**
 * Load Google Maps JavaScript API script dynamically
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<void>}
 */
export const loadGoogleMapsScript = (apiKey) => {
    if (mapsScriptLoaded) {
        return Promise.resolve();
    }

    if (mapsScriptPromise) {
        return mapsScriptPromise;
    }

    mapsScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
            mapsScriptLoaded = true;
            resolve();
        };

        script.onerror = () => {
            reject(new Error('Failed to load Google Maps script'));
        };

        document.head.appendChild(script);
    });

    return mapsScriptPromise;
};

/**
 * Initialize a Google Map instance
 * @param {string} containerId - DOM element ID for map container
 * @param {object} center - {lat, lng} center coordinates
 * @param {number} zoom - Initial zoom level
 * @returns {google.maps.Map}
 */
export const initializeMap = (containerId, center = { lat: 20.5937, lng: 78.9629 }, zoom = 5) => {
    const mapContainer = document.getElementById(containerId);

    if (!mapContainer) {
        throw new Error(`Map container with ID "${containerId}" not found`);
    }

    const map = new window.google.maps.Map(mapContainer, {
        center,
        zoom,
        mapId: 'XPOOL_MAP_ID', // Required for AdvancedMarkerElement
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
    });

    return map;
};

/**
 * Create and display a route on the map
 * @param {google.maps.Map} map - Map instance
 * @param {string} origin - Origin address or coordinates
 * @param {string} destination - Destination address or coordinates
 * @param {Array} waypoints - Optional waypoints
 * @returns {Promise<object>} Route information
 */
export const createRoute = async (map, origin, destination, waypoints = []) => {
    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
        polylineOptions: {
            strokeColor: '#FFD700',
            strokeWeight: 5,
        },
    });

    const request = {
        origin,
        destination,
        waypoints: waypoints.map(wp => ({ location: wp, stopover: true })),
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
    };

    return new Promise((resolve, reject) => {
        directionsService.route(request, (result, status) => {
            if (status === 'OK') {
                directionsRenderer.setDirections(result);

                const route = result.routes[0];
                const leg = route.legs[0];

                resolve({
                    distance: leg.distance.text,
                    duration: leg.duration.text,
                    distanceValue: leg.distance.value,
                    durationValue: leg.duration.value,
                    steps: leg.steps,
                    route: result,
                });
            } else {
                reject(new Error(`Directions request failed: ${status}`));
            }
        });
    });
};

/**
 * Start navigation with turn-by-turn directions
 * @param {string} origin - Origin address
 * @param {string} destination - Destination address
 * @returns {Promise<object>} Navigation data
 */
export const startNavigation = async (origin, destination) => {
    const directionsService = new window.google.maps.DirectionsService();

    const request = {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
    };

    return new Promise((resolve, reject) => {
        directionsService.route(request, (result, status) => {
            if (status === 'OK') {
                const route = result.routes[0];
                const leg = route.legs[0];

                resolve({
                    steps: leg.steps.map((step, index) => ({
                        stepNumber: index + 1,
                        instruction: step.instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
                        distance: step.distance.text,
                        duration: step.duration.text,
                        maneuver: step.maneuver || 'straight',
                    })),
                    totalDistance: leg.distance.text,
                    totalDuration: leg.duration.text,
                });
            } else {
                reject(new Error(`Navigation request failed: ${status}`));
            }
        });
    });
};

/**
 * Get user's current location
 * @returns {Promise<object>} {lat, lng}
 */
export const getCurrentLocation = async () => {
    try {
        if (Capacitor.isNativePlatform()) {
            // First check permission status
            const permission = await Geolocation.checkPermissions();
            if (permission.location !== 'granted') {
                const request = await Geolocation.requestPermissions();
                if (request.location !== 'granted') {
                    throw new Error('Location permission denied');
                }
            }

            // Get current position using Capacitor Geolocation
            const position = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });

            return {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            };
        } else {
            // Fallback for Web
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Geolocation is not supported by your browser'));
                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        resolve({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        });
                    },
                    (error) => {
                        reject(error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0,
                    }
                );
            });
        }
    } catch (error) {
        console.error('Error getting current location:', error);
        throw error;
    }
};

/**
 * Add traffic layer to map
 * @param {google.maps.Map} map - Map instance
 * @returns {google.maps.TrafficLayer}
 */
export const addTrafficLayer = (map) => {
    const trafficLayer = new window.google.maps.TrafficLayer();
    trafficLayer.setMap(map);
    return trafficLayer;
};

/**
 * Calculate distance between two points
 * @param {string} origin - Origin address or coordinates
 * @param {string} destination - Destination address or coordinates
 * @returns {Promise<object>} Distance information
 */
export const calculateDistance = async (origin, destination) => {
    const service = new window.google.maps.DistanceMatrixService();

    return new Promise((resolve, reject) => {
        service.getDistanceMatrix(
            {
                origins: [origin],
                destinations: [destination],
                travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (response, status) => {
                if (status === 'OK') {
                    const result = response.rows[0].elements[0];
                    if (result.status === 'OK') {
                        resolve({
                            distance: result.distance.text,
                            duration: result.duration.text,
                            distanceValue: result.distance.value,
                            durationValue: result.duration.value,
                        });
                    } else {
                        reject(new Error(`Distance calculation failed for element: ${result.status}`));
                    }
                } else {
                    reject(new Error(`Distance calculation failed: ${status}`));
                }
            }
        );
    });
};

/**
 * Geocode an address to coordinates
 * @param {string} address - Address to geocode
 * @returns {Promise<object>} {lat, lng}
 */
export const geocodeAddress = async (address) => {
    const geocoder = new window.google.maps.Geocoder();

    return new Promise((resolve, reject) => {
        geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK' && results[0]) {
                const location = results[0].geometry.location;
                resolve({
                    lat: location.lat(),
                    lng: location.lng(),
                    formattedAddress: results[0].formatted_address,
                });
            } else {
                reject(new Error(`Geocoding failed: ${status}`));
            }
        });
    });
};

/**
 * Add a marker to the map
 * @param {google.maps.Map} map - Map instance
 * @param {object} position - {lat, lng}
 * @param {string} title - Marker title
 * @param {string} icon - Optional custom icon URL
 * @returns {google.maps.Marker}
 */
export const addMarker = (map, position, title, icon = null) => {
    // Try to use AdvancedMarkerElement (modern)
    if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
        try {
            const markerOptions = {
                map,
                position,
                title,
            };

            if (icon) {
                const img = document.createElement('img');
                img.src = icon;
                img.width = 30;
                img.height = 30;
                markerOptions.content = img;
            }

            return new window.google.maps.marker.AdvancedMarkerElement(markerOptions);
        } catch (e) {
            console.warn('AdvancedMarkerElement failed, falling back to legacy Marker:', e);
        }
    }

    // Fallback to legacy Marker
    const markerOptions = {
        position,
        map,
        title,
        animation: window.google.maps.Animation.DROP,
    };

    if (icon) {
        markerOptions.icon = icon;
    }

    return new window.google.maps.Marker(markerOptions);
};
