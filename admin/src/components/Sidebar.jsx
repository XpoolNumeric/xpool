import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, X, Menu, Shield, Wallet, Map, Users, Navigation, Settings as SettingsIcon, FileText, Database, LayoutDashboard, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

const Sidebar = ({ isOpen, setIsOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // BUG FIX: Only close sidebar on route change for MOBILE screens
    // Previously this closed the sidebar on ALL screens including desktop
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setIsOpen(false);
        }
    }, [location.pathname, setIsOpen]);

    const handleLogout = () => {
        localStorage.removeItem('adminAuth');
        localStorage.removeItem('adminRole');
        localStorage.removeItem('adminName');
        localStorage.removeItem('adminEmail');
        localStorage.removeItem('adminAvatar');
        navigate('/');
    };

    const navItems = [
        { label: 'Dashboard',         icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Pending Approvals', icon: Shield,          path: '/approvals' },
        { label: 'All Users',         icon: Users,           path: '/users' },
        { label: 'All Trips',         icon: Map,             path: '/trips' },
        { label: 'Withdrawals',       icon: Wallet,          path: '/withdrawals' },
        { label: 'Live Radar',        icon: Navigation,      path: '/live-tracking' },
        { label: 'Reports',           icon: FileText,        path: '/reports' },
        { label: 'Logs',              icon: Database,         path: '/logs' },
        { label: 'Settings',          icon: SettingsIcon,    path: '/settings' },
    ];

    const sidebarVariants = {
        hidden: { x: '-100%', opacity: 0 },
        visible: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 35 } },
        exit: { x: '-100%', opacity: 0, transition: { duration: 0.15 } }
    };

    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.1 } }
    };

    return (
        <>
            {/* ── Global Header (Top Navbar) ──────────────────────────── */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-gray-200/40 z-[60] flex items-center justify-between px-4 md:px-8">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsOpen(prev => !prev)}
                        className="p-2 -ml-2 text-gray-700 hover:bg-gray-100/60 rounded-xl transition-all active:scale-95"
                        aria-label="Toggle Menu"
                    >
                        <Menu size={22} strokeWidth={2.5} />
                    </button>
                    <div className="flex items-center gap-2.5">
                        <img src="/xpoolscreen.png" alt="XPOOL" className="h-9 w-9 rounded-xl object-cover shadow-sm bg-white p-0.5 border border-gray-100" />
                        <div className="flex flex-col">
                            <span className="font-extrabold text-gray-900 tracking-tight leading-none text-[17px]">Xpool Admin</span>
                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] mt-0.5">Operations Panel</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.15em]">System Live</span>
                    </div>
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-100/60 rounded-full">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                    </div>
                </div>
            </header>

            {/* ── Overlay (mobile only) ───────────────────────────────── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-[55] md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* ── Sidebar Panel ────────────────────────────────────────── */}
            <motion.aside
                variants={sidebarVariants}
                initial="hidden"
                animate={isOpen ? "visible" : "hidden"}
                className={cn(
                    "fixed top-16 left-0 bottom-0 z-[55] w-64 lg:w-72 flex flex-col pt-6 pb-6 px-4",
                    "bg-white/95 backdrop-blur-xl border-r border-gray-100/60 shadow-xl md:shadow-none",
                    !isOpen && "hidden"
                )}
            >
                {/* Close button - mobile only */}
                <div className="md:hidden flex justify-end mb-4">
                    <button
                        className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors"
                        onClick={() => setIsOpen(false)}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── Navigation ─────────────────────────────────────── */}
                <nav className="flex-1 space-y-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={cn(
                                    "w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200 group text-[13px] font-semibold relative overflow-hidden",
                                    isActive
                                        ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                )}
                            >
                                <div className="flex items-center gap-3 relative z-10">
                                    <Icon
                                        size={19}
                                        strokeWidth={isActive ? 2.5 : 2}
                                        className={cn(
                                            "transition-colors",
                                            isActive ? "text-white" : "text-gray-400 group-hover:text-amber-500"
                                        )}
                                    />
                                    <span>{item.label}</span>
                                </div>
                                {isActive && (
                                    <ChevronRight size={15} className="text-white/60" />
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* ── Admin Profile ───────────────────────────────────── */}
                <div className="mb-4 mt-6 p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 flex items-center gap-3.5 transition-all hover:shadow-md group">
                    <div className="relative shrink-0">
                        {localStorage.getItem('adminAvatar') ? (
                            <img 
                                src={localStorage.getItem('adminAvatar')} 
                                alt="Admin" 
                                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm border-2 border-white flex items-center justify-center text-white font-black text-sm uppercase">
                                {localStorage.getItem('adminName')?.charAt(0) || 'A'}
                            </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-gray-900 truncate tracking-tight">
                            {localStorage.getItem('adminName') || 'Admin'}
                        </span>
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-widest truncate w-max mt-0.5">
                            {localStorage.getItem('adminRole') || 'Administrator'}
                        </span>
                    </div>
                </div>

                {/* ── Logout ─────────────────────────────────────────── */}
                <div className="pt-4 border-t border-gray-100">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-red-600 bg-red-50/80 hover:bg-red-100 rounded-xl transition-all active:scale-[0.98] border border-red-100/50"
                    >
                        <LogOut size={17} />
                        Logout Securely
                    </button>
                </div>
            </motion.aside>
        </>
    );
};

export default Sidebar;
