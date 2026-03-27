import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, CheckCircle, Smartphone } from 'lucide-react';
import '../css/OTPVerification.css';

const OTPVerificationScreen = ({ trip, onVerified, onBack }) => {
    const [passengers, setPassengers] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [otp, setOtp] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch passengers and generate OTPs on mount
        const init = async () => {
            try {
                // 1. Fetch approved passengers
                const { data: bookings, error } = await supabase
                    .from('booking_requests')
                    .select(`
                        id,
                        passenger_id,
                        otp_code,
                        otp_verified
                    `)
                    .eq('trip_id', trip.id)
                    .eq('status', 'approved')
                    .order('created_at');

                if (error) throw error;

                if (!bookings || bookings.length === 0) {
                    toast.error('No approved passengers found for this trip');
                    onBack();
                    return;
                }

                // Fetch passenger profiles separately to avoid PGRST200 foreign key error
                const passengerIds = bookings.map(b => b.passenger_id);
                if (passengerIds.length > 0) {
                    const { data: profiles, error: profileError } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .in('id', passengerIds);

                    if (!profileError && profiles) {
                        const profileMap = {};
                        profiles.forEach(p => profileMap[p.id] = p);
                        bookings.forEach(b => {
                            b.profiles = profileMap[b.passenger_id] || { full_name: 'Passenger' };
                        });
                    }
                }

                const { data: { session } } = await supabase.auth.getSession();

                // Only generate OTPs if some passengers are unverified AND don't have OTPs yet
                const needsOtp = bookings.some(b => !b.otp_verified && !b.otp_code);
                const allVerified = bookings.every(b => b.otp_verified);

                if (!allVerified && needsOtp) {
                    const { error: genError } = await supabase.functions.invoke('generate-ride-otp', {
                        body: { trip_id: trip.id },
                        headers: {
                            Authorization: `Bearer ${session?.access_token}`
                        }
                    });

                    if (genError) {
                        console.error('Error generating OTPs:', genError);
                    }

                    // Re-fetch bookings after OTP generation to get the new otp_code values
                    const { data: refreshedBookings } = await supabase
                        .from('booking_requests')
                        .select('id, passenger_id, otp_code, otp_verified')
                        .eq('trip_id', trip.id)
                        .eq('status', 'approved')
                        .order('created_at');

                    if (refreshedBookings) {
                        // Re-attach profiles
                        refreshedBookings.forEach(b => {
                            const original = bookings.find(ob => ob.id === b.id);
                            b.profiles = original?.profiles || { full_name: 'Passenger' };
                        });
                        setPassengers(refreshedBookings);
                    } else {
                        setPassengers(bookings);
                    }
                } else {
                    setPassengers(bookings);
                }

                // Find first unverified passenger
                const firstUnverified = bookings.findIndex(b => !b.otp_verified);
                if (firstUnverified !== -1) {
                    setCurrentIndex(firstUnverified);
                } else {
                    // All verified
                    toast.success('All passengers already verified!');
                    onVerified();
                }
            } catch (err) {
                console.error('Init error:', err);
                toast.error('Failed to load passengers');
                onBack();
            } finally {
                setLoading(false);
            }
        };

        if (trip?.id) init();
    }, [trip?.id, onBack, onVerified]);

    const currentPassenger = passengers[currentIndex];

    const verifyOTP = async () => {
        if (!otp || otp.length !== 4) {
            toast.error('Please enter a 4-digit OTP');
            return;
        }

        setVerifying(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const { data, error } = await supabase.functions.invoke('verify-ride-otp', {
                body: {
                    trip_id: trip.id,
                    booking_id: currentPassenger.id,
                    otp
                },
                headers: {
                    Authorization: `Bearer ${session?.access_token}`
                }
            });

            if (error) throw error;

            if (data.success) {
                toast.success(data.message || `Passenger verified!`);
                setOtp('');

                // Mark locally as verified
                const updatedPassengers = [...passengers];
                updatedPassengers[currentIndex].otp_verified = true;
                setPassengers(updatedPassengers);

                if (data.all_verified) {
                    onVerified(); // Ride started! Go to live tracking
                } else {
                    // Find next unverified passenger
                    const nextUnverified = updatedPassengers.findIndex(p => !p.otp_verified);
                    if (nextUnverified !== -1) {
                        setCurrentIndex(nextUnverified);
                    } else {
                        onVerified();
                    }
                }
            } else {
                toast.error(data.message || 'Invalid OTP');
            }
        } catch (error) {
            console.error('OTP verification error:', error);
            toast.error('Failed to verify OTP');
        } finally {
            setVerifying(false);
        }
    };

    const resendOTP = async () => {
        try {
            toast.success('Resending OTP...');
            const { data: { session } } = await supabase.auth.getSession();
            // force_resend = true → generates NEW OTPs even if old ones exist
            const { error } = await supabase.functions.invoke('generate-ride-otp', {
                body: { trip_id: trip.id, force_resend: true },
                headers: {
                    Authorization: `Bearer ${session?.access_token}`
                }
            });
            if (error) throw error;

            // Re-fetch to get new OTP values
            const { data: refreshedBookings } = await supabase
                .from('booking_requests')
                .select('id, passenger_id, otp_code, otp_verified')
                .eq('trip_id', trip.id)
                .eq('status', 'approved')
                .order('created_at');

            if (refreshedBookings) {
                refreshedBookings.forEach(b => {
                    const original = passengers.find(ob => ob.id === b.id);
                    b.profiles = original?.profiles || { full_name: 'Passenger' };
                });
                setPassengers(refreshedBookings);
            }

            toast.success('New OTP sent to passengers!');
        } catch (err) {
            toast.error('Failed to resend OTP');
        }
    };

    if (loading) {
        return (
            <div className="otp-loading-container">
                <Loader2 className="spinning-loader" size={40} />
                <p>Preparing ride sequence...</p>
            </div>
        );
    }

    if (!currentPassenger) return null;

    return (
        <div className="otp-verification-container animate-page-in">
            <header className="otp-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1>Verify Passengers</h1>
            </header>

            <div className="otp-content">
                <div className="progress-section">
                    <p>Passenger {currentIndex + 1} of {passengers.length}</p>
                    <div className="progress-dots">
                        {passengers.map((p, idx) => (
                            <div
                                key={p.id}
                                className={`progress-dot ${p.otp_verified ? 'verified' : (idx === currentIndex ? 'active' : '')}`}
                                title={p.profiles?.full_name}
                            >
                                {p.otp_verified && <CheckCircle size={12} color="white" />}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="verification-card">
                    <div className="passenger-avatar-placeholder">
                        <Smartphone size={32} />
                    </div>
                    <h2>{currentPassenger.profiles?.full_name || 'Passenger'}</h2>
                    <p className="instruction">Ask the passenger for their 4-digit Ride OTP</p>

                    <div className="otp-input-wrapper">
                        <input
                            type="text"
                            inputMode="numeric"
                            className="otp-input"
                            placeholder="• • • •"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            maxLength={4}
                            disabled={verifying}
                            autoFocus
                        />
                    </div>

                    <button
                        className="verify-btn primary"
                        onClick={verifyOTP}
                        disabled={verifying || otp.length !== 4}
                    >
                        {verifying ? (
                            <>
                                <Loader2 size={20} className="spinning-loader" />
                                <span>Verifying...</span>
                            </>
                        ) : 'Verify OTP'}
                    </button>

                    <button
                        className="resend-link"
                        onClick={resendOTP}
                        disabled={verifying}
                    >
                        Resend OTP
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OTPVerificationScreen;
