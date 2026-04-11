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
 * (Helper now waits for the centrally-loaded API from APIProvider in App.jsx)
 * @param {string} apiKey - Google Maps API key (not used in refactored version)
 * @returns {Promise<void>}
 */
export const loadGoogleMapsScript = (apiKey) => {
    if (window.google && window.google.maps) {
        mapsScriptLoaded = true;
        return Promise.resolve();
    }

    if (mapsScriptPromise) {
        return mapsScriptPromise;
    }

    mapsScriptPromise = new Promise((resolve) => {
        // Poll for window.google to be available (max 10 seconds)
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (window.google && window.google.maps) {
                clearInterval(interval);
                mapsScriptLoaded = true;
                resolve();
            } else if (attempts > 50) { // 10 seconds total (200ms * 50)
                clearInterval(interval);
                console.warn('Google Maps API not found after 10 seconds.');
                resolve(); // Resolve to let caller fail naturally or check again
            }
        }, 200);
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
// Ultra-Premium Minimalist Monochrome Map Style
const customMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#f8f9fa" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8b8d96" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 4 }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#e2e8f0" }] },
    { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e2e8f0" }] },
    { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: "#e2e8f0" }] },
    { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }, { weight: 2 }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#cbd5e1" }] },
    { featureType: "road.highway.controlled_access", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }, { weight: 2.5 }] },
    { featureType: "road.highway.controlled_access", elementType: "geometry.stroke", stylers: [{ color: "#cbd5e1" }] },
    { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] }
];

export const initializeMap = (containerId, center = { lat: 20.5937, lng: 78.9629 }, zoom = 5) => {
    const mapContainer = document.getElementById(containerId);

    if (!mapContainer) {
        throw new Error(`Map container with ID "${containerId}" not found`);
    }

    const map = new window.google.maps.Map(mapContainer, {
        center,
        zoom,
        mapId: 'XPOOL_MAP_ID', // Required for AdvancedMarkerElement
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        styles: customMapStyle,
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
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: '#f59e0b',
            strokeWeight: 6,
            strokeOpacity: 1,
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            zIndex: 50
        },
    });

    const request = {
        origin,
        destination,
        waypoints: (waypoints || []).map(wp => ({ location: wp, stopover: true })),
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
    };

    return new Promise((resolve, reject) => {
        directionsService.route(request, (result, status) => {
            if (status === 'OK') {
                directionsRenderer.setDirections(result);

                const route = result.routes[0];
                const leg = route.legs[0];

                // Create custom dot markers using DOM elements (reliable with AdvancedMarkerElement)
                const createDotMarker = (isDestination = false) => {
                    const container = document.createElement('div');
                    container.style.position = 'relative';
                    container.style.width = '24px';
                    container.style.height = '24px';
                    container.style.display = 'flex';
                    container.style.alignItems = 'center';
                    container.style.justifyContent = 'center';

                    // Pulsing ripple for destination
                    if (isDestination) {
                        const pulse = document.createElement('div');
                        pulse.style.cssText = 'position:absolute;width:100%;height:100%;background:rgba(245,158,11,0.4);border-radius:50%;animation:marker-pulse 2s infinite;';
                        container.appendChild(pulse);
                    }

                    const dot = document.createElement('div');
                    dot.style.cssText = `width:16px;height:16px;background:${isDestination ? '#f59e0b' : '#111827'};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);position:relative;z-index:2;`;
                    container.appendChild(dot);

                    // Add global animation style if not exists
                    if (!document.getElementById('marker-animation-style')) {
                        const style = document.createElement('style');
                        style.id = 'marker-animation-style';
                        style.textContent = `
                            @keyframes marker-pulse {
                                0% { transform: scale(1); opacity: 1; }
                                100% { transform: scale(3); opacity: 0; }
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    return container;
                };

                // Add start and end markers
                if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
                    new window.google.maps.marker.AdvancedMarkerElement({
                        map, position: leg.start_location, title: 'Start', content: createDotMarker(false)
                    });
                    new window.google.maps.marker.AdvancedMarkerElement({
                        map, position: leg.end_location, title: 'End', content: createDotMarker(true)
                    });
                } else {
                    // Fallback: legacy markers with SVG icon
                    const svgIcon = (color) => ({
                        url: 'data:image/svg+xml;utf-8,' + encodeURIComponent(`<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="${color}" stroke="white" stroke-width="3"/></svg>`),
                        scaledSize: new window.google.maps.Size(24, 24),
                        anchor: new window.google.maps.Point(12, 12)
                    });
                    new window.google.maps.Marker({ map, position: leg.start_location, title: 'Start', icon: svgIcon('#111827') });
                    new window.google.maps.Marker({ map, position: leg.end_location, title: 'End', icon: svgIcon('#f59e0b') });
                }
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
