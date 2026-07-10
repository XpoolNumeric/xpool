import React, { useEffect, useState, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Check, X, Loader2, FileText, Smartphone, Mail, Calendar, Briefcase, MapPin, ZoomIn, Car, FileCheck, Info, Search, Clock, Power, Bell, Edit2, Save, User, Zap, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from './Sidebar';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

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

      .glass-card {
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04);
      }
      
      .glass-modal {
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border: 1px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }
    `}</style>
);

const PULSE_CONFIG = [
    { x: 10, y: 30, size: 300, delay: 0.5, dur: 5.2, opacity: 0.12 },
    { x: 80, y: 80, size: 350, delay: 1.2, dur: 4.8, opacity: 0.15 },
    { x: 50, y: 10, size: 280, delay: 2.1, dur: 6.5, opacity: 0.10 },
];

const PulseBackground = memo(() => {
    const prefersReducedMotion = useReducedMotion();
    if (prefersReducedMotion) return null;
    return (
        <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
            {PULSE_CONFIG.map((p, i) => (
                <div key={i} className="pulse-blob" style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, borderRadius: "50%", transform: "translate(-50%, -50%)", background: `radial-gradient(circle, rgba(245,158,11,${p.opacity}) 0%, rgba(217,119,6,${p.opacity * 0.5}) 42%, transparent 70%)`, filter: "blur(40px)", animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }} />
            ))}
        </div>
    );
});
PulseBackground.displayName = "PulseBackground";

function DriverReview() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [driver, setDriver] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageModal, setImageModal] = useState({ open: false, url: '', label: '' });
    const [confirmModal, setConfirmModal] = useState({ open: false, action: '', status: '' });
    const [actionLoading, setActionLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState({});
    const [verifyingDetails, setVerifyingDetails] = useState(false);

    useEffect(() => {
        fetchDriverDetails();

        const interval = setInterval(() => {
            if (!isEditing) fetchDriverDetails(false);
        }, 10000);

        return () => clearInterval(interval);
    }, [id, isEditing]);

    const fetchDriverDetails = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const { data, error } = await supabase.from('drivers').select('*').eq('id', id).single();
            if (!error && data) {
                setDriver(data);
                setEditedData(data);
            }
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    const getStorageUrl = (path, folder) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;

        // Construct public URL for Supabase Storage
        // Based on screenshot bucket: driver-docs
        const bucket = 'driver-docs';
        const projectUrl = import.meta.env.VITE_SUPABASE_URL;

        // If path is just filename, prepend folder
        const finalPath = path.includes('/') ? path : `${folder}/${path}`;

        return `${projectUrl}/storage/v1/object/public/${bucket}/${finalPath}`;
    };

    const urlToBase64 = async (url) => {
        if (!url) return null;
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve(reader.result.split(",")[1]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Failed to load image from URL", url, e);
            return null;
        }
    };

    const runAIVerify = async (frontUrl, backUrl, type) => {
        if (!frontUrl && !backUrl) return null;
        try {
            const frontBase64 = frontUrl ? await urlToBase64(frontUrl) : null;
            const backBase64 = backUrl ? await urlToBase64(backUrl) : null;

            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

            const baseInstruction = `You are a highly advanced AI anti-fraud and identity verification system specialized strictly in Indian Government Documents. Extract text via OCR.`;
            let instruction = '';

            if (type === 'DL') {
                instruction = `${baseInstruction}\nAnalyze Driving License (DL) images. Output ONLY JSON exactly like this:\n{\n  "extracted_data": { "name": "", "dl_number": "", "dob": "" }\n}`;
            } else if (type === 'RC') {
                instruction = `${baseInstruction}\nAnalyze Registration Certificate (RC) images. Output ONLY JSON exactly like this:\n{\n  "extracted_data": { "name": "", "vehicle_number": "", "vehicle_class": "" }\n}`;
            } else if (type === 'ID') {
                instruction = `${baseInstruction}\nAnalyze Aadhaar/PAN ID images. Output ONLY JSON exactly like this:\n{\n  "extracted_data": { "name": "", "id_number": "" }\n}`;
            }

            const parts = [{ text: "Analyze and output ONLY valid JSON." }];
            if (frontBase64) parts.push({ inline_data: { mime_type: "image/jpeg", data: frontBase64 } });
            if (backBase64) parts.push({ inline_data: { mime_type: "image/jpeg", data: backBase64 } });

            const requestBody = {
                system_instruction: { parts: [{ text: instruction }] },
                contents: [{ parts }],
                generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
            };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody),
            });
            if (!response.ok) throw new Error("API call failed");

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("No response string");

            return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch (e) {
            console.error(`Error verifying ${type}:`, e);
            return null;
        }
    };

    const handleAIVerify = async () => {
        setVerifyingDetails(true);
        const toastId = toast.loading("AI is scanning and verifying documents...", { duration: 15000 });

        try {
            const dlFrontUrl = getStorageUrl(driver.dl_front_url, 'dl_front');
            const dlBackUrl = getStorageUrl(driver.dl_back_url, 'dl_back');
            const rcFrontUrl = getStorageUrl(driver.rc_front_url, 'rc_front');
            const rcBackUrl = getStorageUrl(driver.rc_back_url, 'rc_back');
            const idFrontUrl = getStorageUrl(driver.aadhaar_pan_front_url, 'aadhaar_front');
            const idBackUrl = getStorageUrl(driver.aadhaar_pan_back_url, 'aadhaar_back');

            const [dlRes, rcRes, idRes] = await Promise.all([
                runAIVerify(dlFrontUrl, dlBackUrl, 'DL'),
                runAIVerify(rcFrontUrl, rcBackUrl, 'RC'),
                runAIVerify(idFrontUrl, idBackUrl, 'ID')
            ]);

            const updates = { ...editedData };
            let updatedAny = false;

            if (dlRes?.extracted_data) {
                if (dlRes.extracted_data.name) { updates.full_name = dlRes.extracted_data.name; updatedAny = true; }
                if (dlRes.extracted_data.dl_number) { updates.dl_number = dlRes.extracted_data.dl_number; updatedAny = true; }
                if (dlRes.extracted_data.dob) { updates.dob = dlRes.extracted_data.dob; updatedAny = true; }
            }
            if (rcRes?.extracted_data) {
                if (rcRes.extracted_data.vehicle_number) { updates.vehicle_number = rcRes.extracted_data.vehicle_number; updatedAny = true; }
                if (rcRes.extracted_data.vehicle_class) { updates.vehicle_type = rcRes.extracted_data.vehicle_class; updatedAny = true; }
            }
            if (idRes?.extracted_data) {
                if (idRes.extracted_data.id_number) { updates.aadhaar_pan_number = idRes.extracted_data.id_number; updatedAny = true; }
            }

            if (updatedAny) {
                setEditedData(updates);
                setIsEditing(true);
                toast.success("AI extraction completed! Review the auto-filled details.", { id: toastId });
            } else {
                toast.error("AI could not extract confident data from the documents.", { id: toastId });
            }
        } catch (err) {
            toast.error("AI Auto-Fill encountered an error.", { id: toastId });
            console.error(err);
        } finally {
            setVerifyingDetails(false);
        }
    };

    const handleSaveDetails = async () => {
        setActionLoading(true);
        const { error } = await supabase.from('drivers').update({
            full_name: editedData.full_name,
            phone: editedData.phone,
            vehicle_number: editedData.vehicle_number,
            vehicle_type: editedData.vehicle_type,
            dl_number: editedData.dl_number,
            aadhaar_pan_number: editedData.aadhaar_pan_number
        }).eq('id', id);

        if (!error) {
            setDriver(prev => ({ ...prev, ...editedData }));
            setIsEditing(false);
            toast.success("Details updated successfully");
        } else {
            toast.error("Failed to update details");
        }
        setActionLoading(false);
    };

    const updateStatus = async () => {
        setActionLoading(true);
        try {
            const { error } = await supabase.from('drivers').update({
                status: confirmModal.status
            }).eq('id', id);

            if (!error) {
                toast.success(`Driver ${confirmModal.status} successfully!`);

                // Also update the app backend/state by sending a notification
                await supabase.from('notifications').insert({
                    user_id: driver.user_id,
                    title: `Application ${confirmModal.status.charAt(0).toUpperCase() + confirmModal.status.slice(1)}`,
                    message: confirmModal.status === 'approved'
                        ? "Congratulations! Your driver application has been approved. You can now start taking rides."
                        : "Your application was not approved. Please review your documents and try again.",
                    type: 'system',
                    status: 'unread'
                }).select();

                // Small delay for UI and then navigate back
                setTimeout(() => {
                    navigate('/dashboard');
                }, 1500);
            } else {
                throw error;
            }
        } catch (err) {
            console.error("Update error:", err);
            toast.error(`Error: ${err.message || 'Failed to update status'}`);
        } finally {
            setActionLoading(false);
            closeConfirmModal();
        }
    };

    const toggleSuspend = async () => {
        setActionLoading(true);
        const newStatus = driver.status === 'suspended' ? 'approved' : 'suspended';
        const { error } = await supabase.from('drivers').update({ status: newStatus }).eq('id', id);

        if (!error) {
            setDriver(prev => ({ ...prev, status: newStatus }));
            toast.success(`Driver ${newStatus === 'suspended' ? 'Suspended' : 'Activated'}`);
        } else {
            toast.error('Failed to change status');
        }
        setActionLoading(false);
    };

    const openConfirmModal = (status) => {
        setConfirmModal({
            open: true,
            action: status === 'approved' ? 'approve' : 'reject',
            status: status
        });
    };

    const closeConfirmModal = () => {
        setConfirmModal({ open: false, action: '', status: '' });
    };

    const sendNotification = async () => {
        const msg = prompt("Enter notification message:");
        if (!msg) return;
        try {
            const { error } = await supabase.from('notifications').insert({
                user_id: driver.user_id,
                message: msg,
                type: 'driver_alert',
                status: 'unread'
            });
            if (error) throw error;
            toast.success("Notification Sent");
        } catch (e) {
            toast.error("Failed to send notification.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
                <Loader2 className="animate-spin text-amber-500" size={48} />
            </div>
        );
    }

    if (!driver) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50 inter-font">
                <div className="glass-card p-10 rounded-3xl flex flex-col items-center max-w-sm text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-500">
                        <X size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Driver Not Found</h2>
                    <p className="text-gray-500 mb-6">The requested applicant data could not be located in the database.</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold transition-all"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 10, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }
    };

    const getStatusTheme = (status) => {
        switch (status) {
            case 'approved': return { bg: 'bg-emerald-100 bg-opacity-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: Check };
            case 'rejected': return { bg: 'bg-red-100 bg-opacity-50', text: 'text-red-700', border: 'border-red-200', icon: X };
            default: return { bg: 'bg-amber-100 bg-opacity-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock };
        }
    };

    const StatusIcon = getStatusTheme(driver.status).icon;

    return (
        <div className="dashboard-container inter-font bg-gray-50/50" style={{ minHeight: '100vh', position: 'relative', background: "linear-gradient(160deg, #fffbeb 0%, #fef9e7 45%, #fffdf5 100%)" }}>
            <GlobalStyles />
            <PulseBackground />

            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className={`dashboard-content-wrapper relative z-10 h-full transition-all duration-300 pt-16 pb-10 ${sidebarOpen ? 'md:ml-64 lg:ml-72' : 'ml-0'}`}>
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">

                    <div className="flex items-center justify-between mb-8">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-bold transition-colors bg-white/50 backdrop-blur px-4 py-2 rounded-xl border border-gray-200 shadow-sm"
                        >
                            <ArrowLeft size={16} />
                            <span>Dashboard</span>
                        </button>

                        <button
                            onClick={() => isEditing ? handleSaveDetails() : setIsEditing(true)}
                            className={cn(
                                "flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all shadow-sm",
                                isEditing ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                            )}
                        >
                            {actionLoading ? <Loader2 size={16} className="animate-spin" /> : (isEditing ? <Save size={16} /> : <Edit2 size={16} />)}
                            <span>{isEditing ? 'Save Changes' : 'Edit Details'}</span>
                        </button>
                    </div>

                    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full flex md:flex-row flex-col gap-6 md:gap-8 lg:gap-10">
                        <div className="w-full md:w-1/3 flex flex-col gap-6">
                            <motion.div variants={itemVariants} className="glass-card rounded-[2rem] overflow-hidden flex flex-col relative w-full border border-white">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100 rounded-bl-full -mr-16 -mt-16 opacity-30 pointer-events-none" />

                                <div className="p-8 flex flex-col items-center text-center">
                                    <div className="relative mb-6">
                                        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 shadow-md border-4 border-white flex items-center justify-center overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
                                            onClick={() => {
                                                const url = getStorageUrl(driver.profile_photo_url, 'profile_photos');
                                                if (url) setImageModal({ open: true, url, label: 'Profile Photo' });
                                            }}>
                                            {driver.profile_photo_url ? (
                                                <>
                                                    <img src={getStorageUrl(driver.profile_photo_url, 'profile_photos')} alt={driver.full_name} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Search size={24} className="text-white" />
                                                    </div>
                                                </>
                                            ) : (
                                                <Loader2 size={40} className="text-amber-500 animate-spin" />
                                            )}
                                        </div>
                                        <div className={cn(
                                            "absolute bottom-0 right-2 w-7 h-7 rounded-full border-2 border-white flex items-center justify-center bg-white shadow-sm",
                                            getStatusTheme(driver.status).text
                                        )}>
                                            <StatusIcon size={14} />
                                        </div>
                                    </div>

                                    {isEditing ? (
                                        <input
                                            className="text-2xl font-black text-gray-900 tracking-tight leading-tight text-center bg-white/50 border border-amber-200 rounded-lg px-2 w-full mb-2"
                                            value={editedData.full_name}
                                            onChange={(e) => setEditedData({ ...editedData, full_name: e.target.value })}
                                        />
                                    ) : (
                                        <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">{driver.full_name}</h1>
                                    )}
                                    <p className="text-gray-500 text-sm font-medium mt-1 mb-4">Application ID: #{driver.id.substring(0, 8)}</p>

                                    <span className={cn(
                                        "px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest border",
                                        getStatusTheme(driver.status).bg,
                                        getStatusTheme(driver.status).text,
                                        getStatusTheme(driver.status).border
                                    )}>
                                        {driver.status}
                                    </span>
                                </div>

                                {driver.status === 'pending' && !isEditing && (
                                    <div className="p-4 bg-white/40 border-t border-gray-100/50 flex gap-3">
                                        <button
                                            onClick={() => openConfirmModal('rejected')}
                                            className="flex-1 bg-white hover:bg-red-50 text-red-600 border border-gray-200 hover:border-red-200 font-bold py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                                        >
                                            <X size={18} /> Reject
                                        </button>
                                        <button
                                            onClick={() => openConfirmModal('approved')}
                                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                                        >
                                            <Check size={18} /> Approve
                                        </button>
                                    </div>
                                )}
                            </motion.div>

                            <motion.div variants={itemVariants} className="glass-card rounded-[2rem] p-6 lg:p-8 flex flex-col gap-4 border border-white">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2"><Smartphone size={20} className="text-amber-500" /> Personal Info</h3>
                                <div className="space-y-4 text-sm mt-2">
                                    <DetailRow
                                        icon={<Smartphone size={16} />}
                                        label="Phone"
                                        value={isEditing ? (
                                            <input className="bg-white/50 border border-gray-200 rounded px-2 py-0.5 w-full" value={editedData.phone} onChange={e => setEditedData({ ...editedData, phone: e.target.value })} />
                                        ) : driver.phone}
                                    />
                                    <DetailRow icon={<Mail size={16} />} label="Email" value={driver.email} />
                                    <DetailRow icon={<Calendar size={16} />} label="DoB" value={driver.dob} />
                                    <DetailRow icon={<MapPin size={16} />} label="Location" value={`${driver.address || ''}, ${driver.city || ''}`} />
                                </div>
                            </motion.div>
                        </div>

                        <div className="w-full md:w-2/3 flex flex-col gap-6">
                            <motion.div variants={itemVariants} className="glass-card rounded-[2rem] p-6 lg:p-8 border border-white">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg"><Car size={24} className="text-amber-500" /> Vehicle Information</h3>
                                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                                        {isEditing ? (
                                            <div className="flex gap-2">
                                                <input className="font-semibold text-gray-600 text-sm uppercase bg-gray-50 border rounded px-2 py-1 w-20" value={editedData.vehicle_type} onChange={e => setEditedData({ ...editedData, vehicle_type: e.target.value })} />
                                                <input className="font-black text-gray-900 bg-gray-50 border rounded px-2 py-1 w-32" value={editedData.vehicle_number} onChange={e => setEditedData({ ...editedData, vehicle_number: e.target.value })} />
                                            </div>
                                        ) : (
                                            <>
                                                <span className="font-semibold text-gray-600 text-sm uppercase">{driver.vehicle_type}</span>
                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                                <span className="font-black text-gray-900">{driver.vehicle_number}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {/* Vehicle photos have been removed from onboarding */}
                                </div>
                            </motion.div>

                            <motion.div variants={itemVariants} className="glass-card rounded-[2rem] p-6 lg:p-8 border border-white">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg"><FileCheck size={24} className="text-amber-500" /> Documents & IDs</h3>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {driver?.status === 'pending' && (
                                            <button
                                                onClick={handleAIVerify}
                                                disabled={verifyingDetails}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-md transition-all text-sm shrink-0"
                                                title="Extract Details Automatically Using AI"
                                            >
                                                {verifyingDetails ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="text-yellow-300" />}
                                                Auto Check
                                            </button>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {isEditing ? (
                                                <>
                                                    <input className="text-xs bg-indigo-50 border border-indigo-200 px-2 py-1 rounded font-bold" value={editedData.dl_number || ''} placeholder="DL Number" onChange={e => setEditedData({ ...editedData, dl_number: e.target.value })} />
                                                    <input className="text-xs bg-emerald-50 border border-emerald-200 px-2 py-1 rounded font-bold" value={editedData.aadhaar_pan_number || ''} placeholder="ID Number" onChange={e => setEditedData({ ...editedData, aadhaar_pan_number: e.target.value })} />
                                                </>
                                            ) : (
                                                <>
                                                    {driver.dl_number && <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold uppercase border border-indigo-100">DL: {driver.dl_number}</span>}
                                                    {driver.aadhaar_pan_number && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-bold uppercase border border-emerald-100">ID: {driver.aadhaar_pan_number}</span>}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <PhotoCard label="DL Front" url={getStorageUrl(driver.dl_front_url, 'dl_front')} onOpen={setImageModal} />
                                    <PhotoCard label="DL Back" url={getStorageUrl(driver.dl_back_url, 'dl_back')} onOpen={setImageModal} />
                                    <PhotoCard label="ID Front" url={getStorageUrl(driver.aadhaar_pan_front_url, 'aadhaar_front')} onOpen={setImageModal} />
                                    <PhotoCard label="ID Back" url={getStorageUrl(driver.aadhaar_pan_back_url, 'aadhaar_back')} onOpen={setImageModal} />
                                    <PhotoCard label="Insurance" url={getStorageUrl(driver.insurance_url, 'insurance')} onOpen={setImageModal} />
                                    <PhotoCard label="RC Front" url={getStorageUrl(driver.rc_front_url, 'rc_front')} onOpen={setImageModal} />
                                    <PhotoCard label="RC Back" url={getStorageUrl(driver.rc_back_url, 'rc_back')} onOpen={setImageModal} />
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </main>
            </div>

            <AnimatePresence>
                {imageModal.open && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setImageModal({ open: false, url: '', label: '' })}
                        className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-8"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-w-4xl w-full max-h-[90vh]"
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="font-bold text-gray-900 text-lg">{imageModal.label}</h3>
                                <button onClick={() => setImageModal({ open: false, url: '', label: '' })} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"><X size={24} /></button>
                            </div>
                            <div className="p-4 bg-gray-100 flex-1 overflow-auto flex items-center justify-center">
                                <img src={imageModal.url} alt={imageModal.label} className="max-w-full max-h-full object-contain rounded-xl shadow-sm border border-gray-200" />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {confirmModal.open && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={closeConfirmModal}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="glass-modal rounded-3xl p-8 max-w-sm w-full relative overflow-hidden">
                            <div className={cn("absolute top-0 left-0 right-0 h-2", confirmModal.action === 'approve' ? "bg-emerald-500" : "bg-red-500")}></div>
                            <div className="flex flex-col items-center text-center mt-2">
                                <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mb-5 border-4", confirmModal.action === 'approve' ? "bg-emerald-50 text-emerald-500 border-emerald-100" : "bg-red-50 text-red-500 border-red-100")}>
                                    {confirmModal.action === 'approve' ? <Check size={32} /> : <X size={32} />}
                                </div>
                                <h2 className="text-2xl font-extrabold text-gray-900 mb-2">{confirmModal.action === 'approve' ? 'Approve Driver?' : 'Reject Driver?'}</h2>
                                <p className="text-gray-500 font-medium mb-8">
                                    {confirmModal.action === 'approve'
                                        ? `Confirm approval for ${driver.full_name}. They will be notified via their app immediately.`
                                        : `Confirm rejection for ${driver.full_name}. They will be asked to re-upload documents.`
                                    }
                                </p>
                                <div className="flex gap-3 w-full">
                                    <button className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors" onClick={closeConfirmModal} disabled={actionLoading}>Cancel</button>
                                    <button
                                        className={cn("flex-1 px-4 py-3 rounded-xl font-bold text-white transition-all shadow-md flex items-center justify-center gap-2", confirmModal.action === 'approve' ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600")}
                                        onClick={updateStatus} disabled={actionLoading}
                                    >
                                        {actionLoading ? <Loader2 size={18} className="animate-spin" /> : (confirmModal.action === 'approve' ? 'Approve' : 'Reject')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

const DetailRow = ({ icon, label, value }) => (
    <div className="flex items-start gap-3">
        <div className="mt-0.5 text-gray-400">{icon}</div>
        <div className="flex flex-col flex-1 pb-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">{label}</span>
            <div className="text-gray-900 font-semibold mt-1 break-words">{value || <span className="text-gray-300 italic text-xs">Not Provided</span>}</div>
        </div>
    </div>
);

const PhotoCard = ({ label, url, onOpen }) => (
    <div
        onClick={() => url && onOpen({ open: true, url, label })}
        className={cn(
            "relative aspect-square rounded-2xl border-2 overflow-hidden flex flex-col group transition-all",
            url ? "border-transparent bg-gray-100 cursor-pointer shadow-sm hover:shadow-md" : "border-dashed border-gray-200 bg-gray-50/50"
        )}
    >
        {url ? (
            <>
                <img src={url} alt={label}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1544221156-614adeef4a0a?auto=format&fit=crop&q=80&w=200'; // Fallback
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-100" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-white/90 backdrop-blur p-2 rounded-full text-gray-900 transform scale-50 group-hover:scale-100 transition-transform"><ZoomIn size={18} /></div>
                </div>
                <div className="absolute bottom-2 left-2 right-2"><span className="text-white text-[10px] font-bold truncate block transition-all group-hover:translate-y-[-2px]">{label}</span></div>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <FileText size={24} className="opacity-50" />
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 text-center text-gray-400">{label}</span>
            </div>
        )}
    </div>
);

export default DriverReview;


