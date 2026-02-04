import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import '../css/VerificationInProgress.css';

const VerificationInProgress = ({ onConfirm, onLogout }) => {
    const [checking, setChecking] = useState(false);
    const [userId, setUserId] = useState(null);

    // Get user ID on mount
    useEffect(() => {
        const getUserId = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
            }
        };
        getUserId();
    }, []);

    const checkStatus = async () => {
        setChecking(true);
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("User not found. Please login again.");
                return;
            }

            // Fetch driver status - Get ALL records for this user
            const { data: drivers, error } = await supabase
                .from('drivers')
                .select('status, id, user_id')
                .eq('user_id', user.id);

            console.log("DEBUG: Driver Fetch Result:", { drivers, error, userId: user.id });

            if (error) throw error;

            if (!drivers || drivers.length === 0) {
                console.error("DEBUG: No driver record found for user", user.id);
                toast.error("No application found.");
                return;
            }

            // Check if ANY record is approved
            const isApproved = drivers.some(d => d.status === 'approved');
            const isRejected = drivers.every(d => d.status === 'rejected'); // Only rejected if ALL are rejected and none are pending/approved

            if (isApproved) {
                toast.success("🎉 Profile Approved! Redirecting...");
                setTimeout(() => onConfirm(), 1500); // Proceed to next screen after 1.5s
                return true; // Indicate approval found
            } else if (isRejected) {
                toast.error("Application Rejected. Please contact support.");
            } else {
                // If not approved and not fully rejected, it's pending (or mixed pending/rejected)
                toast("Application is still under review.", {
                    icon: '⏳',
                });
                return false;
            }
        } catch (err) {
            console.error("Status check error", err);
            toast.error("Failed to check status. Try again.");
            return false;
        } finally {
            setChecking(false);
        }
    };

    // Automatic status polling every 10 seconds
    useEffect(() => {
        if (!userId) return;

        // Check immediately on mount
        checkStatus();

        // Then poll every 10 seconds
        const pollInterval = setInterval(async () => {
            console.log('[VerificationInProgress] Auto-checking status...');
            const approved = await checkStatus();
            if (approved) {
                clearInterval(pollInterval); // Stop polling if approved
            }
        }, 10000); // 10 seconds

        return () => clearInterval(pollInterval);
    }, [userId]);

    // Real-time subscription to drivers table for instant updates
    useEffect(() => {
        if (!userId) return;

        console.log('[VerificationInProgress] Setting up real-time subscription for user:', userId);

        const channel = supabase
            .channel('driver-status-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'drivers',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('[VerificationInProgress] Real-time update received:', payload);
                    const newStatus = payload.new.status;

                    if (newStatus === 'approved') {
                        toast.success("🎉 Your application has been approved!");
                        setTimeout(() => onConfirm(), 2000);
                    } else if (newStatus === 'rejected') {
                        toast.error("Your application was rejected. Please contact support.");
                    }
                }
            )
            .subscribe();

        return () => {
            console.log('[VerificationInProgress] Unsubscribing from real-time updates');
            supabase.removeChannel(channel);
        };
    }, [userId, onConfirm]);

    return (
        <div className="verification-modal-container animate-page-in">
            <div className="verification-modal">
                <div className="flex justify-center mb-4">
                    <Clock className="w-16 h-16 text-yellow-500 animate-pulse" />
                </div>
                <h2 className="modal-title">Verification in Progress</h2>
                <p className="modal-text">
                    Our team is reviewing your details.
                    <br />
                    Verification might take up to 24hrs.
                </p>

                <p className="modal-text highlight">
                    ✨ We're automatically checking for updates every 10 seconds.
                    <br />
                    You'll be notified instantly when approved!
                </p>

                <button
                    className="modal-btn flex items-center justify-center gap-2"
                    onClick={checkStatus}
                    disabled={checking}
                >
                    {checking ? <Loader2 className="animate-spin w-5 h-5" /> : 'Check Status'}
                </button>

                {onLogout && (
                    <button
                        className="modal-btn logout-link"
                        onClick={onLogout}
                        style={{
                            background: 'transparent',
                            color: '#ef4444',
                            marginTop: '1rem',
                            border: '1px solid #fee2e2'
                        }}
                    >
                        Logout
                    </button>
                )}
            </div>
        </div>
    );
};

export default VerificationInProgress;

