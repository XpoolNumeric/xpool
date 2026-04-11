<<<<<<< HEAD
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Loader2, Users, Car, Map, Banknote, Activity, X, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { useRealtime } from '../hooks/useRealtime';
import { formatCurrency, getLocal } from '../lib/utils';
import PageLayout from './shared/PageLayout';

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Loader
// ─────────────────────────────────────────────────────────────────────────────
const StatSkeleton = () => (
    <div className="glass-card p-5 rounded-2xl flex flex-col items-start animate-pulse">
        <div className="w-12 h-12 rounded-xl bg-gray-200 mb-4" />
        <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
        <div className="h-8 w-28 bg-gray-200 rounded" />
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard Component
// ─────────────────────────────────────────────────────────────────────────────
function Dashboard() {
    const [stats, setStats] = useState({ users: 0, drivers: 0, trips: 0, earnings: 0, driverEarnings: 0, totalRevenue: 0 });
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showEarningsModal, setShowEarningsModal] = useState(false);
    const navigate = useNavigate();

    const fetchStats = useCallback(async () => {
=======
import React, { useEffect, useState, memo } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Loader2, Users, ChevronRight, Car, Map, Banknote, ShieldAlert, Check, Activity } from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import Sidebar from './Sidebar';
import { useRealtime } from '../hooks/useRealtime';

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
  
      @keyframes border-breathe {
        0%, 100% { border-color: rgba(245,158,11,0.18); }
        50%       { border-color: rgba(245,158,11,0.5); }
      }
      .badge-breathe { animation: border-breathe 3s ease-in-out infinite; }
  
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

      @media (prefers-reduced-motion: reduce) {
        .pulse-blob, .badge-breathe {
          animation: none !important;
        }
      }
    `}</style>
);

// ─────────────────────────────────────────────────────────────────────────────
// Animated Background
// ─────────────────────────────────────────────────────────────────────────────
const PULSE_CONFIG = [
    { x: 20, y: 15, size: 350, delay: 0, dur: 4.8, opacity: 0.12 },
    { x: 80, y: 65, size: 280, delay: 1.5, dur: 5.4, opacity: 0.10 },
    { x: 50, y: 80, size: 320, delay: 2.2, dur: 6.0, opacity: 0.14 },
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
                        background: `radial-gradient(circle, rgba(251,191,36,${p.opacity}) 0%, rgba(245,158,11,${p.opacity * 0.5}) 42%, transparent 70%)`,
                        filter: "blur(40px)",
                        animationDuration: `${p.dur}s`,
                        animationDelay: `${p.delay}s`,
                    }}
                />
            ))}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: "radial-gradient(rgba(245,158,11,0.06) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                    zIndex: 1,
                }}
            />
        </div>
    );
});
PulseBackground.displayName = "PulseBackground";

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard Component
// ─────────────────────────────────────────────────────────────────────────────
function Dashboard() {
    const [stats, setStats] = useState({ users: 0, drivers: 0, trips: 0, earnings: 0 });
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
    const navigate = useNavigate();

    const fetchStats = async () => {
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
        try {
            const [
                { count: userCount },
                { count: driverCount },
                { count: tripCount },
                { data: tripsData },
                { data: paymentsData }
            ] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
                supabase.from('trips').select('*', { count: 'exact', head: true }),
<<<<<<< HEAD
                supabase.from('trips').select('price_per_seat').eq('status', 'completed'),
                supabase.from('ride_payments').select('commission_amount, driver_amount')
=======
                supabase.from('trips').select('price_per_seat, seats_booked').eq('status', 'completed')
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
            ]);

            const commission = paymentsData?.reduce((acc, p) => acc + (Number(p.commission_amount) || 0), 0) || 0;
            const driverTotal = paymentsData?.reduce((acc, p) => acc + (Number(p.driver_amount) || 0), 0) || 0;

            setStats({
                users: userCount || 0,
                drivers: driverCount || 0,
                trips: tripCount || 0,
<<<<<<< HEAD
                earnings: commission,
                driverEarnings: driverTotal,
                totalRevenue: tripsData?.reduce((acc, trip) => acc + ((trip.price_per_seat || 0) * (trip.seats_booked || 1)), 0) || 0
=======
                earnings: tripsData?.reduce((acc, trip) => acc + ((trip.price_per_seat || 0) * (trip.seats_booked || 1)), 0) || 0
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
            });

            // Generate last 7 days revenue trend
            const sevenDaysAgo = subDays(new Date(), 7);
            const { data: trendData } = await supabase
                .from('trips')
<<<<<<< HEAD
                .select('created_at, price_per_seat')
=======
                .select('created_at, price_per_seat, seats_booked')
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                .gte('created_at', sevenDaysAgo.toISOString())
                .eq('status', 'completed');

            const grouped = {};
            for (let i = 6; i >= 0; i--) {
                const dateStr = format(subDays(new Date(), i), 'EEE');
                grouped[dateStr] = 0;
            }

            if (trendData) {
                trendData.forEach(trip => {
                    const dateStr = format(new Date(trip.created_at), 'EEE');
                    const tripRevenue = (trip.price_per_seat || 0) * (trip.seats_booked || 1);
                    if (grouped[dateStr] !== undefined) {
                        grouped[dateStr] += tripRevenue;
                    }
                });
            }

            const finalChart = Object.keys(grouped).map(day => ({
                name: day,
                revenue: grouped[day]
            }));
            setChartData(finalChart);
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        await fetchStats();
        setLoading(false);
    }, [fetchStats]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useRealtime('trips', fetchData);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };

<<<<<<< HEAD
    const itemVariants = {
        hidden: { opacity: 0, scale: 0.98, y: 10 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }
    };

    const statCards = [
        { label: 'Total Users', value: stats.users, trend: '+12%', isPositive: true, icon: Users, color: 'text-blue-500', bg: 'bg-blue-100', action: () => navigate('/users') },
        { label: 'Verified Drivers', value: stats.drivers, trend: '+8%', isPositive: true, icon: Car, color: 'text-amber-500', bg: 'bg-amber-100', action: () => navigate('/live-tracking') },
        { label: 'Total Trips', value: stats.trips, trend: '+24%', isPositive: true, icon: Map, color: 'text-emerald-500', bg: 'bg-emerald-100', action: () => navigate('/trips') },
        { label: 'Platform Commission', value: formatCurrency(stats.earnings), trend: '+14%', isPositive: true, icon: Banknote, color: 'text-purple-500', bg: 'bg-purple-100', action: () => setShowEarningsModal(true) },
    ];

    return (
        <PageLayout color="amber">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-10">
                <div className="inline-flex flex-col mb-2">
                    <h1 className="text-3xl flex items-center gap-3 sm:text-4xl font-extrabold tracking-tight text-gray-900">
                        Overview <span className="text-amber-500">Dashboard</span>
                    </h1>
                    <div className="h-1 w-1/3 bg-amber-500 rounded-full mt-2" />
                </div>
                <p className="text-gray-500 font-medium tracking-tight">
                    Welcome back, <span className="text-gray-900 font-black">{getLocal('adminName', 'Administrator')}</span>! Here's the platform pulse for today.
                </p>
            </motion.div>

            {/* Stats Grid */}
            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12">
                    {[...Array(4)].map((_, i) => <StatSkeleton key={i} />)}
                </div>
            ) : (
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12"
                >
                    {statCards.map((stat, i) => (
                        <motion.div key={i} variants={itemVariants} onClick={stat.action} className="badge-breathe glass-card p-5 rounded-2xl flex flex-col items-center sm:items-start text-center sm:text-left cursor-pointer glass-card-hover group">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${stat.bg} group-hover:scale-110 transition-transform`}>
                                <stat.icon className={stat.color} size={24} />
                            </div>
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">{stat.label}</span>
                            <div className="flex flex-wrap items-end gap-2 mt-1">
                                <span className="text-3xl font-black text-gray-900 tracking-tight leading-none">{stat.value}</span>
                                <span className={`flex items-center text-[12px] font-extrabold px-2 py-0.5 rounded-lg mb-0.5 ${stat.isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {stat.isPositive ? <ArrowUpRight size={14} className="mr-0.5" strokeWidth={3} /> : <ArrowDownRight size={14} className="mr-0.5" strokeWidth={3} />}
                                    {stat.trend}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            )}

            {/* Chart Section */}
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
                        <Activity size={22} />
=======
    const fetchData = async () => {
        setLoading(true);
        await fetchStats();
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    useRealtime('trips', fetchData);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };
    
    const itemVariants = {
        hidden: { opacity: 0, scale: 0.98, y: 10 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }
    };

    return (
        <div className="dashboard-container bg-gray-50/50" style={{ minHeight: '100vh', position: 'relative', background: "linear-gradient(160deg, #fffbeb 0%, #fef9e7 45%, #fffdf5 100%)" }}>
            <GlobalStyles />
            <PulseBackground />
            
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className={`dashboard-content-wrapper relative z-10 h-full transition-all duration-300 pt-16 pb-10 ${sidebarOpen ? 'md:ml-64 lg:ml-72' : 'ml-0'}`}>
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">
                    
                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-10">
                        <div className="inline-flex flex-col mb-2">
                            <h1 className="text-3xl flex items-center gap-3 sm:text-4xl font-extrabold tracking-tight text-gray-900">
                                Overview <span className="text-amber-500">Dashboard</span>
                            </h1>
                            <div className="h-1 w-1/3 bg-amber-500 rounded-full mt-2" />
                        </div>
                        <p className="text-gray-500 font-medium tracking-tight">
                            Welcome back, <span className="text-gray-900 font-black">{localStorage.getItem('adminName') || 'Administrator'}</span>! Here's the platform pulse for today.
                        </p>
                    </motion.div>

                    {/* Stats Grid */}
                    <motion.div 
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12"
                    >
                        {[
                            { label: 'Total Users', value: stats.users, icon: Users, color: 'text-blue-500', bg: 'bg-blue-100' },
                            { label: 'Verified Drivers', value: stats.drivers, icon: Car, color: 'text-amber-500', bg: 'bg-amber-100' },
                            { label: 'Total Trips', value: stats.trips, icon: Map, color: 'text-emerald-500', bg: 'bg-emerald-100' },
                            { label: 'Total Earnings', value: formatCurrency(stats.earnings), icon: Banknote, color: 'text-purple-500', bg: 'bg-purple-100' },
                        ].map((stat, i) => (
                            <motion.div key={i} variants={itemVariants} className="badge-breathe glass-card p-5 rounded-2xl flex flex-col items-center sm:items-start text-center sm:text-left">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${stat.bg}`}>
                                    <stat.icon className={stat.color} size={24} />
                                </div>
                                <span className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">{stat.label}</span>
                                <span className="text-3xl font-black text-gray-900 tracking-tight">{stat.value}</span>
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Chart Section */}
                    <div className="mb-12">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                <Activity size={24} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Revenue Overview <span className="text-gray-400 text-sm font-medium ml-2">(Live 7-day trend)</span></h2>
                        </div>
                        <div className="glass-card p-6 border border-gray-100/50 rounded-3xl h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(val) => `₹${val}`} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Revenue Overview</h2>
                        <p className="text-xs text-gray-400 font-medium">Live 7-day trend from completed trips</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                        <TrendingUp size={14} className="text-emerald-500" />
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                            {formatCurrency(stats.totalRevenue)} Total
                        </span>
                    </div>
                </div>
                <div className="glass-card p-6 border border-gray-100/50 rounded-3xl h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(val) => `₹${val}`} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                            <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Earnings Breakdown Modal */}
            <AnimatePresence>
                {showEarningsModal && (
                    <div className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={() => setShowEarningsModal(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white max-w-md w-full rounded-3xl shadow-2xl p-6 sm:p-8"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-purple-100 text-purple-600 rounded-xl">
                                        <Banknote size={24} />
                                    </div>
                                    <h3 className="text-2xl font-extrabold text-gray-900 leading-none">Earnings</h3>
                                </div>
                                <button onClick={() => setShowEarningsModal(false)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-600">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100">
                                    <span className="text-xs font-bold text-purple-500 uppercase tracking-widest block mb-1">Platform Commission</span>
                                    <div className="text-3xl font-black text-purple-700">{formatCurrency(stats.earnings)}</div>
                                </div>

                                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100">
                                    <span className="text-xs font-bold text-amber-600 uppercase tracking-widest block mb-1">Total Paid to Drivers</span>
                                    <div className="text-3xl font-black text-amber-700">{formatCurrency(stats.driverEarnings)}</div>
                                </div>

                                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 mt-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Gross TPV (Volume)</span>
                                    <div className="text-2xl font-black text-gray-800">{formatCurrency(stats.earnings + stats.driverEarnings)}</div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PageLayout>
    );
}

export default Dashboard;

