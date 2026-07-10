import React, { useEffect, useState, memo, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Loader2, Check, X, Wallet, Search, Filter, Copy, ArrowRight, IndianRupee, CreditCard, Clock, RefreshCw, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
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
  
      @keyframes shimmer {
        0%   { background-position: 200% center; }
        100% { background-position: -200% center; }
      }
      .cta-shimmer {
        background: linear-gradient(
          110deg,
          #10B981 0%, #34D399 30%,
          #059669 50%, #34D399 70%,
          #10B981 100%
        );
        background-size: 200% auto;
        animation: shimmer 3s linear infinite;
        color: #fff !important;
        font-weight: 700 !important;
        border: none !important;
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4), 0 1px 0 rgba(255,255,255,0.35) inset;
        transition: filter var(--transition-base), box-shadow var(--transition-base), transform 0.1s;
      }
      .cta-shimmer:hover {
        filter: brightness(1.1);
        box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5), 0 1px 0 rgba(255,255,255,0.35) inset;
      }
      .cta-shimmer:active {
        transform: scale(0.97);
      }

      .btn-danger {
        background: rgba(239, 68, 68, 0.08);
        color: #DC2626;
        border: 1px solid rgba(239, 68, 68, 0.2);
        font-weight: 600;
        transition: all 0.2s ease;
      }
      .btn-danger:hover {
        background: rgba(239, 68, 68, 0.15);
        border-color: rgba(239, 68, 68, 0.4);
        transform: scale(0.97);
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
        .pulse-blob, .cta-shimmer, .badge-breathe {
          animation: none !important;
        }
      }
    `}</style>
);

// ─────────────────────────────────────────────────────────────────────────────
// Animated Background
// ─────────────────────────────────────────────────────────────────────────────
const PULSE_CONFIG = [
    { x: 10, y: 20, size: 300, delay: 0, dur: 4.4, opacity: 0.15 },
    { x: 85, y: 75, size: 250, delay: 1.2, dur: 5.1, opacity: 0.12 },
    { x: 50, y: 40, size: 400, delay: 2.1, dur: 6.2, opacity: 0.10 },
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
            {/* Dot grid overlay */}
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
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────
const CopyButton = ({ text, label }) => {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => {
                navigator.clipboard.writeText(text);
                setCopied(true);
                toast.success(`${label} Copied`);
                setTimeout(() => setCopied(false), 2000);
            }}
            className="group px-2 py-1 flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded hover:bg-amber-200 transition-colors"
            title={`Copy ${label}`}
        >
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-amber-600 group-hover:text-amber-800" />}
            {text}
        </button>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const WithdrawalRequests = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);

    // Filters and Search
    const [searchQuery, setSearchQuery] = useState('');
    const [methodFilter, setMethodFilter] = useState('all'); // all, upi, bank

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const { data: reqs, error } = await supabase
                .from('withdrawal_requests')
                .select('*, drivers:driver_id ( full_name, vehicle_number )')
                .eq('status', 'pending')
                .order('created_at', { ascending: true });

            if (error) throw error;
            setRequests(reqs || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch requests');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id, amount) => {
        if (!confirm(`Are you sure you want to mark ₹${amount} as SENT? This will finalize the deduction.`)) return;

        try {
            const { error } = await supabase.rpc('approve_withdrawal_request', { request_id: id });
            if (error) throw error;

            toast.success('Funds Sent & Wallet Deducted');
            fetchRequests();
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Approval Failed');
        }
    };

    const handleReject = async (id) => {
        const reason = prompt('Enter reason for rejection (e.g., Incorrect Details):');
        if (!reason) return;

        try {
            const { error } = await supabase
                .from('withdrawal_requests')
                .update({ status: 'rejected', admin_note: reason, updated_at: new Date() })
                .eq('id', id);

            if (error) throw error;

            toast.success('Request Rejected');
            fetchRequests();
        } catch (error) {
            console.error(error);
            toast.error('Rejection Failed');
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const matchesSearch = req.drivers?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                req.drivers?.vehicle_number?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesMethod = methodFilter === 'all' || req.method === methodFilter;
            return matchesSearch && matchesMethod;
        });
    }, [requests, searchQuery, methodFilter]);

    const totalAmount = useMemo(() => requests.reduce((sum, req) => sum + Number(req.amount), 0), [requests]);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };

    const cardVariants = {
        hidden: { opacity: 0, scale: 0.98, y: 10 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } }
    };

    return (
        <div className="dashboard-container bg-gray-50/50" style={{ minHeight: '100vh', position: 'relative', background: "linear-gradient(160deg, #fffbeb 0%, #fef9e7 45%, #fffdf5 100%)" }}>
            <GlobalStyles />
            <PulseBackground />

            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className={`dashboard-content-wrapper relative z-10 h-full transition-all duration-300 pt-16 pb-10 ${sidebarOpen ? 'md:ml-64 lg:ml-72' : 'ml-0'}`}>
                <main className="dashboard-main max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">

                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
                            <div className="inline-flex flex-col mb-2">
                                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3">
                                    Payouts <span className="text-amber-500">Hub</span>
                                </h1>
                                <div className="h-1 w-1/3 bg-amber-500 rounded-full mt-2" />
                            </div>
                            <p className="text-gray-500 font-medium">Manage driver withdrawal requests and settlements</p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
                            className="badge-breathe glass-card flex items-center gap-5 p-4 rounded-2xl"
                        >
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Pending Queue</span>
                                <span className="text-2xl font-bold text-gray-900">{requests.length}</span>
                            </div>
                            <div className="w-[1px] h-10 bg-gray-200"></div>
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Total Value</span>
                                <span className="text-2xl font-bold text-amber-600">{formatCurrency(totalAmount)}</span>
                            </div>
                            <button onClick={fetchRequests} className="ml-2 p-2 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 hover:rotate-180 transition-all duration-300">
                                <RefreshCw size={20} />
                            </button>
                        </motion.div>
                    </div>

                    {/* Toolbar */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-4 mb-8"
                    >
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-4 top-1/2 -transform-translate-y-1/2 text-gray-400 -mt-2.5" size={20} />
                            <input
                                type="text"
                                placeholder="Search driver name or vehicle..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="glass-input w-full pl-11 pr-4 py-3 rounded-xl text-gray-700 placeholder-gray-400"
                            />
                        </div>
                        <div className="flex items-center gap-2 p-1.5 bg-white/50 backdrop-blur rounded-xl border border-gray-200/50">
                            {[
                                { id: 'all', label: 'All', icon: Filter },
                                { id: 'upi', label: 'UPI', icon: Zap },
                                { id: 'bank', label: 'Bank Transfer', icon: CreditCard }
                            ].map(filter => (
                                <button
                                    key={filter.id}
                                    onClick={() => setMethodFilter(filter.id)}
                                    className={cn(
                                        "px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all",
                                        methodFilter === filter.id
                                            ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                                            : "text-gray-600 hover:bg-gray-100/80"
                                    )}
                                >
                                    <filter.icon size={16} />
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Content Area */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 size={48} className="animate-spin text-amber-500 mb-4" />
                            <p className="text-gray-500 font-medium animate-pulse">Syncing payouts...</p>
                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="glass-card flex flex-col items-center justify-center p-16 text-center rounded-3xl"
                        >
                            <div className="w-24 h-24 mb-6 rounded-full bg-amber-100 flex items-center justify-center border-4 border-amber-50">
                                <Wallet size={40} className="text-amber-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Requests Found</h3>
                            <p className="text-gray-500 max-w-sm">
                                {requests.length === 0
                                    ? "All drivers are settled up! No pending withdrawal requests at the moment."
                                    : "No requests match your current filters. Try adjusting your search."}
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
                                {filteredRequests.map(req => (
                                    <motion.div
                                        key={req.id}
                                        variants={cardVariants}
                                        layout
                                        className="glass-card rounded-2xl overflow-hidden flex flex-col group relative"
                                    >
                                        {/* Status indicator bar top */}
                                        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-amber-600"></div>

                                        <div className="p-6 flex-1 flex flex-col">
                                            {/* Header */}
                                            <div className="flex justify-between items-start mb-5">
                                                <div className="flex flex-col">
                                                    <span className="text-lg font-bold text-gray-900 mb-0.5">{req.drivers?.full_name || 'Unknown Driver'}</span>
                                                    <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md inline-block w-max">
                                                        {req.drivers?.vehicle_number}
                                                    </span>
                                                </div>
                                                <div className="bg-amber-100/50 px-3 py-1.5 rounded-lg border border-amber-200">
                                                    <span className="text-xl font-extrabold text-amber-600 tracking-tight">{formatCurrency(req.amount)}</span>
                                                </div>
                                            </div>

                                            {/* Details Plate */}
                                            <div className="bg-white/60 p-4 rounded-xl border border-gray-100 mb-5 flex-1 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                                                    {req.method === 'upi' ? <Zap size={48} /> : <CreditCard size={48} />}
                                                </div>

                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="px-2.5 py-1 rounded bg-gray-900 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 w-max">
                                                        {req.method === 'upi' ? 'UPI Transfer' : 'Bank Transfer'}
                                                    </div>
                                                </div>

                                                <div className="space-y-2.5 z-10 relative">
                                                    {req.method === 'upi' ? (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-xs text-gray-500 font-semibold uppercase">UPI ID</span>
                                                            <CopyButton text={req.details?.upiId || '—'} label="UPI ID" />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-xs text-gray-500 font-semibold uppercase">Account No</span>
                                                                <CopyButton text={req.details?.accountNumber || '—'} label="A/C No" />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3 mt-1">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-xs text-gray-500 font-semibold uppercase">IFSC</span>
                                                                    <CopyButton text={req.details?.ifsc || '—'} label="IFSC" />
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-xs text-gray-500 font-semibold uppercase">Holder</span>
                                                                    <span className="text-sm font-semibold text-gray-800 truncate" title={req.details?.holderName || ''}>{req.details?.holderName || '—'}</span>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Time Footer */}
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-5">
                                                <Clock size={14} />
                                                <span>Requested: {new Date(req.created_at).toLocaleString('en-IN', {
                                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                })}</span>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="grid grid-cols-2 gap-3 mt-auto">
                                                <button
                                                    onClick={() => handleReject(req.id)}
                                                    className="btn-danger py-3 rounded-xl flex items-center justify-center gap-2"
                                                >
                                                    <X size={18} strokeWidth={2.5} />
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(req.id, req.amount)}
                                                    className="cta-shimmer py-3 rounded-xl flex items-center justify-center gap-2"
                                                >
                                                    <Check size={18} strokeWidth={2.5} />
                                                    Mark Sent
                                                </button>
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
};

export default WithdrawalRequests;

