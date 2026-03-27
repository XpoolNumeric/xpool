import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Mail, Phone, Camera, Edit2, Save, X } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { getSafeSession } from '../../../utils/webViewHelper';
import '../css/PassengerProfile.css';

const PassengerProfile = ({ onBack, onLogout }) => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
    });
    const [stats, setStats] = useState({
        totalRides: 0,
        upcomingRides: 0,
        completedRides: 0,
    });

    useEffect(() => {
        fetchProfile();
        fetchStats();
    }, []);

    const fetchProfile = async () => {
        try {
            // Use getSafeSession to prevent infinite loading if auth check hangs
            const { data: sessionData, error: sessionError } = await getSafeSession(supabase, 4000);

            if (sessionError || !sessionData?.session) {
                console.log('No user session found in profile');
                setLoading(false);
                return;
            }

            const user = sessionData.session.user;

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .eq('id', user.id)
                .maybeSingle();

            if (error) throw error;

            setProfile(data);
            setFormData({
                full_name: data.full_name || '',
                email: user.email || '',
                phone: data.phone || '',
            });
        } catch (error) {
            console.error('Error fetching profile:', error);
            toast.error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get all bookings
            const { data: bookings } = await supabase
                .from('booking_requests')
                .select('status, trips(travel_date, status)')
                .eq('passenger_id', user.id);

            if (bookings) {
                const total = bookings.length;
                const upcoming = bookings.filter(b =>
                    b.status === 'approved' &&
                    b.trips &&
                    new Date(b.trips.travel_date) >= new Date()
                ).length;
                const completed = bookings.filter(b =>
                    b.trips &&
                    b.trips.status === 'completed'
                ).length;

                setStats({
                    totalRides: total,
                    upcomingRides: upcoming,
                    completedRides: completed,
                });
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleSave = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.full_name,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (error) throw error;

            toast.success('Profile updated successfully');
            setEditing(false);
            fetchProfile();
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Failed to update profile');
        }
    };

    const handleCancel = () => {
        setFormData({
            full_name: profile?.full_name || '',
            email: profile?.email || '',
            phone: profile?.phone || '',
        });
        setEditing(false);
    };

    return (
        <div className="passenger-profile-container">
            {/* Header */}
            <div className="profile-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1>My Profile</h1>
                {!loading && !editing ? (
                    <button className="edit-btn" onClick={() => setEditing(true)}>
                        <Edit2 size={20} />
                    </button>
                ) : (
                    <div className="header-spacer" />
                )}
            </div>

            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading profile...</p>
                </div>
            ) : (
                <>
                    {/* Profile Picture Section */}
                    <div className="profile-picture-section">
                        <div className="profile-picture">
                            <User size={48} />
                            <button className="change-picture-btn">
                                <Camera size={16} />
                            </button>
                        </div>
                        <h2>{formData.full_name || 'Passenger'}</h2>
                        <span className="user-role">Passenger</span>
                    </div>

                    {/* Stats Cards */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-value">{stats.totalRides}</div>
                            <div className="stat-label">Total Rides</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.upcomingRides}</div>
                            <div className="stat-label">Upcoming</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.completedRides}</div>
                            <div className="stat-label">Completed</div>
                        </div>
                    </div>

                    {/* Profile Information */}
                    <div className="profile-info-section">
                        <h3>Personal Information</h3>

                        <div className="info-field">
                            <label>
                                <User size={18} />
                                Full Name
                            </label>
                            {editing ? (
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="Enter your full name"
                                />
                            ) : (
                                <div className="info-value">{formData.full_name || 'Not set'}</div>
                            )}
                        </div>

                        <div className="info-field">
                            <label>
                                <Mail size={18} />
                                Email
                            </label>
                            <div className="info-value disabled">{formData.email}</div>
                            <span className="field-note">Email cannot be changed</span>
                        </div>

                        <div className="info-field">
                            <label>
                                <Phone size={18} />
                                Phone Number
                            </label>
                            {editing ? (
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="Enter your phone number"
                                />
                            ) : (
                                <div className="info-value">{formData.phone || 'Not set'}</div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {editing ? (
                        <div className="action-buttons">
                            <button className="btn-secondary" onClick={handleCancel}>
                                <X size={18} />
                                Cancel
                            </button>
                            <button className="btn-primary" onClick={handleSave}>
                                <Save size={18} />
                                Save Changes
                            </button>
                        </div>
                    ) : (
                        <div className="action-buttons">
                            <button className="btn-logout" onClick={onLogout}>
                                Logout
                            </button>
                        </div>
                    )}
                </>
            )
            }
        </div >
    );
};

export default PassengerProfile;
