import React, { useState, useEffect } from 'react';
<<<<<<< HEAD
import { ArrowLeft, User, Mail, Phone, Camera, Edit2, Save, X, Calendar, Star, Wallet, Clock, MapPin, Shield, Award } from 'lucide-react';
=======
import { 
    ArrowLeft, User, Mail, Phone, Camera, Edit2, Save, X, 
    Calendar, Star, Wallet, Clock, MapPin, Shield, Award, 
    ChevronRight, Sparkles, TrendingUp, Route, LogOut, CheckCircle
} from 'lucide-react';
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { getSafeSession } from '../../../utils/webViewHelper';
import { motion, AnimatePresence } from 'framer-motion';
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

<<<<<<< HEAD
            // Fetch in parallel: profile meta, reviews, payments, bookings for route
            const [profileRes, reviewsRes, bookingsRes] = await Promise.all([
=======
            // Fetch in parallel: profile meta, driver photo, reviews, bookings for route
            const [profileRes, driverRes, reviewsRes, bookingsRes] = await Promise.all([
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                supabase
                    .from('profiles')
                    .select('created_at, avatar_url')
                    .eq('id', user.id)
                    .maybeSingle(),
                supabase
<<<<<<< HEAD
=======
                    .from('drivers')
                    .select('profile_photo_url')
                    .eq('user_id', user.id)
                    .maybeSingle(),
                supabase
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
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
<<<<<<< HEAD
                avatarUrl: profileRes.data?.avatar_url || null,
=======
                avatarUrl: profileRes.data?.avatar_url || driverRes.data?.profile_photo_url || null,
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
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
<<<<<<< HEAD
                        const route = `${b.trips.from_location} → ${b.trips.to_location}`;
=======
                        const from = b.trips.from_location.split(',')[0].trim();
                        const to = b.trips.to_location.split(',')[0].trim();
                        const route = `${from} → ${to}`;
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                        routeCount[route] = (routeCount[route] || 0) + 1;
                    }
                });

                info.totalSpent = totalSpent;

<<<<<<< HEAD
                // Find most frequent route
=======
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
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

<<<<<<< HEAD
    const avatarSrc = extraInfo.avatarUrl ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.full_name || 'Passenger'}`;

=======
    // Default avatar using DiceBear if no photo uploaded
    const avatarSrc = extraInfo.avatarUrl ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.full_name || 'Passenger'}`;

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.08, delayChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } }
    };

