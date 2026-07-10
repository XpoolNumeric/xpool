import React, { useState } from 'react';
import { Bell, Send, Users, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import PageLayout from './shared/PageLayout';

const PushNotifications = () => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState('info'); // info, success, alert
    const [target, setTarget] = useState('all'); // all, drivers, passengers
    const [isSending, setIsSending] = useState(false);

    const handleSend = async (e) => {
        e.preventDefault();
        
        if (!title.trim() || !message.trim()) {
            toast.error('Please enter both title and message');
            return;
        }

        setIsSending(true);
        const loadingToast = toast.loading('Broadcasting notification...');

        try {
            // First we need to get all users or target users
            // Since we might not have the RPC set up yet by the user, we will query users and insert locally as a fallback
            let query = supabase.from('profiles').select('id, user_role');
            if (target === 'drivers') {
                query = query.eq('user_role', 'driver');
            } else if (target === 'passengers') {
                query = query.eq('user_role', 'passenger');
            }

            const { data: users, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            if (!users || users.length === 0) {
                toast.error('No users found for the selected target');
                setIsSending(false);
                toast.dismiss(loadingToast);
                return;
            }

            // Prepare notification payloads for bulk insert
            const notifications = users.map(user => ({
                user_id: user.id,
                title: title,
                message: message,
                type: type,
                read: false,        // Ensure read is set false
                created_at: new Date().toISOString()
            }));

            // Using batch insert instead of looping for better performance
            const { error: insertError } = await supabase
                .from('notifications')
                .insert(notifications);

            if (insertError) throw insertError;

            toast.success(`Successfully sent to ${users.length} users!`, { id: loadingToast });
            
            // Clear form
            setTitle('');
            setMessage('');
            setType('info');

        } catch (error) {
            console.error('Error sending push notification:', error);
            toast.error('Failed to send notification: ' + error.message, { id: loadingToast });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <PageLayout color="amber">
            <div className="flex flex-col h-full bg-transparent">
                <div className="max-w-4xl w-full mx-auto">
                    
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                            <div className="p-2.5 bg-amber-100 rounded-xl">
                                <Bell className="w-7 h-7 text-amber-600" />
                            </div>
                            Push Notifications
                        </h1>
                        <p className="text-gray-500 mt-2 font-medium">
                            Broadcast real-time messages and native system notifications to your app users.
                        </p>
                    </div>

                    {/* Main Card */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
                        <div className="p-6 md:p-8">
                            <form onSubmit={handleSend} className="space-y-6">
                                
                                {/* Target Selection */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-900 mb-3">Target Audience</label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setTarget('all')}
                                            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 transition-all ${
                                                target === 'all' 
                                                    ? 'border-amber-500 bg-amber-50 text-amber-700' 
                                                    : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            <Users size={18} />
                                            <span className="font-bold text-sm">Everyone</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTarget('drivers')}
                                            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 transition-all ${
                                                target === 'drivers' 
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                                                    : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="w-4 h-4 rounded border-2 border-current rounded-full" />
                                            <span className="font-bold text-sm">Drivers Only</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTarget('passengers')}
                                            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 transition-all ${
                                                target === 'passengers' 
                                                    ? 'border-purple-500 bg-purple-50 text-purple-700' 
                                                    : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="w-4 h-4 rounded bg-current rounded-full hidden" />
                                            <span className="font-bold text-sm">Passengers Only</span>
                                        </button>
                                    </div>
                                </div>

                                <hr className="border-gray-100" />

                                {/* Notification Content */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-900 mb-1.5">Notification Title</label>
                                        <input 
                                            type="text" 
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="e.g., Weekend Promo! 🎉"
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 p-3.5 transition-all font-medium placeholder-gray-400"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-900 mb-1.5">Message Body</label>
                                        <textarea 
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Type your notification message here..."
                                            rows={4}
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 p-3.5 transition-all font-medium placeholder-gray-400 resize-none"
                                        />
                                    </div>
                                </div>

                                {/* Options */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-900 mb-3">Notification Style</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" checked={type === 'info'} onChange={() => setType('info')} className="w-4 h-4 text-amber-500 focus:ring-amber-500" />
                                            <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Info size={16} className="text-blue-500"/> Info</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" checked={type === 'success'} onChange={() => setType('success')} className="w-4 h-4 text-amber-500 focus:ring-amber-500" />
                                            <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500"/> Success</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" checked={type === 'alert'} onChange={() => setType('alert')} className="w-4 h-4 text-amber-500 focus:ring-amber-500" />
                                            <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><AlertCircle size={16} className="text-red-500"/> Alert</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Submit */}
                                <div className="pt-4 flex justify-end">
                                    <button 
                                        type="submit"
                                        disabled={isSending || !title.trim() || !message.trim()}
                                        className="bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3.5 px-8 rounded-xl transition-all flex items-center gap-2"
                                    >
                                        <Send size={18} className={isSending ? "animate-pulse" : ""} />
                                        {isSending ? 'Sending...' : 'Dispatch Notification'}
                                    </button>
                                </div>

                            </form>
                        </div>
                    </div>

                </div>
            </div>
        </PageLayout>
    );
};

export default PushNotifications;
