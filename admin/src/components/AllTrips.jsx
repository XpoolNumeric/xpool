import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, MapPin, Calendar, Clock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import './AllTrips.css';

function AllTrips() {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, active, completed, cancelled
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchTrips();
    }, [filter]);

    const fetchTrips = async () => {
        setLoading(true);
        try {
            let query = supabase.from('trips').select(`
                *,
                profiles:user_id (full_name)
            `);

            if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query.order('travel_date', { ascending: false });

            if (error) throw error;
            setTrips(data);
        } catch (error) {
            console.error("Error fetching trips:", error);
        } finally {
            setLoading(false);
        }
    };


    if (loading && trips.length === 0) {
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
                    <div className="page-header-flex">
                        <div className="page-title-section">
                            <h1 className="page-title">Trip Overview</h1>
                            <p className="page-subtitle">Monitoring all system activity</p>
                        </div>

                        <div className="filter-chips">
                            {['all', 'active', 'completed', 'cancelled'].map(status => (
                                <button
                                    key={status}
                                    className={`filter-chip ${filter === status ? 'active' : ''}`}
                                    onClick={() => setFilter(status)}
                                >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="trips-grid">
                        {trips.length === 0 ? (
                            <div className="empty-state">No trips found for this filter.</div>
                        ) : (
                            trips.map(trip => (
                                <div key={trip.id} className="trip-admin-card">
                                    <div className="trip-status-header">
                                        <span className={`status-badge ${trip.status}`}>{trip.status}</span>
                                        <span className="trip-id">ID: {trip.id.substring(0, 8)}</span>
                                    </div>

                                    <div className="trip-route-section">
                                        <div className="route-loc">
                                            <div className="loc-dot from"></div>
                                            <span>{trip.from_location}</span>
                                        </div>
                                        <div className="route-line-v"></div>
                                        <div className="route-loc">
                                            <div className="loc-dot to"></div>
                                            <span>{trip.to_location}</span>
                                        </div>
                                    </div>

                                    <div className="trip-details-grid">
                                        <div className="t-detail">
                                            <Calendar size={14} />
                                            <span>{new Date(trip.travel_date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="t-detail">
                                            <Clock size={14} />
                                            <span>{trip.travel_time}</span>
                                        </div>
                                        <div className="t-detail">
                                            <User size={14} />
                                            <span>Driver: {trip.profiles?.full_name || 'System'}</span>
                                        </div>
                                        <div className="t-detail earnings">
                                            <span>₹{trip.price_per_seat}/seat</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </main>
            </div>

        </div>
    );
}

export default AllTrips;
