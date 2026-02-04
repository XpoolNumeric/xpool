import React, { useState, useEffect } from 'react';
import { ArrowLeft, Camera, ChevronRight, User, CreditCard, Bell, HelpCircle, Shield, LogOut } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import './Profile.css';

// Sub-components
import EditProfile from './EditProfile';
import PaymentMethods from './PaymentMethods';
import Notifications from './Notifications';
import HelpSupport from './HelpSupport';
import toast from 'react-hot-toast';

const Profile = ({ session, onBack, onLogout }) => {
    const [activeSection, setActiveSection] = useState(null);
    const [userData, setUserData] = useState({
        name: 'Loading...',
        email: '...',
        phone: '',
        totalRides: 0,
        savedAmount: '₹0'
    });

    useEffect(() => {
        const fetchProfile = async () => {
            const user = session?.user;
            if (user) {
                // Fetch profile details
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                // Fetch Driver Info (if applicable)
                const { data: driver } = await supabase
                    .from('drivers')
                    .select('phone, profile_photo_url')
                    .eq('user_id', user.id)
                    .maybeSingle();

                let phone = profile?.phone || driver?.phone || '';
                let avatar = profile?.avatar_url || driver?.profile_photo_url;

                // Fallback for avatar
                if (!avatar) {
                    avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.full_name || 'User'}`;
                }

                // Fetch rides count
                const { count: tripsCount } = await supabase
                    .from('trips')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id);

                const { count: bookingsCount } = await supabase
                    .from('booking_requests')
                    .select('*', { count: 'exact', head: true })
                    .eq('passenger_id', user.id)
                    .eq('status', 'approved');

                const total = (tripsCount || 0) + (bookingsCount || 0);

                setUserData({
                    name: profile?.full_name || 'User',
                    email: user.email,
                    phone: phone,
                    avatar: avatar,
                    totalRides: total,
                    savedAmount: '₹' + (total * 50)
                });
            }
        };

        if (session) {
            fetchProfile();
        }
    }, [session]);

    const menuItems = [
        { id: 'edit', icon: User, label: 'Edit Profile' },
        { id: 'payment', icon: CreditCard, label: 'Payment Methods' },
        { id: 'notifications', icon: Bell, label: 'Notifications' },
        { id: 'help', icon: HelpCircle, label: 'Help & Support' },
        { id: 'privacy', icon: Shield, label: 'Privacy & Security' },
    ];

    const handleMenuClick = (id) => {
        if (id === 'privacy') {
            toast('Privacy settings coming soon!', { icon: '🔒' });
            return;
        }
        setActiveSection(id);
    };

    if (activeSection === 'edit') {
        return <EditProfile
            onBack={() => setActiveSection(null)}
            userData={userData}
            onUpdate={(newData) => setUserData(prev => ({ ...prev, ...newData }))}
        />;
    }
    if (activeSection === 'payment') return <PaymentMethods onBack={() => setActiveSection(null)} />;
    if (activeSection === 'notifications') return <Notifications onBack={() => setActiveSection(null)} />;
    if (activeSection === 'help') return <HelpSupport onBack={() => setActiveSection(null)} />;

    return (
        <div className="profile-container animate-page-in">
            {/* Header */}
            <div className="profile-header">
                <button onClick={onBack} className="profile-back-btn">
                    <ArrowLeft size={24} color="black" />
                </button>

                <div className="profile-avatar-container">
                    <img
                        src={userData.avatar}
                        alt="Profile"
                        className="profile-avatar"
                    />
                </div>

                <h1 className="profile-name">{userData.name}</h1>
                <p className="profile-email">{userData.email}</p>
            </div>

            {/* Stats */}
            <div className="profile-stats">
                <div className="stat-item">
                    <div className="stat-value">{userData.totalRides}</div>
                    <div className="stat-label">Total Rides</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{userData.savedAmount}</div>
                    <div className="stat-label">Saved</div>
                </div>
            </div>

            {/* Menu */}
            <div className="profile-menu">
                <div className="menu-section">
                    {menuItems.map((item, idx) => (
                        <div key={idx} className="menu-item" onClick={() => handleMenuClick(item.id)}>
                            <div className="menu-icon">
                                <item.icon size={20} />
                            </div>
                            <span className="menu-text">{item.label}</span>
                            <ChevronRight size={20} className="menu-arrow" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Logout */}
            <div className="logout-item">
                <button className="logout-btn" onClick={onLogout}>
                    <LogOut size={20} />
                    Log Out
                </button>
            </div>
        </div>
    );
};

export default Profile;

