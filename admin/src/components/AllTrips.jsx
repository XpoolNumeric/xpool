import React, { useEffect, useState, memo } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, MapPin, Calendar, Clock, User, Navigation, Route, Map, Tag, ChevronLeft, Play, X, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import Sidebar from './Sidebar';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Styles from Hero
// ─────────────────────────────────────────────────────────────────────────────
const GlobalStyles = () => (
    <style>{`
      .inter-font { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  
      :root {
        --color-amber-50: #fffbeb; --color-amber-100: #fef3c7; --color-amber-200: #fde68a;
        --color-amber-300: #fcd34d; --color-amber-400: #fbbf24; --color-amber-500: #f59e0b;
        --color-amber-600: #d97706; --color-amber-700: #b45309; 
        --transition-base: 0.2s ease-in-out;
      }
  
      @keyframes pulse-fade {
        0%, 100% { opacity: 0; } 50% { opacity: 1; }
      }
      .pulse-blob {
        animation: pulse-fade ease-in-out infinite;
        will-change: opacity;
      }
  
      /* Glassmorphism utilities */
      .glass-card {
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04);
      }

      .glass-card-hover {
        transition: all 0.2s ease;
      }
      .glass-card-hover:hover {
        background: rgba(255, 255, 255, 0.9);
        border-color: rgba(16, 185, 129, 0.4);
        transform: translateY(-2px);
        box-shadow: 0 15px 40px rgba(16, 185, 129, 0.1);
      }

      @media (prefers-reduced-motion: reduce) {
        .pulse-blob { animation: none !important; }
      }
      
      .dash-dotted {
          background-image: linear-gradient(to bottom, #d1d5db 50%, transparent 50%);
          background-size: 2px 8px;
          width: 2px;
      }
    `}</style>
);

// ─────────────────────────────────────────────────────────────────────────────
// Animated Background
// ─────────────────────────────────────────────────────────────────────────────
const PULSE_CONFIG = [
    { x: 15, y: 15, size: 300, delay: 0.1, dur: 5.5, opacity: 0.10 },
    { x: 80, y: 70, size: 350, delay: 1.5, dur: 6.1, opacity: 0.12 },
    { x: 60, y: 30, size: 280, delay: 2.7, dur: 4.8, opacity: 0.14 },
];

