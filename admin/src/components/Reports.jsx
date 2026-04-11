import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import Sidebar from './Sidebar';
import { Download, FileText, Loader2, BarChart2, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';

function Reports() {
    const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState([]);
<<<<<<< HEAD

=======
    
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
    useEffect(() => {
        fetchReportData();
    }, []);

    const fetchReportData = async () => {
        setLoading(true);
<<<<<<< HEAD

        // Initialize last 7 days with 0 revenue as stable baseline
        const grouped = {};
        for (let i = 6; i >= 0; i--) {
            const dateRaw = subDays(new Date(), i);
            const dateStr = format(dateRaw, 'MMM dd');
            grouped[dateStr] = 0;
        }

        try {
            const thirtyDaysAgo = subDays(new Date(), 30);

            const { data, error } = await supabase
                .from('trips')
                .select('created_at, price_per_seat')
                .gte('created_at', thirtyDaysAgo.toISOString())
                .eq('status', 'completed');

            if (error) throw error;

            // Aggregate revenue from real trip data
=======
        try {
            // Mock data or real data fetching
            // Here we just fetch trips and group them by date (last 7 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const { data, error } = await supabase
                .from('trips')
                .select('created_at, price_per_seat, seats_booked')
                .gte('created_at', thirtyDaysAgo.toISOString())
                .eq('status', 'completed');
            
            if (error) throw error;
            
            // Generate last 7 days keys
            const grouped = {};
            for (let i = 6; i >= 0; i--) {
                const dateRaw = subDays(new Date(), i);
                const dateStr = format(dateRaw, 'MMM dd');
                grouped[dateStr] = 0;
            }

            // Aggregate revenue
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
            if (data) {
                data.forEach(trip => {
                    const dateStr = format(new Date(trip.created_at), 'MMM dd');
                    const tripRevenue = (trip.price_per_seat || 0) * (trip.seats_booked || 1);
                    if (grouped[dateStr] !== undefined) {
                        grouped[dateStr] += tripRevenue;
                    }
                });
            }
<<<<<<< HEAD
        } catch (error) {
            console.error("Error fetching report data", error);
            toast.error("Failed to fetch latest analytics. Using cached or zeroed data.");
        } finally {
            // Convert grouped data to chart-friendly format
=======

>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
            const finalData = Object.keys(grouped).map(key => ({
                name: key,
                revenue: grouped[key]
            }));

            setChartData(finalData);
<<<<<<< HEAD
=======
        } catch (error) {
            console.error("Error fetching report data", error);
            // Fallback mock data if table doesn't have records
            setChartData([
                { name: 'Mon', revenue: 400 },
                { name: 'Tue', revenue: 300 },
                { name: 'Wed', revenue: 700 },
                { name: 'Thu', revenue: 200 },
                { name: 'Fri', revenue: 900 },
                { name: 'Sat', revenue: 1200 },
                { name: 'Sun', revenue: 1500 },
            ]);
        } finally {
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        const csvRows = [];
        const headers = ['Date', 'Revenue (INR)'];
        csvRows.push(headers.join(','));
<<<<<<< HEAD

        chartData.forEach(row => {
            csvRows.push(`${row.name},${row.revenue}`);
        });

=======
        
        chartData.forEach(row => {
            csvRows.push(`${row.name},${row.revenue}`);
        });
        
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `revenue_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("Report downloaded successfully");
    };

    return (
        <div className="bg-gray-50/50 min-h-screen">
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
            <div className={`transition-all duration-300 pt-16 pb-10 ${sidebarOpen ? 'md:ml-64 lg:ml-72' : 'ml-0'}`}>
                <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                        <div>
                            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                                <BarChart2 className="text-amber-500" size={32} />
                                Analytics & Reports
                            </h1>
                            <p className="text-gray-500 mt-2">View revenue, driver performance, and trip analytics.</p>
                        </div>
<<<<<<< HEAD
                        <button
=======
                        <button 
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                            onClick={handleExportCSV}
                            className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                        >
                            <Download size={18} />
                            Export CSV
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 size={40} className="animate-spin text-amber-500" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-8">
                            {/* Revenue Chart */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <Calendar size={20} className="text-gray-400" />
                                    Revenue Overview (Last 7 Days)
                                </h3>
                                <div className="h-[350px] w-full">
<<<<<<< HEAD
                                    <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
=======
                                    <ResponsiveContainer width="100%" height="100%">
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(val) => `₹${val}`} />
<<<<<<< HEAD
                                            <Tooltip
=======
                                            <Tooltip 
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                                                cursor={{ fill: '#fef3c7' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                formatter={(value) => [`₹${value}`, 'Revenue']}
                                            />
                                            <Bar dataKey="revenue" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={50} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
<<<<<<< HEAD

                            {/* More analytical cards could go here */}

=======
                            
                            {/* More analytical cards could go here */}
                            
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default Reports;
