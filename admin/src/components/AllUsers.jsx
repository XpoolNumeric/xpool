import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, User, Search, MapPin, Mail, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import './AllUsers.css';

function AllUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone_number?.includes(searchTerm)
    );


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
                    <div className="page-header-flex">
                        <div className="page-title-section">
                            <h1 className="page-title">User Management</h1>
                            <p className="page-subtitle">Manage all registered passengers and drivers</p>
                        </div>

                        <div className="search-bar">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Search by name, email or phone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="users-list-grid">
                        {filteredUsers.length === 0 ? (
                            <div className="empty-state">No users found matching your search.</div>
                        ) : (
                            filteredUsers.map(user => (
                                <div key={user.id} className="user-profile-card">
                                    <div className="user-profile-header">
                                        <div className="user-avatar-large">
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} alt="" />
                                            ) : (
                                                <User size={32} />
                                            )}
                                        </div>
                                        <div className="user-main-info">
                                            <h3>{user.full_name || 'Anonymous User'}</h3>
                                            <span className="user-role-badge">Passenger</span>
                                        </div>
                                    </div>

                                    <div className="user-contact-details">
                                        <div className="contact-item">
                                            <Mail size={14} />
                                            <span>{user.email || 'No email provided'}</span>
                                        </div>
                                        <div className="contact-item">
                                            <Phone size={14} />
                                            <span>{user.phone_number || 'No phone provided'}</span>
                                        </div>
                                        <div className="contact-item">
                                            <MapPin size={14} />
                                            <span>Member since {new Date(user.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <div className="user-card-actions">
                                        <button className="view-details-btn">View Full Activity</button>
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

export default AllUsers;