const PulseBackground = memo(() => {
    const prefersReducedMotion = useReducedMotion();
    if (prefersReducedMotion) return null;
    return (
        <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
            {PULSE_CONFIG.map((p, i) => (
                <div
                    key={i}
                    className="pulse-blob"
                    style={{
                        position: "absolute",
                        left: `${p.x}%`, top: `${p.y}%`,
                        width: p.size, height: p.size,
                        borderRadius: "50%",
                        transform: "translate(-50%, -50%)",
                        background: `radial-gradient(circle, rgba(16,185,129,${p.opacity}) 0%, rgba(52,211,153,${p.opacity * 0.5}) 42%, transparent 70%)`,
                        filter: "blur(40px)",
                        animationDuration: `${p.dur}s`,
                        animationDelay: `${p.delay}s`,
                    }}
                />
            ))}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: "radial-gradient(rgba(16,185,129,0.06) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                    zIndex: 1,
                }}
            />
        </div>
    );
});
PulseBackground.displayName = "PulseBackground";

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
function AllTrips() {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, active, completed, cancelled
    const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [replayMode, setReplayMode] = useState(false);
    const [replayProgress, setReplayProgress] = useState(0);

    const { isLoaded } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '' });

    const navigate = useNavigate();

    useEffect(() => {
        fetchTrips();
    }, [filter]);

    const fetchTrips = async () => {
        setLoading(true);
        try {
            let query = supabase.from('trips').select(`
                *,
                profiles:user_id (full_name)
            `);

            if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            setTrips(data);
        } catch (error) {
            console.error("Error fetching trips:", error);
        } finally {
            setLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };
    
    const itemVariants = {
        hidden: { opacity: 0, y: 10, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } }
    };

    const getStatusColors = (status) => {
        switch(status?.toLowerCase()) {
            case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'started': case 'active': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'accepted': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
            case 'requested': case 'pending': return 'bg-purple-100 text-purple-700 border-purple-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const runReplay = () => {
        setReplayMode(true);
        setReplayProgress(0);
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            if (progress >= 100) {
                 clearInterval(interval);
                 setTimeout(() => setReplayMode(false), 2000);
            } else {
                 setReplayProgress(progress);
            }
        }, 300);
    };

    // Timeline steps
    const getTimeline = (status) => {
        const s = status?.toLowerCase() || 'requested';
        let step = 0;
        if (['requested', 'pending'].includes(s)) step = 1;
        if (['accepted'].includes(s)) step = 2;
        if (['started', 'active'].includes(s)) step = 3;
        if (['completed'].includes(s)) step = 4;
        
        return [
           { label: 'Requested', done: step >= 1 },
           { label: 'Accepted', done: step >= 2 },
           { label: 'Started', done: step >= 3 },
           { label: 'Completed', done: step >= 4 }
        ];
    };

    // Render Modal
    const renderTripDetail = () => {
        if (!selectedTrip) return null;
        const timeline = getTimeline(selectedTrip.status);
        const mapCenter = { lat: 12.9716, lng: 77.5946 }; // Default Bengaluru mock
        const mockPath = [
            { lat: 12.9716, lng: 77.5946 },
            { lat: 13.0827, lng: 80.2707 } // To Chennai
        ];
        
        return (
            <div className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6" onClick={() => setSelectedTrip(null)}>
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white max-w-4xl w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh] md:h-[600px]"
                >
                    {/* Left: Map */}
                    <div className="w-full md:w-1/2 h-[300px] md:h-full bg-gray-100 relative">
                        {isLoaded ? (
                            <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={mapCenter} zoom={7} options={{ disableDefaultUI: true }}>
                                <Marker position={mockPath[0]} />
                                <Marker position={mockPath[1]} />
                                <Polyline path={mockPath} options={{ strokeColor: '#10b981', strokeOpacity: 0.5, strokeWeight: 4 }} />
                                {replayMode && (
                                    <Marker 
                                        position={{
                                            lat: mockPath[0].lat + (mockPath[1].lat - mockPath[0].lat) * (replayProgress / 100),
                                            lng: mockPath[0].lng + (mockPath[1].lng - mockPath[0].lng) * (replayProgress / 100)
                                        }}
                                        icon={{ url: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png', scaledSize: new window.google.maps.Size(32, 32) }}
                                    />
                                )}
                            </GoogleMap>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>
                        )}
                        <div className="absolute top-4 left-4 right-4 flex justify-between gap-2 z-10">
                            <span className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 uppercase tracking-wider text-emerald-700">
                                <Map size={14}/> Live Tracking
                            </span>
                            <button onClick={runReplay} disabled={replayMode} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50">
                                <Play size={14}/> {replayMode ? 'Replaying...' : 'Replay Route'}
                            </button>
                        </div>
                    </div>
                    
                    {/* Right: Details */}
                    <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col h-full bg-gray-50/50 overflow-y-auto">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-extrabold text-gray-900 leading-tight">Trip #{selectedTrip.id.substring(0,8)}</h3>
                                <p className="text-sm text-gray-500 font-medium">{new Date(selectedTrip.created_at).toLocaleString()}</p>
                            </div>
                            <button onClick={() => setSelectedTrip(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Timeline */}
                        <div className="mb-8">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Lifecycle</h4>
                            <div className="flex justify-between items-center relative">
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 rounded-full -z-10" />
                                {timeline.map((step, idx) => (
                                    <div key={idx} className="flex flex-col items-center gap-2">
                                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center border-4 text-white text-[10px] font-bold transition-colors shadow-sm", step.done ? "bg-emerald-500 border-emerald-100" : "bg-gray-300 border-gray-50 text-transparent")}>
                                            {step.done ? '✓' : ''}
                                        </div>
                                        <span className={cn("text-[10px] font-bold uppercase tracking-wider", step.done ? "text-emerald-700" : "text-gray-400")}>{step.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="space-y-4 mb-6">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Route</span>
                                <div className="text-sm font-semibold text-gray-900 flex flex-col gap-2">
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"/> {selectedTrip.from_location}</div>
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"/> {selectedTrip.to_location}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Passenger</span>
                                    <div className="text-sm font-semibold text-gray-900">{selectedTrip.profiles?.full_name || 'System User'}</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Fare</span>
                                    <div className="text-sm font-black text-emerald-600">₹{selectedTrip.price_per_seat}</div>
                                </div>
                            </div>
                        </div>

                        {selectedTrip.status?.toLowerCase() === 'cancelled' && (
                            <div className="mt-auto bg-red-50 border border-red-100 p-4 rounded-xl">
                                <h4 className="text-xs font-bold text-red-800 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Info size={14}/> Cancellation Reason</h4>
                                <p className="text-sm font-medium text-red-600">{selectedTrip.cancel_reason || 'Driver unavailable / No reason provided.'}</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        );
    };

    return (
        <div className="dashboard-container bg-gray-50/50" style={{ minHeight: '100vh', position: 'relative', background: "linear-gradient(160deg, #ecfdf5 0%, #f0fdf4 45%, #ffffff 100%)" }}>
            <GlobalStyles />
            <PulseBackground />
            
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className={`dashboard-content-wrapper relative z-10 h-full transition-all duration-300 pt-16 pb-10 ${sidebarOpen ? 'md:ml-64 lg:ml-72' : 'ml-0'}`}>
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">
                    
                    {/* Header */}
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="mb-10 w-full flex flex-col items-start gap-6">
                        <div>
                            <div className="inline-flex flex-col mb-2">
                                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3">
                                    Trip <span className="text-emerald-500">Monitor</span>
                                </h1>
                                <div className="h-1 w-1/3 bg-emerald-500 rounded-full mt-2" />
                            </div>
                            <p className="text-gray-500 font-medium">Monitoring all operational routes and schedules.</p>
                        </div>
                        
                        {/* Filters */}
                        <div className="flex items-center gap-2 p-1.5 bg-white/50 backdrop-blur rounded-xl border border-gray-200/50 overflow-x-auto max-w-full">
                            {['all', 'active', 'completed', 'cancelled'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilter(status)}
                                    className={cn(
                                        "px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all capitalize whitespace-nowrap",
                                        filter === status 
                                            ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" 
                                            : "text-gray-600 hover:bg-gray-100/80"
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Content Area */}
                    {(loading && trips.length === 0) ? (
                        <div className="flex flex-col items-center justify-center py-24">
                            <Loader2 size={48} className="animate-spin text-emerald-500 mb-4" />
                            <p className="text-gray-500 font-medium animate-pulse">Scanning routes...</p>
                        </div>
                    ) : trips.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="glass-card flex flex-col items-center justify-center p-16 text-center rounded-3xl"
                        >
                            <div className="w-24 h-24 mb-6 rounded-full bg-emerald-50 flex items-center justify-center border-4 border-emerald-100/50">
                                <Route size={40} className="text-emerald-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Routes Found</h3>
                            <p className="text-gray-500 max-w-sm">
                                No {filter !== 'all' ? filter : ''} trips match your current view. Try changing the filter.
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div 
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6"
                        >
                            <AnimatePresence>
                                {trips.map(trip => (
                                    <motion.div 
                                        key={trip.id} 
                                        variants={itemVariants}
                                        layout
                                        onClick={() => setSelectedTrip(trip)}
                                        className="glass-card glass-card-hover rounded-2xl flex flex-col overflow-hidden cursor-pointer"
                                    >
                                        {/* Status Header */}
                                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white/40">
                                            <span className={cn("px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider border", getStatusColors(trip.status))}>
                                                {trip.status}
                                            </span>
                                            <span className="text-xs font-mono font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">
                                                #{trip.id.substring(0, 8)}
                                            </span>
                                        </div>

                                        <div className="p-5 flex-1 flex flex-col">
                                            {/* Route Display */}
                                            <div className="flex gap-4 mb-6 relative">
                                                <div className="flex flex-col items-center pt-1 w-4 shrink-0">
                                                    <div className="w-4 h-4 rounded-full border-4 border-emerald-100 bg-emerald-500 z-10 box-shadow-sm" />
                                                    <div className="dash-dotted h-12 my-1" />
                                                    <div className="w-4 h-4 rounded-full border-4 border-amber-100 bg-amber-500 z-10 box-shadow-sm" />
                                                </div>
                                                <div className="flex flex-col flex-1 justify-between pt-0.5 space-y-4">
                                                    <div>
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-0.5">Pickup</span>
                                                        <span className="text-gray-900 font-bold text-base leading-tight truncate block max-w-[200px]" title={trip.from_location}>{trip.from_location}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-0.5">Dropoff</span>
                                                        <span className="text-gray-900 font-bold text-base leading-tight truncate block max-w-[200px]" title={trip.to_location}>{trip.to_location}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Info Grid */}
                                            <div className="grid grid-cols-2 gap-3 mt-auto bg-gray-50/50 p-3 rounded-xl border border-gray-100/50">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-white rounded shadow-sm"><Calendar size={14} className="text-emerald-600" /></div>
                                                    <span className="text-xs font-bold text-gray-700">{new Date(trip.travel_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-white rounded shadow-sm"><Clock size={14} className="text-emerald-600" /></div>
                                                    <span className="text-xs font-bold text-gray-700">{trip.travel_time}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-white rounded shadow-sm"><User size={14} className="text-emerald-600" /></div>
                                                    <span className="text-xs font-bold text-gray-700 truncate" title={trip.profiles?.full_name || 'System'}>
                                                        {trip.profiles?.full_name?.split(' ')[0] || 'System'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-white rounded shadow-sm"><Tag size={14} className="text-amber-500" /></div>
                                                    <span className="text-xs font-black text-amber-600">₹{trip.price_per_seat}/st</span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </main>
            </div>
            {renderTripDetail()}
        </div>
    );
}

export default AllTrips;
