import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import Sidebar from './Sidebar';
import { motion } from 'framer-motion';
import { Save, Loader2, Map as MapIcon, DollarSign, Settings as SettingsIcon } from 'lucide-react';
import toast from 'react-hot-toast';

function Settings() {
    const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({
        price_per_km: 15,
        surge_pricing: false,
        surge_multiplier: 1.5,
        base_fare: 50
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        // Fetch from a settings table if it exists, otherwise use defaults
        // As a mock, let's try fetching, if table not found, fallback to defaults
        try {
            const { data, error } = await supabase.from('settings').select('*').single();
            if (data && !error) {
                setSettings({
                    price_per_km: data.price_per_km || 15,
                    surge_pricing: data.surge_pricing || false,
                    surge_multiplier: data.surge_multiplier || 1.5,
                    base_fare: data.base_fare || 50
                });
            }
        } catch (e) {
            console.warn("Settings table might not exist yet, using defaults.");
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Upsert settings. Since it's a mock or we assume a single row with id 1
            const { error } = await supabase.from('settings').upsert({ id: 1, ...settings });
            if (error) {
                toast.error("Failed to save settings: " + error.message);
                // Create table if not exists? Supabase doesn't allow DDL from client usually.
            } else {
                toast.success("Settings saved successfully!");
            }
        } catch (e) {
            toast.error("Error saving settings");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-50/50 min-h-screen">
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
            <div className={`transition-all duration-300 pt-16 pb-10 ${sidebarOpen ? 'md:ml-64 lg:ml-72' : 'ml-0'}`}>
                <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">
                    <div className="mb-8">
                        <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                            <SettingsIcon className="text-amber-500" size={32} />
                            Platform Settings
                        </h1>
                        <p className="text-gray-500 mt-2">Manage pricing, surge rates, and global config.</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                        <div className="space-y-6">
                            {/* Pricing Section */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                    <DollarSign size={20} className="text-amber-500" />
                                    Pricing Configuration
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Base Fare (₹)</label>
                                        <input 
                                            type="number" 
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" 
                                            value={settings.base_fare}
                                            onChange={(e) => setSettings({...settings, base_fare: Number(e.target.value)})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Price Per Km (₹)</label>
                                        <input 
                                            type="number" 
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" 
                                            value={settings.price_per_km}
                                            onChange={(e) => setSettings({...settings, price_per_km: Number(e.target.value)})}
                                        />
                                    </div>
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {/* Surge Section */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                    <DollarSign size={20} className="text-red-500" />
                                    Surge Pricing
                                </h3>
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-4">
                                    <div>
                                        <p className="font-semibold text-gray-900">Enable Surge Pricing</p>
                                        <p className="text-sm text-gray-500">Automatically applies the multiplier during high demand.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={settings.surge_pricing} onChange={(e) => setSettings({...settings, surge_pricing: e.target.checked})} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                    </label>
                                </div>
                                {settings.surge_pricing && (
                                    <div className="animate-in fade-in slide-in-from-top-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Surge Multiplier</label>
                                        <input 
                                            type="number" step="0.1" 
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" 
                                            value={settings.surge_multiplier}
                                            onChange={(e) => setSettings({...settings, surge_multiplier: Number(e.target.value)})}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button 
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                                >
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default Settings;
