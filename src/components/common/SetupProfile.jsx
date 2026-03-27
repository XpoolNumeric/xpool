import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './Signup.css';

const SetupProfile = ({ onComplete }) => {
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = fullName.trim();
        if (!trimmed) {
            toast.error('Please enter your full name');
            return;
        }

        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) throw new Error('No active session.');

            // Upsert profile
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: session.user.id,
                    full_name: trimmed,
                    user_role: localStorage.getItem('userRole') || 'passenger',
                    last_screen: 'welcome'
                });

            if (error) throw error;

            toast.success('Personal Information saved!');
            await onComplete();
        } catch (error) {
            console.error('[SetupProfile Error]', error);
            toast.error(error.message || 'Failed to save profile information.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signup-container">
            <div className="signup-header">
                <h1 className="signup-title-main">XPOOL</h1>
            </div>

            <div className="signup-form-container" style={{ marginTop: '40px' }}>
                <h2 className="form-title" style={{ textAlign: 'left' }}>
                    Personal Information
                </h2>
                <p style={{ color: '#888', fontSize: '14px', marginTop: '8px', marginBottom: '20px' }}>
                    Please tell us your name to continue.
                </p>

                <form className="signup-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <div className="input-icon">☃</div>
                        <input
                            type="text"
                            placeholder="Full Name"
                            className="signup-input"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="signup-btn" disabled={loading} style={{ marginTop: 'auto', marginBottom: '20px' }}>
                        {loading ? 'Saving...' : 'Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SetupProfile;
