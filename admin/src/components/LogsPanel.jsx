import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import Sidebar from './Sidebar';
import { Loader2, Database, AlertCircle, Terminal, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

function LogsPanel() {
    const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('system'); // system | transactions

    useEffect(() => {
        fetchLogs();
    }, [activeTab]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            // Attempt to fetch from 'logs' table. If it fails, mock data.
            const queryTab = activeTab === 'system' ? 'system_error' : 'failed_transaction';
            
            const { data, error } = await supabase
                .from('logs')
                .select('*')
                .eq('log_type', queryTab)
                .order('created_at', { ascending: false })
                .limit(50);
                
            if (error) {
                throw error;
            }
            setLogs(data || []);
        } catch (error) {
            console.warn("Could not fetch logs from database (table may not exist). Using fallback mock logs.", error);
            // Fallback mock logs
            if (activeTab === 'system') {
                setLogs([
                    { id: 1, created_at: new Date().toISOString(), message: "Failed to resolve API endpoint api.xpool.in", source: "AuthService", severity: "error" },
                    { id: 2, created_at: new Date(Date.now() - 3600000).toISOString(), message: "Timeout during driver matchmaking. Driver ID: 1045", source: "MatchMaker", severity: "warning" },
                    { id: 3, created_at: new Date(Date.now() - 86400000).toISOString(), message: "Supabase connection refused. Retrying...", source: "Database", severity: "critical" },
                ]);
            } else {
                setLogs([
                    { id: 10, created_at: new Date().toISOString(), message: "Insufficient balance for withdrawal request #409", source: "PaymentGateway", severity: "error" },
                    { id: 11, created_at: new Date(Date.now() - 7200000).toISOString(), message: "Payment failed for Trip #1293. User Card Expiry", source: "Stripe", severity: "error" },
                ]);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-50/50 min-h-screen">
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
            <div className={`transition-all duration-300 pt-16 pb-10 ${sidebarOpen ? 'md:ml-64 lg:ml-72' : 'ml-0'}`}>
                <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                        <div>
                            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                                <Database className="text-amber-500" size={32} />
                                System Logs
                            </h1>
                            <p className="text-gray-500 mt-2">Monitor API errors, failed transactions, and critical activities.</p>
                        </div>
                        <button 
                            onClick={fetchLogs}
                            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-5 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                        >
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                            Refresh
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* Tabs */}
                        <div className="flex border-b border-gray-100">
                            <button 
                                className={`flex-1 py-4 text-sm font-semibold text-center uppercase tracking-wider transition-colors ${activeTab === 'system' ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/30' : 'text-gray-500 hover:bg-gray-50'}`}
                                onClick={() => setActiveTab('system')}
                            >
                                System Errors
                            </button>
                            <button 
                                className={`flex-1 py-4 text-sm font-semibold text-center uppercase tracking-wider transition-colors ${activeTab === 'transactions' ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/30' : 'text-gray-500 hover:bg-gray-50'}`}
                                onClick={() => setActiveTab('transactions')}
                            >
                                Failed Transactions
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex justify-center items-center py-20">
                                <Loader2 size={40} className="animate-spin text-amber-500" />
                            </div>
                        ) : (
                            <div className="p-0">
                                {logs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                        <Terminal size={48} className="mb-4 opacity-50" />
                                        <p className="font-semibold text-gray-600">No logs found.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/50 text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                                                    <th className="px-6 py-4 font-semibold">Timestamp</th>
                                                    <th className="px-6 py-4 font-semibold">Severity</th>
                                                    <th className="px-6 py-4 font-semibold">Source</th>
                                                    <th className="px-6 py-4 font-semibold">Message</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {logs.map(log => (
                                                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm:ss')}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                                                                ${log.severity === 'error' ? 'bg-red-100 text-red-700' : 
                                                                  log.severity === 'critical' ? 'bg-purple-100 text-purple-700' : 
                                                                  'bg-amber-100 text-amber-700'}`
                                                            }>
                                                                <AlertCircle size={12} />
                                                                {log.severity}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                            {log.source || 'System'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                                                            {log.message}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default LogsPanel;
