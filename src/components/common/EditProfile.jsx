import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, Camera } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './EditProfile.css';

const EditProfile = ({ onBack, userData, onUpdate }) => {
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (userData) {
            setFormData({
                full_name: userData.name || '',
                email: userData.email || '',
                phone: userData.phone || ''
            });
        }
    }, [userData]);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            const updates = {
                id: user.id,
                full_name: formData.full_name,
                updated_at: new Date(),
            };

            const { error } = await supabase
                .from('profiles')
                .upsert(updates);

            if (error) throw error;

            toast.success('Profile updated successfully!');
            if (onUpdate) onUpdate({ ...userData, name: formData.full_name }); // Optimistic update
            onBack();

        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="edit-profile-container">
            <div className="sub-page-header">
                <button onClick={onBack} className="back-btn">
                    <ArrowLeft size={24} />
                </button>
                <h2>Edit Profile</h2>
            </div>

            <form onSubmit={handleSubmit} className="edit-form">
                <div className="edit-avatar-section">
                    <div className="avatar-wrapper">
                        <img
                            src={userData.avatar}
                            alt="Avatar"
                            className="current-avatar"
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Full Name</label>
                    <input
                        type="text"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Email ID</label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        disabled
                        className="opacity-60 cursor-not-allowed"
                    />
                </div>

                <div className="form-group">
                    <label>Phone Number</label>
                    <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        disabled
                        className="opacity-60 cursor-not-allowed"
                        placeholder="No phone number"
                    />
                </div>

                <button type="submit" className="save-btn" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    <span>Save Changes</span>
                </button>
            </form>
        </div>
    );
};

export default EditProfile;

