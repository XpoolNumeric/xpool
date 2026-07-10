import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, Search, MapPin, Navigation, Car, Bike, Info, Menu, ShieldCheck, Map as MapIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import { useRealtime } from '../hooks/useRealtime';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────────────────────────────────────
// Map Configuration & Styling
// ─────────────────────────────────────────────────────────────────────────────
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };
const CENTER = { lat: 12.0168, lng: 78.9558 }; // Center between Bengaluru, Chennai, Coimbatore
const OPTIONS = {
    disableDefaultUI: true,
    zoomControl: true,
    styles: [
        { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#7c93a3" }, { lightness: "-10" }] },
        { featureType: "administrative.country", elementType: "geometry", stylers: [{ visibility: "on" }] },
        { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#a0a4a5" }] },
        { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#a0a4a5" }] },
        { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#e3f0ff" }] },
        { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#5185ba" }] },
        { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#f8fafc" }] },
        { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#f1f5f9" }] },
        { featureType: "poi", elementType: "geometry", stylers: [{ color: "#e2e8f0" }] },
        { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#fcd34d" }] }, // Amber highway
        { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#f59e0b" }] }, // Amber stroke
        { featureType: "transit", elementType: "geometry", stylers: [{ color: "#cbd5e1" }] }
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Icons & Mocks
// ─────────────────────────────────────────────────────────────────────────────
const VEHICLE_SVGS = {
    car: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="%23f59e0b" stroke="%23ffffff" stroke-width="4"/><circle cx="16" cy="16" r="4" fill="%23ffffff"/></svg>`,
    bike: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="%233b82f6" stroke="%23ffffff" stroke-width="4"/><circle cx="16" cy="16" r="4" fill="%23ffffff"/></svg>`,
    auto: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="%2310b981" stroke="%23ffffff" stroke-width="4"/><circle cx="16" cy="16" r="4" fill="%23ffffff"/></svg>`,
};

const VEHICLE_ICONS = {
    car: VEHICLE_SVGS.car,
    bike: VEHICLE_SVGS.bike,
    auto: VEHICLE_SVGS.auto,
    suv: VEHICLE_SVGS.car,
};

const CITIES = [
    { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
    { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
    { name: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
    { name: 'Puducherry', lat: 11.9416, lng: 79.8083 },
    { name: 'Salem', lat: 11.6643, lng: 78.1460 },
];

const generateRandomLocation = (cityLat, cityLng, spread = 0.08) => ({
    lat: cityLat + (Math.random() - 0.5) * spread,
    lng: cityLng + (Math.random() - 0.5) * spread
});

const GlobalStyles = () => (
    <style>{`
      .inter-font { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      
      .glass-input {
        background: rgba(255, 255, 255, 0.7);
        border: 1px solid rgba(245, 158, 11, 0.3);
        transition: all 0.2s;
      }
      .glass-input:focus {
        background: #fff;
        border-color: rgba(245, 158, 11, 0.8);
        outline: none;
        box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.15);
      }
      .map-marker-pulse {
        animation: markerPulse 2s infinite;
      }
      @keyframes markerPulse {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
        70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
      }
      /* Hide scrollbar for smooth UI */
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const LiveTracking = () => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
    });

    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);

    // Panel & Map State
    const [panelOpen, setPanelOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [vehicleFilter, setVehicleFilter] = useState('all');
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [mapInstance, setMapInstance] = useState(null);

    const fetchTrackingData = async () => {
        setLoading(true);
        try {
            const { data: approvedDrivers, error } = await supabase
                .from('drivers')
                .select('*')
                .eq('status', 'approved');

            if (error) throw error;

            // Generate deterministic mock coordinates
            const trackedDrivers = (approvedDrivers || []).map((driver, index) => {
                const baseCity = CITIES[index % CITIES.length];
                const loc = generateRandomLocation(baseCity.lat, baseCity.lng);

                const vType = driver.vehicle_type?.toLowerCase() || 'car';
                const iconType = vType.includes('bike') ? 'bike' : vType.includes('auto') ? 'auto' : 'car';

                return {
                    ...driver,
                    location: loc,
                    city: baseCity.name,
                    iconType: iconType,
                    speed: Math.floor(Math.random() * 40) + 10 // km/h
                };
            });

            setDrivers(trackedDrivers);
        } catch (error) {
            console.error("Failed to fetch drivers for tracking:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrackingData();
    }, []);

    useRealtime('drivers', fetchTrackingData);

    const filteredDrivers = useMemo(() => {
        return drivers.filter(d => {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch =
                d.full_name?.toLowerCase().includes(searchLower) ||
                d.id.substring(0, 8).toLowerCase().includes(searchLower) ||
                d.vehicle_number?.toLowerCase().includes(searchLower);

            const matchesVehicle = vehicleFilter === 'all' || d.iconType === vehicleFilter;
            return matchesSearch && matchesVehicle;
        });
    }, [drivers, searchQuery, vehicleFilter]);

    const handleDriverSelect = (driver) => {
        setSelectedDriver(driver);
        if (mapInstance && driver.location) {
            mapInstance.panTo(driver.location);
            mapInstance.setZoom(14);
            // On mobile, automatically close the overlay list when a driver is selected
            if (window.innerWidth < 1024) setPanelOpen(false);
        }
    };

    return (
        <div className="dashboard-container bg-white overflow-hidden" style={{ minHeight: '100vh', position: 'relative' }}>
            <GlobalStyles />
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className={`dashboard-content-wrapper relative z-10 w-full h-screen transition-all duration-300 flex flex-col pt-16 ${sidebarOpen ? 'md:ml-64 lg:ml-72' : 'ml-0'}`}>

                {/* 1. Underlying FULL MAP view */}
                <div className="absolute inset-x-0 bottom-0 top-16 z-0 bg-gray-100">
                    {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-900/60 backdrop-blur-md">
                            <div className="bg-white p-6 rounded-2xl max-w-sm text-center shadow-2xl m-4">
                                <Info className="mx-auto text-amber-500 mb-4" size={40} />
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Maps API Key Missing</h3>
                                <p className="text-gray-500 text-sm">Please add VITE_GOOGLE_MAPS_API_KEY to your .env file to view the full screen map interface.</p>
                            </div>
                        </div>
                    )}

                    {isLoaded ? (
                        <GoogleMap
                            mapContainerStyle={MAP_CONTAINER_STYLE}
                            center={CENTER}
                            zoom={7}
                            options={OPTIONS}
                            onLoad={map => setMapInstance(map)}
                            onClick={() => setSelectedDriver(null)}
                        >


                            {/* Driver Markers */}
                            {filteredDrivers.map(driver => (
                                <Marker
                                    key={driver.id}
                                    position={driver.location}
                                    icon={{
                                        url: VEHICLE_ICONS[driver.iconType] || VEHICLE_ICONS.car,
                                        scaledSize: selectedDriver?.id === driver.id
                                            ? new window.google.maps.Size(48, 48)
                                            : new window.google.maps.Size(32, 32),
                                        className: selectedDriver?.id === driver.id ? 'map-marker-pulse' : ''
                                    }}
                                    onClick={() => handleDriverSelect(driver)}
                                >
                                    {selectedDriver?.id === driver.id && (
                                        <InfoWindow
                                            position={driver.location}
                                            onCloseClick={() => setSelectedDriver(null)}
                                            options={{ pixelOffset: new window.google.maps.Size(0, -40) }}
                                        >
                                            <div className="p-3 min-w-[160px] font-inter">
                                                <h4 className="font-bold text-gray-900 text-base m-0 leading-tight block truncate">{driver.full_name}</h4>
                                                <p className="text-[11px] font-black text-amber-600 mt-1 uppercase underline mb-3 inline-block">ID: {driver.vehicle_number}</p>
                                                <div className="flex flex-col gap-1.5 text-[11px] font-semibold text-gray-600 border-t border-gray-100 pt-2">
                                                    <div className="flex items-center gap-2"><MapPin size={12} className="text-emerald-500" /> {driver.city} Zone</div>
                                                    <div className="flex items-center gap-2"><Navigation size={12} className="text-blue-500" /> Active • {driver.speed}km/h</div>
                                                </div>
                                            </div>
                                        </InfoWindow>
                                    )}
                                </Marker>
                            ))}
                        </GoogleMap>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-50">
                            <Loader2 className="animate-spin text-amber-500" size={40} />
                        </div>
                    )}
                </div>

                {/* 2. Floating Overlays Layer (over the exact map bounds) */}
                <div className="relative z-10 w-full h-[calc(100vh-4rem)] p-4 sm:p-6 pointer-events-none flex flex-col items-end md:items-start gap-3">

                    {/* Floating Toggle Button */}
                    <button
                        onClick={() => setPanelOpen(!panelOpen)}
                        className="pointer-events-auto shrink-0 shadow-2xl bg-white/95 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-gray-100/50 flex items-center gap-3 font-extrabold tracking-tight text-gray-900 hover:bg-gray-50 transition-all hover:scale-105 active:scale-95 z-20"
                    >
                        {panelOpen ? <MapPin size={22} className="text-gray-400" /> : <Menu size={22} className="text-amber-500" />}
                        {panelOpen ? 'Hide Fleet Controls' : 'Show Fleet Controls'}
                    </button>

                    {/* Expandable Fleet Control Panel Container */}
                    <AnimatePresence>
                        {panelOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                className="pointer-events-auto flex flex-col w-full sm:max-w-sm bg-white/95 backdrop-blur-2xl border border-white/50 rounded-[2rem] p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden h-[60vh] md:h-[calc(100vh-12rem)] min-h-[400px]"
                            >
                                <div className="shrink-0 mb-4">
                                    <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2 mb-4">
                                        <ShieldCheck className="text-emerald-500" size={24} /> Radar Active Fleet
                                        <span className="ml-auto bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 text-[10px] font-black uppercase tracking-widest">{filteredDrivers.length} Online</span>
                                    </h2>

                                    {/* Search Input inside Floating Panel */}
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3.5 top-1/2 -transform-translate-y-1/2 text-gray-400 -mt-2.5" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Find driver, ID, or vehicle..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-gray-800 font-semibold placeholder-gray-400 focus:shadow-amber-500/20 shadow-inner"
                                        />
                                    </div>

                                    {/* Filter Mini-Chips Row */}
                                    <div className="flex items-center gap-1.5 p-1 bg-gray-100/60 rounded-xl overflow-x-auto pb-1 scrollbar-hide">
                                        {[
                                            { id: 'all', label: 'All', icon: MapIcon },
                                            { id: 'car', label: 'Cars', icon: Car },
                                            { id: 'bike', label: 'Bikes', icon: Bike },
                                            { id: 'auto', label: 'Autos', icon: Navigation }
                                        ].map(filter => (
                                            <button
                                                key={filter.id}
                                                onClick={() => setVehicleFilter(filter.id)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap",
                                                    vehicleFilter === filter.id
                                                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/30"
                                                        : "text-gray-500 hover:bg-white hover:text-gray-900"
                                                )}
                                            >
                                                <filter.icon size={13} strokeWidth={2.5} />
                                                <span>{filter.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Active Drivers Scrollable List */}
                                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-hide">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-12 opacity-50">
                                            <Loader2 size={30} className="animate-spin text-gray-400 mb-3" />
                                            <p className="text-[10px] font-black tracking-widest text-gray-400">CONNECTING TO GPS...</p>
                                        </div>
                                    ) : filteredDrivers.length === 0 ? (
                                        <div className="text-center py-10 text-gray-400 text-sm font-semibold">No drivers map current search.</div>
                                    ) : (
                                        filteredDrivers.map(driver => (
                                            <button
                                                key={driver.id}
                                                onClick={() => handleDriverSelect(driver)}
                                                className={cn(
                                                    "w-full text-left p-3.5 rounded-[1rem] transition-all duration-200 border flex flex-col gap-2 group relative overflow-hidden",
                                                    selectedDriver?.id === driver.id
                                                        ? "bg-amber-50 border-amber-400 text-gray-900 shadow-sm shadow-amber-500/10"
                                                        : "bg-white border-gray-100/80 hover:border-amber-300 hover:bg-amber-50/30 hover:shadow-md text-gray-700"
                                                )}
                                            >
                                                {/* Left Accent Bar if Selected */}
                                                {selectedDriver?.id === driver.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />}

                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="font-extrabold text-sm block mb-1 tracking-tight truncate max-w-[150px]">{driver.full_name}</span>
                                                        <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest hidden sm:block">
                                                            ID: #{driver.id.substring(0, 6)}
                                                        </span>
                                                    </div>
                                                    <div className={cn(
                                                        "px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider",
                                                        selectedDriver?.id === driver.id ? "bg-amber-500 border-amber-600 shadow-inner text-white" : "bg-gray-100 border-gray-200 text-gray-600"
                                                    )}>
                                                        {driver.vehicle_type}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3.5 text-[11px] font-semibold pt-2 mt-1 border-t border-gray-100/60">
                                                    <div className="flex items-center gap-1.5 text-gray-500"><MapPin size={11} className={selectedDriver?.id === driver.id ? "text-amber-500" : "text-emerald-500"} /> {driver.city}</div>
                                                    <div className="flex items-center gap-1.5 text-gray-500"><Navigation size={11} className={selectedDriver?.id === driver.id ? "text-amber-600" : "text-blue-500"} /> {driver.speed} km/h</div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>
        </div>
    );
};

export default LiveTracking;