>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
    return (
        <div className="pp-container">
            {/* Premium Header */}
            <div className="pp-header">
                <div className="pp-header-bg"></div>
                <div className="pp-header-content">
                    <button className="pp-back-btn" onClick={onBack}>
                        <ArrowLeft size={22} strokeWidth={2.5} />
                    </button>
                    <h1 className="pp-header-title">My Profile</h1>
                    {!loading && !editing ? (
                        <button className="pp-edit-btn" onClick={() => setEditing(true)}>
                            <Edit2 size={18} strokeWidth={2.5} />
                        </button>
                    ) : (
                        <div className="pp-header-spacer" />
                    )}
                </div>
            </div>

            {loading ? (
                <div className="pp-loading">
                    <div className="pp-spinner"></div>
                    <p>Loading your profile...</p>
                </div>
            ) : (
<<<<<<< HEAD
                <div className="profile-scroll-content">
                    {/* Profile Picture Section */}
                    <div className="profile-picture-section">
                        <div className="profile-picture">
                            <img src={avatarSrc} alt="Profile" className="profile-avatar-img" />
                            <button className="change-picture-btn">
                                <Camera size={16} />
=======
                <motion.div 
                    className="pp-scroll-content"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {/* Avatar Hero Section */}
                    <motion.div variants={itemVariants} className="pp-hero-section">
                        <div className="pp-avatar-wrapper">
                            <div className="pp-avatar-ring">
                                <img src={avatarSrc} alt="Profile" className="pp-avatar-img" />
                            </div>
                            <button className="pp-camera-btn">
                                <Camera size={14} strokeWidth={2.5} />
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                            </button>
                            {extraInfo.avatarUrl && (
                                <div className="pp-verified-badge">
                                    <CheckCircle size={14} strokeWidth={3} />
                                </div>
                            )}
                        </div>
<<<<<<< HEAD
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
=======
                        <h2 className="pp-user-name">{formData.full_name || 'Passenger'}</h2>
                        <div className="pp-role-badge">
                            <Sparkles size={12} />
                            <span>PASSENGER</span>
                        </div>
                        {extraInfo.memberSince && (
                            <div className="pp-member-since">
                                <Calendar size={13} />
                                <span>Member since {formatMemberSince(extraInfo.memberSince)}</span>
                            </div>
                        )}
                    </motion.div>

                    {/* Stats Row */}
                    <motion.div variants={itemVariants} className="pp-stats-row">
                        <div className="pp-stat-card">
                            <div className="pp-stat-icon pp-stat-icon--rides">
                                <MapPin size={18} strokeWidth={2.5} />
                            </div>
                            <div className="pp-stat-number">{stats.totalRides}</div>
                            <div className="pp-stat-label">Total Rides</div>
                        </div>
                        <div className="pp-stat-card">
                            <div className="pp-stat-icon pp-stat-icon--upcoming">
                                <Clock size={18} strokeWidth={2.5} />
                            </div>
                            <div className="pp-stat-number">{stats.upcomingRides}</div>
                            <div className="pp-stat-label">Upcoming</div>
                        </div>
                        <div className="pp-stat-card">
                            <div className="pp-stat-icon pp-stat-icon--completed">
                                <Award size={18} strokeWidth={2.5} />
                            </div>
                            <div className="pp-stat-number">{stats.completedRides}</div>
                            <div className="pp-stat-label">Completed</div>
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                        </div>
                    </motion.div>

<<<<<<< HEAD
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
=======
                    {/* Rating & Spending */}
                    <motion.div variants={itemVariants} className="pp-summary-row">
                        <div className="pp-summary-card">
                            <div className="pp-summary-icon pp-summary-icon--star">
                                <Star size={20} fill="#f59e0b" color="#f59e0b" />
                            </div>
                            <div className="pp-summary-info">
                                <div className="pp-summary-value">
                                    {extraInfo.avgRating || '5.0'}
                                </div>
                                <div className="pp-summary-label">
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                                    {extraInfo.reviewCount > 0
                                        ? `${extraInfo.reviewCount} review${extraInfo.reviewCount > 1 ? 's' : ''}`
                                        : 'No reviews yet'}
                                </div>
                            </div>
                        </div>
<<<<<<< HEAD
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
=======
                        <div className="pp-summary-card">
                            <div className="pp-summary-icon pp-summary-icon--wallet">
                                <Wallet size={20} />
                            </div>
                            <div className="pp-summary-info">
                                <div className="pp-summary-value">
                                    ₹{extraInfo.totalSpent.toLocaleString('en-IN')}
                                </div>
                                <div className="pp-summary-label">Total Spent</div>
                            </div>
                        </div>
                    </motion.div>
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)

                    {/* Favourite Route */}
                    {extraInfo.favouriteRoute && (
                        <motion.div variants={itemVariants} className="pp-frequent-route">
                            <div className="pp-section-header">
                                <Route size={16} strokeWidth={2.5} />
                                <span>Frequent Route</span>
                            </div>
                            <div className="pp-route-pill">
                                <div className="pp-route-dot pp-route-dot--from"></div>
                                <span>{extraInfo.favouriteRoute}</span>
                                <div className="pp-route-dot pp-route-dot--to"></div>
                            </div>
                        </motion.div>
                    )}

                    {/* Personal Information */}
                    <motion.div variants={itemVariants} className="pp-info-card">
                        <div className="pp-section-header">
                            <Shield size={16} strokeWidth={2.5} />
                            <span>Personal Information</span>
                        </div>

                        <div className="pp-info-field">
                            <div className="pp-info-label">
                                <User size={16} strokeWidth={2.5} />
                                <span>Full Name</span>
                            </div>
                            {editing ? (
                                <input
                                    type="text"
                                    className="pp-info-input"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="Enter your full name"
                                />
                            ) : (
                                <div className="pp-info-value">{formData.full_name || 'Not set'}</div>
                            )}
                        </div>

                        <div className="pp-info-field">
                            <div className="pp-info-label">
                                <Mail size={16} strokeWidth={2.5} />
                                <span>Email</span>
                            </div>
                            <div className="pp-info-value pp-info-value--disabled">
                                {formData.email}
                            </div>
                            <span className="pp-field-note">Email cannot be changed</span>
                        </div>

                        <div className="pp-info-field">
                            <div className="pp-info-label">
                                <Phone size={16} strokeWidth={2.5} />
                                <span>Phone Number</span>
                            </div>
                            {editing ? (
                                <input
                                    type="tel"
                                    className="pp-info-input"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="Enter your phone number"
                                />
                            ) : (
                                <div className="pp-info-value">{formData.phone || 'Not set'}</div>
                            )}
                        </div>
                    </motion.div>

                    {/* Action Buttons */}
<<<<<<< HEAD
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
=======
                    <motion.div variants={itemVariants}>
                        <AnimatePresence mode="wait">
                            {editing ? (
                                <motion.div 
                                    key="editing"
                                    className="pp-actions"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    <button className="pp-btn pp-btn--cancel" onClick={handleCancel}>
                                        <X size={18} strokeWidth={2.5} />
                                        Cancel
                                    </button>
                                    <button className="pp-btn pp-btn--save" onClick={handleSave}>
                                        <Save size={18} strokeWidth={2.5} />
                                        Save Changes
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div 
                                    key="default"
                                    className="pp-actions"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    <button className="pp-btn pp-btn--logout" onClick={onLogout}>
                                        <LogOut size={18} strokeWidth={2.5} />
                                        Logout
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </motion.div>
            )}
        </div>
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
    );
};

export default PassengerProfile;
