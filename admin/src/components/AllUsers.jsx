import React, { useEffect, useState, memo } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, User, Search, MapPin, Mail, Phone, Clock, Calendar, ShieldCheck, X, Navigation, Ban, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from './Sidebar';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';

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

      .glass-input {
        background: rgba(255, 255, 255, 0.5);
        border: 1px solid rgba(245, 158, 11, 0.2);
        transition: all 0.2s;
      }
      .glass-input:focus {
        background: rgba(255, 255, 255, 0.9);
        border-color: rgba(245, 158, 11, 0.6);
        outline: none;
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
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
    { x: 10, y: 30, size: 300, delay: 0.5, dur: 5.2, opacity: 0.12 },
    { x: 85, y: 15, size: 250, delay: 1.2, dur: 4.8, opacity: 0.15 },
    { x: 70, y: 80, size: 400, delay: 2.1, dur: 6.5, opacity: 0.10 },
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
                        background: `radial-gradient(circle, rgba(59,130,246,${p.opacity}) 0%, rgba(96,165,250,${p.opacity * 0.5}) 42%, transparent 70%)`,
                        filter: "blur(40px)",
                        animationDuration: `${p.dur}s`,
                        animationDelay: `${p.delay}s`,
                    }}
                />
            ))}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: "radial-gradient(rgba(59,130,246,0.06) 1px, transparent 1px)",
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
function AllUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');
    const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userTrips, setUserTrips] = useState([]);
    const [loadingTrips, setLoadingTrips] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };
    const handleUserSelect = async (user) => {
        setSelectedUser(user);
        setLoadingTrips(true);
        try {
            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setUserTrips(data || []);
        } catch (error) {
            console.error("Error fetching user trips:", error);
            toast.error("Could not load ride history.");
        } finally {
            setLoadingTrips(false);
        }
    };

    const toggleBlockUser = async (user) => {
        const isBlocked = user.is_blocked || false;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_blocked: !isBlocked })
                .eq('id', user.id);
            if (error) throw error;

            toast.success(isBlocked ? "User Unblocked" : "User Blocked");
            setUsers(users.map(u => u.id === user.id ? { ...u, is_blocked: !isBlocked } : u));
            if (selectedUser?.id === user.id) {
                setSelectedUser({ ...selectedUser, is_blocked: !isBlocked });
            }
        } catch (error) {
            console.error("Error updating block status:", error);
            toast.error("Failed to update user status.");
        }
    };
    const filteredUsers = users.filter(user => {
        const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.phone_number?.includes(searchTerm);

        if (!matchesSearch) return false;

        switch (filter) {
            case 'passenger': return user.role === 'passenger' || user.role === 'user' || !user.role;
            case 'driver': return user.role === 'driver';
            case 'admin': return user.role === 'admin';
            case 'blocked': return user.is_blocked;
            default: return true;
        }
    });

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } }
    };

    return (
        <div className="dashboard-container bg-gray-50/50" style={{ minHeight: '100vh', position: 'relative', background: "linear-gradient(160deg, #eff6ff 0%, #f8fafc 45%, #ffffff 100%)" }}>
            <GlobalStyles />
            <PulseBackground />

            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className={`dashboard-content-wrapper relative z-10 h-full transition-all duration-300 pt-16 pb-10 ${sidebarOpen ? 'md:ml-64 lg:ml-72' : 'ml-0'}`}>
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">

                    {/* Header */}
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="mb-10 w-full flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="inline-flex flex-col mb-2">
                                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3">
                                    User <span className="text-blue-500">Directory</span>
                                </h1>
                                <div className="h-1 w-1/3 bg-blue-500 rounded-full mt-2" />
                            </div>
                            <p className="text-gray-500 font-medium">Manage all regular users and operational accounts.</p>
                        </div>

                        {/* Search and Filter */}
                        <div className="flex flex-col gap-3 w-full md:max-w-md">
                            <div className="relative w-full">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-blue-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search by name, email or phone..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="glass-input w-full pl-11 pr-4 py-3 sm:py-3.5 rounded-xl text-gray-700 placeholder-gray-400 font-medium shadow-sm transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                                    style={{ borderColor: 'rgba(59,130,246,0.3)' }}
                                />
                            </div>
                            <div className="flex items-center gap-2 p-1.5 bg-white/50 backdrop-blur rounded-xl border border-gray-200/50 overflow-x-auto w-full no-scrollbar">
                                {['all', 'passenger', 'driver', 'admin', 'blocked'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all capitalize whitespace-nowrap ${filter === f
                                                ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                                                : "text-gray-600 hover:bg-gray-100/80"
                                            }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Content */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24">
                            <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
                            <p className="text-gray-500 font-medium animate-pulse">Loading directory...</p>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="glass-card flex flex-col items-center justify-center p-16 text-center rounded-3xl"
                        >
                            <div className="w-24 h-24 mb-6 rounded-full bg-blue-50 flex items-center justify-center border-4 border-blue-100/50">
                                <User size={40} className="text-blue-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Users Found</h3>
                            <p className="text-gray-500 max-w-sm">
                                We couldn't find anyone matching "{searchTerm}". Try another search term.
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            <AnimatePresence>
                                {filteredUsers.map(user => (
                                    <motion.div
                                        key={user.id}
                                        variants={itemVariants}
                                        layout
                                        className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col"
                                    >
                                        {/* Identify Header */}
                                        <div className="flex items-start gap-4 mb-5">
                                            <div className="relative">
                                                {user.avatar_url ? (
                                                    <img src={user.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md bg-gray-100" />
                                                ) : (
                                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-white shadow-md flex items-center justify-center text-blue-500 font-bold text-xl">
                                                        {user.full_name ? user.full_name.charAt(0).toUpperCase() : '?'}
                                                    </div>
                                                )}
                                                {user.role === 'admin' && (
                                                    <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-1 rounded-full border-2 border-white" title="Admin">
                                                        <ShieldCheck size={12} strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col flex-1 pt-1">
                                                <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">{user.full_name || 'Anonymous User'}</h3>
                                                <span className={`text-xs font-semibold w-max px-2 py-0.5 rounded uppercase tracking-wider ${user.role === 'admin' ? 'bg-amber-100 text-amber-700' :
                                                        user.role === 'driver' ? 'bg-emerald-100 text-emerald-700' :
                                                            'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {user.role || 'Passenger'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Contact Grid */}
                                        <div className="bg-white/60 p-4 rounded-xl space-y-3 mb-5 flex-1 border border-gray-100/50">
                                            <div className="flex items-center gap-3 text-sm">
                                                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                                    <Mail size={14} className="text-blue-500" />
                                                </div>
                                                <span className="text-gray-700 font-medium truncate" title={user.email}>{user.email || '—'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm">
                                                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                                    <Phone size={14} className="text-blue-500" />
                                                </div>
                                                <span className="text-gray-700 font-medium">{user.phone_number || '—'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm">
                                                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                                    <Calendar size={14} className="text-blue-500" />
                                                </div>
                                                <span className="text-gray-500">Joined <strong className="text-gray-700">{new Date(user.created_at).toLocaleDateString()}</strong></span>
                                            </div>
                                        </div>

                                        {/* Action */}
                                        <button
                                            onClick={() => handleUserSelect(user)}
                                            className="w-full py-2.5 rounded-xl font-semibold text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/50 transition-colors flex justify-center items-center gap-2"
                                        >
                                            View Full Activity
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </main>
            </div>

            {/* User Detail Modal */}
            <AnimatePresence>
                {selectedUser && (
                    <div className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6" onClick={() => setSelectedUser(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white max-w-3xl w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-[650px] font-inter"
                        >
                            {/* Modal Header */}
                            <div className="flex items-start justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                                <div className="flex items-center gap-4">
                                    {selectedUser.avatar_url ? (
                                        <img src={selectedUser.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 font-bold text-2xl border-2 border-white shadow-sm">
                                            {selectedUser.full_name ? selectedUser.full_name.charAt(0).toUpperCase() : '?'}
                                        </div>
                                    )}
                                    <div>
                                        <h2 className="text-2xl font-extrabold text-gray-900 leading-tight">{selectedUser.full_name || 'Anonymous User'}</h2>
                                        <p className="text-gray-500 text-sm font-medium">{selectedUser.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => toggleBlockUser(selectedUser)}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors shadow-sm ${selectedUser.is_blocked ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'}`}
                                    >
                                        {selectedUser.is_blocked ? <CheckCircle size={16} /> : <Ban size={16} />}
                                        {selectedUser.is_blocked ? 'Unblock User' : 'Block User'}
                                    </button>
                                    <button onClick={() => setSelectedUser(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-600">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable Body */}
                            <div className="p-6 md:p-8 flex-1 overflow-y-auto bg-white">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Phone Number</span>
                                        <div className="font-semibold text-gray-900">{selectedUser.phone_number || 'Not provided'}</div>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Joined Date</span>
                                        <div className="font-semibold text-gray-900">{new Date(selectedUser.created_at).toLocaleDateString()}</div>
                                    </div>
                                </div>

                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-gray-900">Ride History</h3>
                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-black tracking-widest uppercase">{userTrips.length} Trips</span>
                                </div>

                                {loadingTrips ? (
                                    <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
                                ) : userTrips.length === 0 ? (
                                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100">
                                        <Navigation size={32} className="mx-auto text-gray-300 mb-2" />
                                        <p className="text-gray-500 font-medium">No rides taken yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {userTrips.map(trip => (
                                            <div key={trip.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="font-mono text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">#{trip.id.substring(0, 8)}</div>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 border rounded tracking-wider ${trip.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                        {trip.status}
                                                    </span>
                                                </div>
                                                <div className="space-y-2 mb-3">
                                                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500" /> {trip.from_location}
                                                    </div>
                                                    <div className="w-0.5 h-3 bg-gray-200 ml-1"></div>
                                                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                                        <div className="w-2 h-2 rounded-full bg-amber-500" /> {trip.to_location}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between mt-3 pt-3 border-t border-gray-100/50 text-xs font-semibold text-gray-500">
                                                    <span>{new Date(trip.travel_date).toLocaleDateString()} at {trip.travel_time}</span>
                                                    <span className="font-black text-amber-600">₹{trip.price_per_seat}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default AllUsers;
