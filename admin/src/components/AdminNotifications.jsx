import { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { ShieldAlert, BellRing, Wallet, UserPlus } from 'lucide-react';
import React from 'react';

/**
 * AdminNotifications — Headless component that listens to realtime DB changes
 * and triggers rich toast notifications for admin awareness.
 *
 * BUG FIX: Previously referenced payload.new.source / payload.new.destination
 * which don't exist. Corrected to from_location / to_location.
 *
 * ENHANCEMENT: Added withdrawal_requests listener + richer notification UI.
 */
function AdminNotifications() {
    useEffect(() => {
        // ── Trip Events ──────────────────────────────────────────────
        const tripSub = supabase.channel('notify-trips')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trips' }, (payload) => {
                const trip = payload.new;
                toast.custom((t) => (
                    <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 overflow-hidden`}>
                        <div className="h-full w-1.5 bg-emerald-500 shrink-0" />
                        <div className="flex-1 w-0 p-4">
                            <div className="flex items-start">
                                <div className="flex-shrink-0">
                                    <BellRing className="h-10 w-10 p-2.5 bg-emerald-100 text-emerald-600 rounded-xl" />
                                </div>
                                <div className="ml-3 flex-1">
                                    <p className="text-sm font-bold text-gray-900">New Trip Requested</p>
                                    <p className="mt-1 text-xs text-gray-500 font-medium leading-relaxed">
                                        {trip.from_location || 'Unknown'} → {trip.to_location || 'Unknown'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ), { duration: 5000 });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips' }, (payload) => {
                const trip = payload.new;
                if (trip.status === 'cancelled') {
                    toast.custom((t) => (
                        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 overflow-hidden`}>
                            <div className="h-full w-1.5 bg-red-500 shrink-0" />
                            <div className="flex-1 w-0 p-4">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0">
                                        <ShieldAlert className="h-10 w-10 p-2.5 bg-red-100 text-red-500 rounded-xl" />
                                    </div>
                                    <div className="ml-3 flex-1">
                                        <p className="text-sm font-bold text-gray-900">Trip Cancelled</p>
                                        <p className="mt-1 text-xs text-gray-500 font-medium">
                                            Trip #{trip.id?.substring(0, 8)} needs attention.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ), { duration: 5000 });
                }
            })
            .subscribe();

        // ── Driver Events ────────────────────────────────────────────
        const driverSub = supabase.channel('notify-drivers')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'drivers' }, (payload) => {
                const driver = payload.new;
                toast.custom((t) => (
                    <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 overflow-hidden`}>
                        <div className="h-full w-1.5 bg-amber-500 shrink-0" />
                        <div className="flex-1 w-0 p-4">
                            <div className="flex items-start">
                                <div className="flex-shrink-0">
                                    <UserPlus className="h-10 w-10 p-2.5 bg-amber-100 text-amber-600 rounded-xl" />
                                </div>
                                <div className="ml-3 flex-1">
                                    <p className="text-sm font-bold text-gray-900">New Driver Application</p>
                                    <p className="mt-1 text-xs text-gray-500 font-medium">
                                        {driver.full_name || 'Driver'} applied for verification.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ), { duration: 5000 });
            })
            .subscribe();

        // ── Withdrawal Events ────────────────────────────────────────
        const withdrawalSub = supabase.channel('notify-withdrawals')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'withdrawal_requests' }, (payload) => {
                const req = payload.new;
                toast.custom((t) => (
                    <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 overflow-hidden`}>
                        <div className="h-full w-1.5 bg-purple-500 shrink-0" />
                        <div className="flex-1 w-0 p-4">
                            <div className="flex items-start">
                                <div className="flex-shrink-0">
                                    <Wallet className="h-10 w-10 p-2.5 bg-purple-100 text-purple-600 rounded-xl" />
                                </div>
                                <div className="ml-3 flex-1">
                                    <p className="text-sm font-bold text-gray-900">Withdrawal Requested</p>
                                    <p className="mt-1 text-xs text-gray-500 font-medium">
                                        ₹{req.amount || '—'} pending review.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ), { duration: 5000 });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(tripSub);
            supabase.removeChannel(driverSub);
            supabase.removeChannel(withdrawalSub);
        };
    }, []);

    return null; // Headless component
}

export default AdminNotifications;
