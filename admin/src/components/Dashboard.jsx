import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Loader2, User, ChevronRight } from 'lucide-react';
import Sidebar from './Sidebar';
import './Dashboard.css';

function Dashboard() {
    const [drivers, setDrivers] = useState([]);
    const [stats, setStats] = useState({
        users: 0,
        drivers: 0,
        trips: 0,
        earnings: 0
    });
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([
            fetchPendingDrivers(),
            fetchStats()
        ]);
        setLoading(false);
    };

    const fetchStats = async () => {
        try {
            const [
                { count: userCount },
                { count: driverCount },
                { count: tripCount },
                { data: tripsData }
            ] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
                supabase.from('trips').select('*', { count: 'exact', head: true }),
                supabase.from('trips').select('price_per_seat').eq('status', 'completed')
            ]);

            setStats({
                users: userCount || 0,
                drivers: driverCount || 0,
                trips: tripCount || 0,
                earnings: tripsData?.reduce((acc, trip) => acc + (trip.price_per_seat || 0), 0) || 0
            });
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    };

    const fetchPendingDrivers = async () => {
        const { data, error } = await supabase
            .from('drivers')
            .select('id, full_name, vehicle_type, vehicle_number, created_at')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching drivers:", error);
            if (error.message && (error.message.includes("JWT") || error.code === 'PGRST301')) {
                await supabase.auth.signOut();
            }
        } else {
            setDrivers(data);
        }
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <Loader2 className="loading-spinner" size={40} />
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className="dashboard-content-wrapper">
                <main className="dashboard-main">
                    {/* Stats Section */}
                    <section className="stats-grid">
                        <div className="stat-card">
                            <span className="stat-label">Total Users</span>
                            <span className="stat-value">{stats.users}</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Verified Drivers</span>
                            <span className="stat-value">{stats.drivers}</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Total Trips</span>
                            <span className="stat-value">{stats.trips}</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Total Earnings</span>
                            <span className="stat-value">₹{stats.earnings}</span>
                        </div>
                    </section>

                    <div className="page-title-section">
                        <h1 className="page-title">Pending Approvals</h1>
                        <p className="page-subtitle">{drivers.length} drivers awaiting verification</p>
                    </div>

                    <div className="drivers-list">
                        {drivers.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon"><User size={32} /></div>
                                <h3>No Pending Drivers</h3>
                                <p>All drivers have been verified.</p>
                            </div>
                        ) : (
                            drivers.map(driver => (
                                <div key={driver.id} className="driver-card" onClick={() => navigate(`/driver/${driver.id}`)}>
                                    <div className="driver-avatar"><User size={20} /></div>
                                    <div className="driver-info">
                                        <h3 className="driver-name">{driver.full_name}</h3>
                                        <div className="driver-meta">
                                            <span className="vehicle-type">{driver.vehicle_type}</span>
                                            <span className="vehicle-number">{driver.vehicle_number}</span>
                                        </div>
                                    </div>
                                    <div className="driver-date">
                                        <span className="date-label">Submitted</span>
                                        <span className="date-value">{new Date(driver.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <ChevronRight className="chevron-icon" size={20} />
                                </div>
                            ))
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default Dashboard;
