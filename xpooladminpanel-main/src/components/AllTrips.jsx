import React, { useEffect, useState, memo, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
    Loader2, MapPin, Calendar, Clock, User, Navigation, Route, Map, Tag,
    ChevronLeft, Play, X, Info, ShieldCheck, Search, SlidersHorizontal,
    TrendingUp, Zap, ChevronRight, RefreshCw, Download, Eye, ArrowUpRight,
    CheckCircle2, AlertTriangle, Ban, Timer, Car, Bike, Truck, Filter,
    BarChart3, Activity, Circle, ChevronDown, MoreHorizontal, Pause
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    GoogleMap, useJsApiLoader, Marker, Polyline,
    DirectionsRenderer
} from '@react-google-maps/api';
import Sidebar from './Sidebar';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useRealtime } from '../hooks/useRealtime';

function cn(...inputs) { return twMerge(clsx(inputs)); }

// ─── Map Config ───────────────────────────────────────────────────────────────
const MAP_OPTIONS = {
    disableDefaultUI: true,
    zoomControl: false,
    styles: [
        { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
        { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#cbd5e1" }] },
        { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#dbeafe" }] },
        { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3b82f6" }] },
        { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#f8fafc" }] },
        { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#f1f5f9" }] },
        { featureType: "poi", elementType: "geometry", stylers: [{ color: "#e2e8f0" }] },
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#fde68a" }] },
        { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#f59e0b" }] },
        { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#e2e8f0" }] },
        { featureType: "transit", elementType: "geometry", stylers: [{ color: "#e2e8f0" }] },
    ],
};

const VEHICLE_ICON = (color) =>
    `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="${encodeURIComponent(color)}" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;

const VEHICLE_ICONS = {
    car: VEHICLE_ICON('#f59e0b'),
    bike: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%233b82f6" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`,
    auto: VEHICLE_ICON('#10b981'),
    suv: VEHICLE_ICON('#8b5cf6'),
};

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    completed: { color: 'emerald', label: 'Completed', icon: CheckCircle2, dot: '#10b981' },
    active: { color: 'amber', label: 'Active', icon: Activity, dot: '#f59e0b' },
    started: { color: 'amber', label: 'In Progress', icon: Zap, dot: '#f59e0b' },
    in_progress: { color: 'amber', label: 'In Progress', icon: Zap, dot: '#f59e0b' },
    accepted: { color: 'blue', label: 'Accepted', icon: CheckCircle2, dot: '#3b82f6' },
    cancelled: { color: 'red', label: 'Cancelled', icon: Ban, dot: '#ef4444' },
    requested: { color: 'violet', label: 'Requested', icon: Timer, dot: '#8b5cf6' },
    pending: { color: 'violet', label: 'Pending', icon: Timer, dot: '#8b5cf6' },
};
const getStatus = (s) => STATUS_CONFIG[s?.toLowerCase()] || STATUS_CONFIG.pending;

// ─── Global Styles ─────────────────────────────────────────────────────────────
const GlobalStyles = () => (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

      *, *::before, *::after { box-sizing: border-box; }

      :root {
        --emerald: #10b981; --emerald-light: #d1fae5; --emerald-mid: #6ee7b7;
        --amber: #f59e0b; --amber-light: #fef3c7;
        --surface: rgba(255,255,255,0.72);
        --border: rgba(226,232,240,0.8);
        --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
        --shadow-md: 0 4px 24px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04);
        --shadow-lg: 0 12px 48px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06);
        --font-body: 'Inter', sans-serif;
      }

      .trip-page { font-family: var(--font-body); }
      .display-font { font-family: var(--font-body); letter-spacing: -0.01em; }

      /* Scrollbar */
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 99px; }
      ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }

      /* Glass */
      .glass { background: var(--surface); backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8); border: 1px solid var(--border); }
      .glass-dark { background: rgba(15,23,42,0.75); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }

      /* Card hover */
      .trip-card { transition: transform 0.22s cubic-bezier(.22,1,.36,1), box-shadow 0.22s ease, border-color 0.2s ease; }
      .trip-card:hover { transform: translateY(-3px); box-shadow: 0 20px 60px rgba(16,185,129,0.12), 0 8px 24px rgba(0,0,0,0.06); border-color: rgba(16,185,129,0.3) !important; }

      /* Live pulse */
      @keyframes live-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.5); opacity: 0.5; }
      }
      .live-dot::after {
        content: ''; position: absolute; inset: -3px; border-radius: 50%;
        background: #10b981; opacity: 0.3;
        animation: live-pulse 1.5s ease-in-out infinite;
      }

      /* Ambient blobs */
      @keyframes float-blob {
        0%, 100% { transform: translate(-50%,-50%) scale(1); }
        33% { transform: translate(-50%,-50%) scale(1.08) rotate(5deg); }
        66% { transform: translate(-50%,-50%) scale(0.94) rotate(-3deg); }
      }
      .ambient-blob { animation: float-blob ease-in-out infinite; }

      /* Map zoom controls */
      .map-zoom-btn { transition: background 0.15s, transform 0.1s; }
      .map-zoom-btn:hover { background: #f1f5f9; transform: scale(1.08); }
      .map-zoom-btn:active { transform: scale(0.94); }

      /* Route dots */
      .route-line { background: repeating-linear-gradient(to bottom, #d1d5db 0px, #d1d5db 5px, transparent 5px, transparent 10px); width: 2px; }

      /* Shimmer loading */
      @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
      .shimmer { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 400px 100%; animation: shimmer 1.4s ease-in-out infinite; }

      /* No scrollbar utility */
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

      /* Replay progress */
      @keyframes progress-glow { 0%,100%{box-shadow: 0 0 6px #10b981;} 50%{box-shadow: 0 0 16px #10b981, 0 0 32px rgba(16,185,129,0.4);} }
      .progress-glow { animation: progress-glow 1.5s ease-in-out infinite; }

      /* Input focus */
      .search-input:focus { outline: none; box-shadow: 0 0 0 3px rgba(16,185,129,0.15); }

      /* Stats counter animation */
      @keyframes count-in { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
      .count-in { animation: count-in 0.4s cubic-bezier(.22,1,.36,1) both; }
    `}</style>
);

// ─── Ambient Background ────────────────────────────────────────────────────────
const AmbientBackground = memo(() => {
    const pref = useReducedMotion();
    return (
        <div aria-hidden className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
            {!pref && <>
                <div className="ambient-blob absolute" style={{ left: '8%', top: '12%', width: 480, height: 480, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle,rgba(16,185,129,0.10) 0%,rgba(52,211,153,0.05) 45%,transparent 70%)', filter: 'blur(60px)', animationDuration: '12s' }} />
                <div className="ambient-blob absolute" style={{ left: '78%', top: '65%', width: 380, height: 380, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle,rgba(245,158,11,0.08) 0%,rgba(251,191,36,0.04) 45%,transparent 70%)', filter: 'blur(50px)', animationDuration: '9s', animationDelay: '3s' }} />
                <div className="ambient-blob absolute" style={{ left: '50%', top: '85%', width: 320, height: 320, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle,rgba(59,130,246,0.07) 0%,transparent 70%)', filter: 'blur(40px)', animationDuration: '14s', animationDelay: '6s' }} />
            </>}
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(16,185,129,0.035) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,#ecfdf5 0%,#f0fdf4 40%,#fffbeb 70%,#ffffff 100%)' }} />
        </div>
    );
});
AmbientBackground.displayName = 'AmbientBackground';

// ─── Stats Bar ─────────────────────────────────────────────────────────────────
const StatsBar = memo(({ trips }) => {
    const counts = trips.reduce((acc, t) => {
        const s = t.status?.toLowerCase() || 'pending';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});
    const active = (counts.active || 0) + (counts.started || 0) + (counts.in_progress || 0);
    const stats = [
        { label: 'Total Routes', value: trips.length, icon: Route, color: 'text-gray-700', bg: 'bg-gray-100' },
        { label: 'Live Now', value: active, icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50', pulse: active > 0 },
        { label: 'Completed', value: counts.completed || 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Cancelled', value: counts.cancelled || 0, icon: Ban, color: 'text-red-500', bg: 'bg-red-50' },
    ];
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {stats.map((s, i) => (
                <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.35, ease: [.22, 1, .36, 1] }}
                    className="glass rounded-2xl p-4 flex items-center gap-3"
                >
                    <div className={cn('p-2.5 rounded-xl relative', s.bg)}>
                        <s.icon size={16} className={s.color} />
                        {s.pulse && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full live-dot" style={{ position: 'absolute' }} />
                        )}
                    </div>
                    <div>
                        <div className={cn('text-xl font-bold count-in display-font', s.color)} style={{ animationDelay: `${i * 0.08}s` }}>
                            {s.value}
                        </div>
                        <div className="text-[11px] text-gray-400 font-medium">{s.label}</div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
});
StatsBar.displayName = 'StatsBar';

// ─── Skeleton Card ────────────────────────────────────────────────────────────
const SkeletonCard = () => (
    <div className="glass rounded-[2rem] overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="shimmer h-6 w-24 rounded-lg" />
            <div className="shimmer h-4 w-20 rounded" />
        </div>
        <div className="p-6 space-y-4">
            <div className="shimmer h-4 w-3/4 rounded" />
            <div className="shimmer h-4 w-1/2 rounded" />
            <div className="shimmer h-20 w-full rounded-2xl" />
        </div>
    </div>
);

// ─── Trip Card ────────────────────────────────────────────────────────────────
const TripCard = memo(({ trip, onClick, index }) => {
    const cfg = getStatus(trip.status);
    const StatusIcon = cfg.icon;
    const isLive = ['active', 'started', 'in_progress'].includes(trip.status?.toLowerCase());
    const colorMap = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        red: 'bg-red-50 text-red-700 border-red-200',
        violet: 'bg-violet-50 text-violet-700 border-violet-200',
        gray: 'bg-gray-100 text-gray-600 border-gray-200',
    };

    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, y: 16, scale: 0.97 },
                visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [.22, 1, .36, 1], delay: index * 0.04 } },
                exit: { opacity: 0, scale: 0.95, transition: { duration: 0.18 } }
            }}
            layout
            onClick={onClick}
            className="trip-card glass rounded-[2rem] overflow-hidden cursor-pointer border border-white/90 flex flex-col"
        >
            {/* Card Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100/70 bg-white/30">
                <div className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold border', colorMap[cfg.color])}>
                    {isLive ? (
                        <span className="relative w-1.5 h-1.5 rounded-full bg-amber-500">
                            <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
                        </span>
                    ) : <StatusIcon size={11} />}
                    {cfg.label}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-gray-300">#{trip.id.substring(0, 8).toUpperCase()}</span>
                    <ArrowUpRight size={14} className="text-gray-300" />
                </div>
            </div>

            {/* Route */}
            <div className="px-6 pt-5 pb-2 flex gap-3">
                <div className="flex flex-col items-center pt-1 w-5 shrink-0 gap-0.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100 shrink-0" />
                    <div className="route-line flex-1 my-1 min-h-[32px]" />
                    <div className="w-3 h-3 rounded-full bg-amber-400 ring-4 ring-amber-100 shrink-0" />
                </div>
                <div className="flex flex-col justify-between flex-1 py-0.5 gap-4">
                    <div>
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-0.5">From</p>
                        <p className="font-semibold text-gray-900 text-sm leading-snug truncate display-font">{trip.from_location}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-0.5">To</p>
                        <p className="font-semibold text-gray-900 text-sm leading-snug truncate display-font">{trip.to_location}</p>
                    </div>
                </div>
            </div>

            {/* Meta */}
            <div className="mx-5 mb-5 mt-3 p-3.5 rounded-2xl bg-gray-50/70 border border-gray-100/60 grid grid-cols-2 gap-2.5">
                {[
                    { icon: Calendar, val: new Date(trip.travel_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) },
                    { icon: Clock, val: trip.travel_time },
                    { icon: User, val: trip.drivers?.full_name?.split(' ')[0] || 'Unknown' },
                    { icon: Tag, val: `₹${trip.price_per_seat}`, accent: true },
                ].map(({ icon: Icon, val, accent }, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className={cn('p-1.5 rounded-lg', accent ? 'bg-emerald-100' : 'bg-white shadow-sm')}>
                            <Icon size={12} className={accent ? 'text-emerald-600' : 'text-gray-500'} />
                        </div>
                        <span className={cn('text-xs truncate font-medium', accent ? 'text-emerald-700 font-bold' : 'text-gray-700')}>{val}</span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
});
TripCard.displayName = 'TripCard';

// ─── Map Zoom Controls ────────────────────────────────────────────────────────
const MapZoomControls = ({ mapRef }) => (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5">
        {['+', '-'].map(sym => (
            <button key={sym} onClick={() => { if (!mapRef.current) return; sym === '+' ? mapRef.current.setZoom(mapRef.current.getZoom() + 1) : mapRef.current.setZoom(mapRef.current.getZoom() - 1); }}
                className="map-zoom-btn w-9 h-9 bg-white rounded-xl shadow-md border border-gray-100 flex items-center justify-center text-gray-600 font-bold text-base">
                {sym}
            </button>
        ))}
        <button onClick={() => { if (!mapRef.current) return; mapRef.current.setZoom(12); }}
            className="map-zoom-btn w-9 h-9 bg-white rounded-xl shadow-md border border-gray-100 flex items-center justify-center text-gray-400">
            <Navigation size={14} />
        </button>
    </div>
);

// ─── Trip Detail Modal ────────────────────────────────────────────────────────
const TripDetailModal = memo(({
    trip, onClose, isLoaded, directionsResult, directionsError,
    mapRef, replayMode, replayProgress, onReplay, getReplayPosition,
    replayInterval
}) => {
    if (!trip) return null;

    const cfg = getStatus(trip.status);
    const StatusIcon = cfg.icon;
    const isLive = ['active', 'started', 'in_progress'].includes(trip.status?.toLowerCase());
    const hasRoute = trip.start_lat && trip.end_lat;
    const hasDriver = trip.driver_lat && trip.driver_lng;

    const mapCenter = hasDriver
        ? { lat: Number(trip.driver_lat), lng: Number(trip.driver_lng) }
        : trip.start_lat ? { lat: Number(trip.start_lat), lng: Number(trip.start_lng) }
            : trip.end_lat ? { lat: Number(trip.end_lat), lng: Number(trip.end_lng) }
                : { lat: 12.9716, lng: 77.5946 };

    const tripPath = hasRoute ? [
        { lat: Number(trip.start_lat), lng: Number(trip.start_lng) },
        { lat: Number(trip.end_lat), lng: Number(trip.end_lng) }
    ] : [];

    const colorBadge = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        red: 'bg-red-50 text-red-700 border-red-200',
        violet: 'bg-violet-50 text-violet-700 border-violet-200',
    };

    const TIMELINE = [
        { label: 'Requested', key: 'requested' },
        { label: 'Accepted', key: 'accepted' },
        { label: 'In Progress', key: 'in_progress' },
        { label: 'Completed', key: 'completed' },
    ];
    const statusOrder = ['requested', 'pending', 'accepted', 'started', 'active', 'in_progress', 'completed'];
    const currentIdx = statusOrder.indexOf(trip.status?.toLowerCase());
    const getTimelineDone = (key) => {
        const tOrder = ['requested', 'accepted', 'in_progress', 'completed'];
        const tIdx = tOrder.indexOf(key);
        const sEquiv = { requested: 0, pending: 0, accepted: 1, started: 2, active: 2, in_progress: 2, completed: 3 };
        return (sEquiv[trip.status?.toLowerCase()] ?? 0) >= tIdx;
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
                style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(12px)' }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.93, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: [.22, 1, .36, 1] } }}
                    exit={{ opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.2 } }}
                    onClick={e => e.stopPropagation()}
                    className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row"
                    style={{ maxHeight: '92vh' }}
                >
                    {/* ── Left: Map Panel ───────────────────────────────── */}
                    <div className="relative w-full lg:w-[52%] h-72 lg:h-auto bg-gray-100 shrink-0 overflow-hidden">
                        {isLoaded ? (
                            <GoogleMap
                                mapContainerStyle={{ width: '100%', height: '100%' }}
                                center={mapCenter} zoom={11} options={MAP_OPTIONS}
                                onLoad={m => mapRef.current = m}
                                onUnmount={() => mapRef.current = null}
                            >
                                {directionsResult && !replayMode && (
                                    <DirectionsRenderer
                                        directions={directionsResult}
                                        options={{
                                            polylineOptions: { strokeColor: '#10b981', strokeOpacity: 0.85, strokeWeight: 5 },
                                            suppressMarkers: true
                                        }}
                                    />
                                )}

                                {/* Preview Tracking: Dynamic Growing Path */}
                                {replayMode && directionsResult?.routes?.[0]?.overview_path && (
                                    <>
                                        {/* Background Path */}
                                        <Polyline 
                                            path={directionsResult.routes[0].overview_path} 
                                            options={{ strokeColor: '#10b981', strokeOpacity: 0.15, strokeWeight: 5 }} 
                                        />
                                        {/* Growing Active Path */}
                                        <Polyline 
                                            path={directionsResult.routes[0].overview_path.slice(0, Math.max(1, Math.floor((replayProgress / 100) * directionsResult.routes[0].overview_path.length)))} 
                                            options={{ strokeColor: '#10b981', strokeOpacity: 0.9, strokeWeight: 5 }} 
                                        />
                                    </>
                                )}

                                {tripPath[0] && (
                                    <Marker position={tripPath[0]} icon={{ path: window.google?.maps?.SymbolPath?.CIRCLE, fillColor: '#10b981', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 7 }} />
                                )}
                                {tripPath[1] && (
                                    <Marker position={tripPath[1]} icon={{ path: window.google?.maps?.SymbolPath?.CIRCLE, fillColor: '#f59e0b', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 7 }} />
                                )}
                                {hasDriver && (
                                    <Marker
                                        position={{ lat: Number(trip.driver_lat), lng: Number(trip.driver_lng) }}
                                        icon={{ url: VEHICLE_ICONS[trip.vehicle_type?.toLowerCase()] || VEHICLE_ICONS.car, scaledSize: new window.google.maps.Size(32, 32), anchor: new window.google.maps.Point(16, 16) }}
                                        zIndex={100}
                                    />
                                )}
                                {replayMode && directionsResult && (
                                    <Marker
                                        position={getReplayPosition()}
                                        icon={{ url: VEHICLE_ICONS.car, scaledSize: new window.google.maps.Size(32, 32), anchor: new window.google.maps.Point(16, 16) }}
                                        zIndex={200}
                                    />
                                )}
                            </GoogleMap>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
                        )}

                        {directionsError && (
                            <div className="absolute inset-x-4 top-[35%] pointer-events-none text-center">
                                <div className="inline-flex items-center gap-2 bg-white/95 border border-red-200 text-red-600 text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-lg">
                                    <AlertTriangle size={13} /> {directionsError}
                                </div>
                            </div>
                        )}

                        {/* Map Overlays */}
                        <MapZoomControls mapRef={mapRef} />

                        <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-2 pointer-events-none z-10">
                            <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 backdrop-blur px-3 py-2 rounded-2xl shadow-md border border-green-100 text-emerald-700 text-xs font-semibold">
                                <ShieldCheck size={13} className="text-emerald-500" />
                                {hasRoute ? 'Verified Route' : 'City View'}
                            </div>
                            <button
                                onClick={onReplay}
                                disabled={replayMode || !directionsResult}
                                className="pointer-events-auto flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-md transition-all active:scale-95"
                            >
                                {replayMode ? <><Pause size={12} /> Previewing...</> : <><Play size={12} /> Preview Route</>}
                            </button>
                        </div>

                        {/* Replay progress bar */}
                        {replayMode && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                                <motion.div
                                    className="h-full bg-emerald-500 progress-glow"
                                    animate={{ width: `${replayProgress}%` }}
                                    transition={{ ease: 'linear', duration: 0.28 }}
                                />
                            </div>
                        )}

                        {isLive && hasDriver && (
                            <div className="absolute bottom-4 left-4 z-10">
                                <div className="flex items-center gap-2 bg-white/95 backdrop-blur px-3 py-2 rounded-2xl shadow-md border border-amber-100 text-amber-700 text-xs font-semibold">
                                    <span className="relative flex w-2 h-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                    </span>
                                    Live Tracking
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Right: Details Panel ──────────────────────────── */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/60">
                        {/* Header */}
                        <div className="flex items-start justify-between p-6 pb-4 border-b border-gray-100">
                            <div>
                                <div className="flex items-center gap-2.5 mb-1">
                                    <h2 className="text-2xl font-bold text-gray-900 display-font">
                                        Trip <span className="text-emerald-500">#{trip.id.substring(0, 8).toUpperCase()}</span>
                                    </h2>
                                    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border', colorBadge[cfg.color] || colorBadge.violet)}>
                                        <StatusIcon size={11} /> {cfg.label}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 font-medium">{new Date(trip.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                            </div>
                            <button onClick={onClose} className="p-2.5 bg-white hover:bg-gray-100 rounded-2xl transition-all text-gray-400 hover:text-gray-700 shadow-sm border border-gray-100 shrink-0">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Timeline */}
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-4">Journey Lifecycle</h4>
                                <div className="relative flex justify-between">
                                    <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-gray-200 rounded-full -z-10" />
                                    <div
                                        className="absolute top-3.5 left-0 h-0.5 bg-emerald-400 rounded-full transition-all duration-700 -z-10"
                                        style={{ width: `${(TIMELINE.filter(t => getTimelineDone(t.key)).length / TIMELINE.length) * 100}%` }}
                                    />
                                    {TIMELINE.map((step) => {
                                        const done = getTimelineDone(step.key);
                                        return (
                                            <div key={step.key} className="flex flex-col items-center gap-1.5 w-16">
                                                <div className={cn('w-7 h-7 rounded-full border-4 flex items-center justify-center text-[10px] font-bold shadow-sm transition-all duration-300', done ? 'bg-emerald-500 border-emerald-100 text-white scale-110' : 'bg-white border-gray-200 text-gray-300')}>
                                                    {done ? '✓' : ''}
                                                </div>
                                                <span className={cn('text-[10px] font-semibold text-center leading-tight', done ? 'text-emerald-700' : 'text-gray-400')}>{step.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Route Card */}
                            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Scheduled Route</h4>
                                <div className="flex gap-3">
                                    <div className="flex flex-col items-center pt-1 w-4 shrink-0">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                                        <div className="route-line flex-1 my-1 min-h-[24px]" />
                                        <div className="w-3 h-3 rounded-full bg-amber-400 ring-4 ring-amber-100" />
                                    </div>
                                    <div className="flex flex-col gap-4 flex-1">
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Pickup</p>
                                            <p className="text-sm font-semibold text-gray-900 display-font">{trip.from_location}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Drop-off</p>
                                            <p className="text-sm font-semibold text-gray-900 display-font">{trip.to_location}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Driver</h4>
                                    <p className="font-bold text-gray-900 text-base display-font">{trip.drivers?.full_name || 'System'}</p>
                                    <p className="text-xs text-gray-400 font-medium capitalize mt-0.5">{trip.vehicle_type || '—'}</p>
                                </div>
                                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Fare</h4>
                                    <p className="font-black text-emerald-600 text-xl display-font">₹{trip.price_per_seat}</p>
                                    <p className="text-xs text-gray-400 font-medium mt-0.5">per seat</p>
                                </div>
                                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Date</h4>
                                    <p className="font-semibold text-gray-900 text-sm display-font">{new Date(trip.travel_date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                                </div>
                                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Time</h4>
                                    <p className="font-semibold text-gray-900 text-sm display-font">{trip.travel_time}</p>
                                </div>
                            </div>

                            {/* Cancel Reason */}
                            {trip.status?.toLowerCase() === 'cancelled' && (
                                <div className="bg-red-50 border border-red-100 rounded-3xl p-5">
                                    <h4 className="text-[10px] font-bold text-red-700 uppercase tracking-[0.15em] flex items-center gap-1.5 mb-2">
                                        <Info size={12} /> Cancellation Reason
                                    </h4>
                                    <p className="text-sm font-medium text-red-600 leading-relaxed">{trip.cancel_reason || 'Administrative override / Driver unavailable.'}</p>
                                </div>
                            )}

                            {/* Live Badge */}
                            {isLive && (
                                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-3xl border border-emerald-100">
                                    <span className="relative flex w-3 h-3 shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                    </span>
                                    <span className="text-xs font-semibold text-emerald-800 display-font">Tracking live location updates…</span>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
});
TripDetailModal.displayName = 'TripDetailModal';

// ─── Main Component ────────────────────────────────────────────────────────────
function AllTrips() {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [replayMode, setReplayMode] = useState(false);
    const [replayProgress, setReplayProgress] = useState(0);
    const [directionsResult, setDirectionsResult] = useState(null);
    const [directionsError, setDirectionsError] = useState(null);
    const [sortBy, setSortBy] = useState('newest');
    const [showSort, setShowSort] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [refreshing, setRefreshing] = useState(false);

    const mapRef = useRef(null);
    const replayRef = useRef(null);
    const navigate = useNavigate();

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
    });

    const fetchTrips = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            let query = supabase.from('trips').select('*, drivers(full_name)');
            if (filter !== 'all') query = query.eq('status', filter);
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            setTrips(data || []);
            if (selectedTrip) {
                const updated = data?.find(t => t.id === selectedTrip.id);
                if (updated) setSelectedTrip(updated);
            }
            setLastRefresh(new Date());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filter, selectedTrip]);

    useEffect(() => { fetchTrips(); }, [filter]);
    useRealtime('trips', () => fetchTrips(true));

    // Auto pan to live driver
    useEffect(() => {
        if (selectedTrip?.driver_lat && mapRef.current) {
            const pos = { lat: Number(selectedTrip.driver_lat), lng: Number(selectedTrip.driver_lng) };
            mapRef.current.panTo(pos);
            if (mapRef.current.getZoom() < 12) mapRef.current.setZoom(13);
        }
    }, [selectedTrip?.driver_lat, selectedTrip?.driver_lng]);

    // Fetch directions on trip select
    useEffect(() => {
        if (!selectedTrip?.start_lat || !selectedTrip?.end_lat || !window.google) {
            setDirectionsResult(null); return;
        }
        const svc = new window.google.maps.DirectionsService();
        svc.route({
            origin: { lat: Number(selectedTrip.start_lat), lng: Number(selectedTrip.start_lng) },
            destination: { lat: Number(selectedTrip.end_lat), lng: Number(selectedTrip.end_lng) },
            travelMode: window.google.maps.TravelMode.DRIVING
        }, (result, status) => {
            if (status === 'OK') { setDirectionsResult(result); setDirectionsError(null); }
            else { setDirectionsResult(null); setDirectionsError(`Route unavailable (${status})`); }
        });
    }, [selectedTrip?.start_lat, selectedTrip?.end_lat, isLoaded]);

    const getReplayPosition = useCallback(() => {
        if (!directionsResult?.routes?.[0]?.overview_path) return { lat: 0, lng: 0 };
        const path = directionsResult.routes[0].overview_path;
        const idx = Math.floor((replayProgress / 100) * (path.length - 1));
        return path[Math.min(idx, path.length - 1)];
    }, [directionsResult, replayProgress]);

    const runReplay = useCallback(() => {
        if (!directionsResult || replayMode) return;
        setReplayMode(true); setReplayProgress(0);
        let p = 0;
        replayRef.current = setInterval(() => {
            p += 2;
            setReplayProgress(p);
            if (p >= 100) { clearInterval(replayRef.current); setTimeout(() => setReplayMode(false), 1500); }
        }, 80);
    }, [directionsResult, replayMode]);

    // Filtered + searched + sorted trips
    const displayTrips = React.useMemo(() => {
        let list = [...trips];
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(t =>
                t.from_location?.toLowerCase().includes(q) ||
                t.to_location?.toLowerCase().includes(q) ||
                t.drivers?.full_name?.toLowerCase().includes(q) ||
                t.id.toLowerCase().includes(q)
            );
        }
        if (sortBy === 'newest') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        if (sortBy === 'oldest') list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        if (sortBy === 'price_hi') list.sort((a, b) => b.price_per_seat - a.price_per_seat);
        if (sortBy === 'price_lo') list.sort((a, b) => a.price_per_seat - b.price_per_seat);
        return list;
    }, [trips, search, sortBy]);

    const FILTERS = [
        { key: 'all', label: 'All Routes' },
        { key: 'active', label: 'Active' },
        { key: 'completed', label: 'Completed' },
        { key: 'cancelled', label: 'Cancelled' },
        { key: 'requested', label: 'Pending' },
    ];

    const SORT_OPTIONS = [
        { key: 'newest', label: 'Newest First' },
        { key: 'oldest', label: 'Oldest First' },
        { key: 'price_hi', label: 'Price: High→Low' },
        { key: 'price_lo', label: 'Price: Low→High' },
    ];

    return (
        <div className="trip-page min-h-screen relative" style={{ background: 'linear-gradient(160deg,#ecfdf5 0%,#f0fdf4 40%,#fffbeb 65%,#ffffff 100%)' }}>
            <GlobalStyles />
            <AmbientBackground />
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className={`relative z-10 transition-all duration-300 pt-16 pb-14 ${sidebarOpen ? 'md:ml-64 lg:ml-72' : 'ml-0'}`}>
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

                    {/* ── Page Header ─────────────────────────────── */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.45 }}
                        className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4"
                    >
                        <div>
                            <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-[0.2em] mb-1">Operations Dashboard</p>
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 display-font leading-tight">
                                Trip <span className="text-emerald-500">Monitor</span>
                            </h1>
                            <div className="h-[3px] w-16 bg-emerald-500 rounded-full mt-2 mb-2" />
                            <p className="text-sm text-gray-500 font-medium">Tracking all routes — live, scheduled & historical.</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="text-[10px] text-gray-400 font-medium hidden sm:block">
                                Updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <button
                                onClick={() => fetchTrips(true)}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-4 py-2.5 glass rounded-2xl text-sm font-semibold text-gray-600 hover:bg-white hover:text-emerald-600 transition-all border border-gray-200/60 shadow-sm"
                            >
                                <RefreshCw size={14} className={refreshing ? 'animate-spin text-emerald-500' : ''} />
                                {refreshing ? 'Syncing…' : 'Refresh'}
                            </button>
                        </div>
                    </motion.div>

                    {/* ── Stats Bar ───────────────────────────────── */}
                    {!loading && <StatsBar trips={trips} />}
                    {loading && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                            {[...Array(4)].map((_, i) => <div key={i} className="shimmer rounded-2xl h-20" />)}
                        </div>
                    )}

                    {/* ── Controls Row ─────────────────────────────── */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        {/* Search */}
                        <div className="relative flex-1 min-w-0">
                            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by route, driver, or trip ID…"
                                className="search-input w-full glass rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-700 placeholder-gray-400 border border-gray-200/60 transition-all font-medium"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Sort Dropdown */}
                        <div className="relative shrink-0">
                            <button
                                onClick={() => setShowSort(v => !v)}
                                className="flex items-center gap-2 glass rounded-2xl px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-white transition-all border border-gray-200/60 shadow-sm whitespace-nowrap"
                            >
                                <SlidersHorizontal size={14} />
                                {SORT_OPTIONS.find(s => s.key === sortBy)?.label}
                                <ChevronDown size={13} className={cn('transition-transform', showSort && 'rotate-180')} />
                            </button>
                            <AnimatePresence>
                                {showSort && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                                        className="absolute right-0 top-full mt-2 glass rounded-2xl shadow-lg border border-gray-200/60 p-1.5 z-50 min-w-[180px]"
                                    >
                                        {SORT_OPTIONS.map(s => (
                                            <button
                                                key={s.key}
                                                onClick={() => { setSortBy(s.key); setShowSort(false); }}
                                                className={cn('w-full text-left text-sm px-4 py-2.5 rounded-xl font-medium transition-all', sortBy === s.key ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50')}
                                            >{s.label}</button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* ── Filter Tabs ──────────────────────────────── */}
                    <div className="flex items-center gap-1.5 p-1.5 glass rounded-2xl border border-gray-200/50 overflow-x-auto no-scrollbar mb-8 w-fit max-w-full">
                        {FILTERS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={cn(
                                    'px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap transition-all duration-200',
                                    filter === f.key
                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 scale-[1.02]'
                                        : 'text-gray-500 hover:bg-white hover:text-gray-800'
                                )}
                            >{f.label}</button>
                        ))}
                    </div>

                    {/* ── Content Area ─────────────────────────────── */}
                    {loading && trips.length === 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    ) : displayTrips.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                            className="glass rounded-[2.5rem] flex flex-col items-center justify-center py-24 px-8 text-center border border-white/90"
                        >
                            <div className="w-20 h-20 mb-6 rounded-3xl bg-emerald-50 flex items-center justify-center border-4 border-emerald-100/60">
                                <Route size={32} className="text-emerald-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2 display-font">No Routes Found</h3>
                            <p className="text-gray-500 max-w-xs font-medium text-sm">
                                {search ? `No trips match "${search}"` : `No ${filter !== 'all' ? filter : ''} trips on record.`}
                            </p>
                            {(search || filter !== 'all') && (
                                <button onClick={() => { setSearch(''); setFilter('all'); }}
                                    className="mt-6 px-6 py-3 bg-emerald-500 text-white rounded-2xl text-sm font-semibold hover:bg-emerald-600 transition-all">
                                    Clear Filters
                                </button>
                            )}
                        </motion.div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-xs font-semibold text-gray-400">
                                    Showing <span className="text-gray-700">{displayTrips.length}</span> {displayTrips.length === 1 ? 'trip' : 'trips'}
                                    {search && <> matching "<span className="text-emerald-600">{search}</span>"</>}
                                </p>
                            </div>
                            <motion.div
                                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
                                initial="hidden" animate="visible"
                                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
                            >
                                <AnimatePresence mode="popLayout">
                                    {displayTrips.map((trip, i) => (
                                        <TripCard
                                            key={trip.id}
                                            trip={trip}
                                            index={i}
                                            onClick={() => {
                                                setSelectedTrip(trip);
                                                setDirectionsResult(null);
                                                setDirectionsError(null);
                                                setReplayMode(false);
                                                setReplayProgress(0);
                                            }}
                                        />
                                    ))}
                                </AnimatePresence>
                            </motion.div>
                        </>
                    )}
                </main>
            </div>

            {/* ── Trip Detail Modal ─────────────────────────────── */}
            {selectedTrip && (
                <TripDetailModal
                    trip={selectedTrip}
                    onClose={() => { setSelectedTrip(null); setReplayMode(false); setReplayProgress(0); if (replayRef.current) clearInterval(replayRef.current); }}
                    isLoaded={isLoaded}
                    directionsResult={directionsResult}
                    directionsError={directionsError}
                    mapRef={mapRef}
                    replayMode={replayMode}
                    replayProgress={replayProgress}
                    onReplay={runReplay}
                    getReplayPosition={getReplayPosition}
                />
            )}

            {/* Click away to close sort */}
            {showSort && <div className="fixed inset-0 z-40" onClick={() => setShowSort(false)} />}
        </div>
    );
}

export default AllTrips;