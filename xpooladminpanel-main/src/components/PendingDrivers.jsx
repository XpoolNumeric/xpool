import React, { useEffect, useState, memo } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Loader2, Car, ChevronRight, ShieldAlert, Check } from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import { useRealtime } from '../hooks/useRealtime';

// Global Styles from Hero
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
        border-color: rgba(245, 158, 11, 0.4);
        transform: translateY(-2px);
        box-shadow: 0 15px 40px rgba(245, 158, 11, 0.1);
      }
    `}</style>
);

const PULSE_CONFIG = [
    { x: 10, y: 15, size: 300, delay: 0, dur: 5, opacity: 0.15 },
    { x: 80, y: 25, size: 250, delay: 1, dur: 4.8, opacity: 0.12 },
    { x: 50, y: 50, size: 400, delay: 2, dur: 5.5, opacity: 0.1 },
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
                        background: `radial-gradient(circle, rgba(245,158,11,${p.opacity}) 0%, rgba(217,119,6,${p.opacity * 0.5}) 42%, transparent 70%)`,
                        filter: "blur(40px)",
                        animationDuration: `${p.dur}s`,
                        animationDelay: `${p.delay}s`,
                    }}
                />
            ))}
        </div>
    );
});
PulseBackground.displayName = "PulseBackground";

function PendingDrivers() {
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState(new Date());
    const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
    const navigate = useNavigate();

    const fetchPendingDrivers = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        else setIsSyncing(true);

        try {
            const { data, error } = await supabase
                .from('drivers')
                .select('id, full_name, vehicle_type, vehicle_number, created_at, phone, email')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching drivers:", error);
            } else {
                setDrivers(data);
                setLastSynced(new Date());
            }
        } finally {
            setLoading(false);
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        fetchPendingDrivers();

        // 10-second sync interval
        const interval = setInterval(() => {
            fetchPendingDrivers(false);
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    useRealtime('drivers', () => fetchPendingDrivers(false));

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.98, y: 10 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }
    };

    return (
        <div className="dashboard-container inter-font bg-gray-50/50" style={{ minHeight: '100vh', position: 'relative', background: "linear-gradient(160deg, #fffbeb 0%, #fef9e7 45%, #fffdf5 100%)" }}>
            <GlobalStyles />
            <PulseBackground />

            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className={`dashboard-content-wrapper relative z-10 h-full transition-all duration-300 pt-16 pb-10 ${sidebarOpen ? 'md:ml-64 lg:ml-72' : 'ml-0'}`}>
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">

                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="inline-flex flex-col mb-2">
                                <h1 className="text-3xl flex items-center gap-3 sm:text-4xl font-extrabold tracking-tight text-gray-900">
                                    Pending <span className="text-amber-500">Approvals</span>
                                </h1>
                                <div className="h-1.5 w-1/3 bg-amber-500 rounded-full mt-2 shadow-sm" />
                            </div>
                            <p className="text-gray-500 font-medium max-w-lg">
                                Securely verify and manage driver applications.
                                <span className="hidden sm:inline"> System syncs automatically every 10 seconds.</span>
                            </p>
                        </div>

                        <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/80 shadow-sm self-start">
                            <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                {isSyncing ? 'Syncing...' : 'Synced'}
                                <span className="text-gray-400 font-medium normal-case">
                                    at {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                            </span>
                        </div>
                    </motion.div>

                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-100/50 text-amber-600 rounded-2xl border border-amber-200/50 shadow-inner">
                                <ShieldAlert size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 leading-tight">Waiting Queue</h2>
                                <p className="text-xs font-bold text-amber-600/70 uppercase tracking-wider">Verification Required</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-black rounded-2xl shadow-lg shadow-amber-500/20 border border-amber-400/30">
                                {drivers.length} TOTAL
                            </span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col justify-center items-center py-32 gap-4">
                            <div className="relative">
                                <Loader2 size={48} className="animate-spin text-amber-500" />
                                <div className="absolute inset-0 blur-2xl bg-amber-500/20 rounded-full" />
                            </div>
                            <p className="text-gray-400 font-bold text-sm uppercase tracking-widest animate-pulse">Initializing Data...</p>
                        </div>
                    ) : drivers.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="glass-card flex flex-col items-center justify-center p-20 text-center rounded-[3rem] border-2 border-dashed border-emerald-100"
                        >
                            <div className="w-24 h-24 mb-6 rounded-full bg-emerald-100/50 flex items-center justify-center border-4 border-emerald-50 shadow-xl shadow-emerald-500/5">
                                <Check size={48} className="text-emerald-500" />
                            </div>
                            <h3 className="text-3xl font-black text-gray-900 mb-3">All Clear!</h3>
                            <p className="text-gray-500 max-w-sm font-medium">
                                Excellent work. There are no driver applications waiting for your approval at this time.
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            <AnimatePresence mode='popLayout'>
                                {drivers.map(driver => (
                                    <motion.div
                                        key={driver.id}
                                        variants={itemVariants}
                                        layout
                                        onClick={() => navigate(`/driver/${driver.id}`)}
                                        className="glass-card glass-card-hover rounded-[2.5rem] p-6 cursor-pointer relative overflow-hidden group border border-white/50"
                                    >
                                        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-amber-100/40 to-transparent rounded-bl-full -mr-20 -mt-20 transition-all group-hover:scale-110 pointer-events-none" />

                                        <div className="flex flex-col gap-5 relative z-10">
                                            <div className="flex justify-between items-start">
                                                <div className="w-14 h-14 bg-white rounded-2xl shadow-md border border-gray-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                    <Car size={30} className="text-amber-500" />
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Applied On</span>
                                                    <span className="text-xs text-gray-900 font-bold bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                                                        {new Date(driver.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                            </div>

                                            <div>
                                                <h3 className="text-xl font-black text-gray-900 truncate mb-1 group-hover:text-amber-600 transition-colors uppercase tracking-tight">
                                                    {driver.full_name}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-[10px] font-black text-white bg-gray-900 px-2.5 py-1 rounded-full uppercase tracking-widest">{driver.vehicle_type}</span>
                                                    <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full uppercase tracking-widest border border-amber-200">{driver.vehicle_number}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-4 border-t border-gray-100/50">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-gray-400 font-black uppercase tracking-[0.2em]">Contact</span>
                                                    <span className="text-xs text-gray-700 font-bold">{driver.phone}</span>
                                                </div>
                                                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center transform group-hover:translate-x-1 transition-all shadow-md shadow-amber-500/20">
                                                    <ChevronRight size={20} strokeWidth={3} />
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
        </div>
    );
}

export default PendingDrivers;
