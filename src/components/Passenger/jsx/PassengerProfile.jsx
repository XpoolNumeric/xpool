import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Mail, Phone, Camera, Edit2, Save, X, Calendar, Star, Wallet, Clock, MapPin, Shield, Award } from 'lucide-react';
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
    const [extraInfo, setExtraInfo] = useState({
        memberSince: null,
        avgRating: null,
        reviewCount: 0,
        totalSpent: 0,
        favouriteRoute: null,
        avatarUrl: null,
    });

    useEffect(() => {
        fetchProfile();
        fetchStats();
        fetchExtraInfo();
    }, []);

    const fetchProfile = async () => {
        try {
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
                .maybeSingle();

            if (error) throw error;

            setProfile(data);
            setFormData({
                full_name: data?.full_name || '',
                email: user.email || '',
                phone: data?.phone || '',
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

    const fetchExtraInfo = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch in parallel: profile meta, reviews, payments, bookings for route
            const [profileRes, reviewsRes, bookingsRes] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('created_at, avatar_url')
                    .eq('id', user.id)
                    .maybeSingle(),
                supabase
                    .from('reviews')
                    .select('rating')
                    .eq('target_id', user.id),
                supabase
                    .from('booking_requests')
                    .select('seats_requested, status, trips(from_location, to_location, price_per_seat, status)')
                    .eq('passenger_id', user.id)
                    .in('status', ['approved']),
            ]);

            const info = {
                memberSince: profileRes.data?.created_at || null,
                avatarUrl: profileRes.data?.avatar_url || null,
                avgRating: null,
                reviewCount: 0,
                totalSpent: 0,
                favouriteRoute: null,
            };

            // Calculate average rating
            if (reviewsRes.data && reviewsRes.data.length > 0) {
                const sum = reviewsRes.data.reduce((acc, r) => acc + r.rating, 0);
                info.avgRating = (sum / reviewsRes.data.length).toFixed(1);
                info.reviewCount = reviewsRes.data.length;
            }

            // Calculate total spent and favourite route
            if (bookingsRes.data && bookingsRes.data.length > 0) {
                let totalSpent = 0;
                const routeCount = {};

                bookingsRes.data.forEach(b => {
                    if (b.trips && b.trips.price_per_seat && b.trips.status === 'completed') {
                        totalSpent += b.trips.price_per_seat * (b.seats_requested || 1);
                    }
                    if (b.trips?.from_location && b.trips?.to_location) {
                        const route = `${b.trips.from_location} → ${b.trips.to_location}`;
                        routeCount[route] = (routeCount[route] || 0) + 1;
                    }
                });

                info.totalSpent = totalSpent;

                // Find most frequent route
                let maxCount = 0;
                Object.entries(routeCount).forEach(([route, count]) => {
                    if (count > maxCount) {
                        maxCount = count;
                        info.favouriteRoute = route;
                    }
                });
            }

            setExtraInfo(info);
        } catch (error) {
            console.error('Error fetching extra info:', error);
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

    const formatMemberSince = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    };

    const avatarSrc = extraInfo.avatarUrl ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.full_name || 'Passenger'}`;

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
                <div className="profile-scroll-content">
                    {/* Profile Picture Section */}
                    <div className="profile-picture-section">
                        <div className="profile-picture">
                            <img src={avatarSrc} alt="Profile" className="profile-avatar-img" />
                            <button className="change-picture-btn">
                                <Camera size={16} />
                            </button>
                        </div>
                        <h2>{formData.full_name || 'Passenger'}</h2>
                        <span className="user-role">Passenger</span>
                        {extraInfo.memberSince && (
                            <div className="member-since">
                                <Calendar size={14} />
                                <span>Member since {formatMemberSince(extraInfo.memberSince)}</span>
                            </div>
                        )}
                    </div>

                    {/* Stats Cards */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon">
                                <MapPin size={20} />
                            </div>
                            <div className="stat-value">{stats.totalRides}</div>
                            <div className="stat-label">Total Rides</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon upcoming">
                                <Clock size={20} />
                            </div>
                            <div className="stat-value">{stats.upcomingRides}</div>
                            <div className="stat-label">Upcoming</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon completed">
                                <Award size={20} />
                            </div>
                            <div className="stat-value">{stats.completedRides}</div>
                            <div className="stat-label">Completed</div>
                        </div>
                    </div>

                    {/* Rating & Spending Summary */}
                    <div className="summary-cards">
                        <div className="summary-card rating-card">
                            <div className="summary-icon-wrap">
                                <Star size={20} fill="#EAB308" color="#EAB308" />
                            </div>
                            <div className="summary-content">
                                <div className="summary-value">
                                    {extraInfo.avgRating || 'New'}
                                </div>
                                <div className="summary-label">
                                    {extraInfo.reviewCount > 0
                                        ? `${extraInfo.reviewCount} review${extraInfo.reviewCount > 1 ? 's' : ''}`
                                        : 'No reviews yet'}
                                </div>
                            </div>
                        </div>
                        <div className="summary-card spending-card">
                            <div className="summary-icon-wrap spending">
                                <Wallet size={20} />
                            </div>
                            <div className="summary-content">
                                <div className="summary-value">
                                    ₹{extraInfo.totalSpent.toLocaleString('en-IN')}
                                </div>
                                <div className="summary-label">Total Spent</div>
                            </div>
                        </div>
                    </div>

                    {/* Favourite Route */}
                    {extraInfo.favouriteRoute && (
                        <div className="favourite-route-section">
                            <h3>
                                <MapPin size={16} />
                                Frequent Route
                            </h3>
                            <div className="route-display">
                                {extraInfo.favouriteRoute}
                            </div>
                        </div>
                    )}

                    {/* Profile Information */}
                    <div className="profile-info-section">
                        <h3>
                            <Shield size={16} />
                            Personal Information
                        </h3>

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
                </div>
            )}
        </div >
    );
};

export default PassengerProfile;
