import React, { useState } from 'react';
import { ArrowLeft, Car, Bike, MapPin, Calendar, Clock, Users, User, MessageCircle, Send, Check } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { createNotification } from '../../../utils/notificationHelper';
import '../css/TripBooking.css';

const TripBooking = ({ trip, onBack, onSuccess }) => {
    const [seatsRequested, setSeatsRequested] = useState(1);
    const [message, setMessage] = useState('');
    const [paymentMode, setPaymentMode] = useState('cod');
    const [loading, setLoading] = useState(false);
    const [bookingComplete, setBookingComplete] = useState(false);

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const formatTime = (timeStr) => {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const handleBooking = async () => {
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Please login to book a trip');
                setLoading(false);
                return;
            }

            // Check if user already has a pending request for this trip
            // Using .maybeSingle() to avoid error when 0 rows found
            const { data: existingRequest, error: checkError } = await supabase
                .from('booking_requests')
                .select('id')
                .eq('trip_id', trip.id)
                .eq('passenger_id', user.id)
                .in('status', ['pending', 'approved'])
                .maybeSingle();

            if (checkError) {
                console.error('Error checking existing booking:', checkError);
                // Continue anyway if it's just a check failure
            }

            if (existingRequest) {
                toast.error('You already have a booking for this trip');
                setLoading(false);
                return;
            }

            console.log('Sending booking request for trip:', trip.id);
            const bookingData = {
                trip_id: trip.id,
                passenger_id: user.id,
                seats_requested: seatsRequested,
                message: message.trim() || null,
                status: 'pending',
                payment_mode: paymentMode
            };

            const { error: insertError } = await supabase
                .from('booking_requests')
                .insert([bookingData]);

            if (insertError) {
                console.error('Booking Insert Error:', insertError);
                throw insertError;
            }

            // Notify Driver
            try {
                if (trip.user_id) {
                    await createNotification(
                        trip.user_id,
                        'booking_pending',
                        'New Booking Request',
                        `You have a new booking request for your trip to ${trip.to_location}.`,
                        trip.id
                    );
                } else {
                    console.warn('Driver ID missing, skipping notification');
                }
            } catch (notifErr) {
                console.error('Failed to send notification to driver:', notifErr);
                // Don't fail the whole booking if just notification fails
            }

            setBookingComplete(true);
            toast.success('Booking request sent!');

        } catch (error) {
            console.error('Full Error booking trip:', error);
            toast.error(error.message || 'Failed to send booking request');
        } finally {
            setLoading(false);
        }
    };

    if (bookingComplete) {
        return (
            <div className="trip-booking-container">
                <div className="success-screen">
                    <div className="success-icon">
                        <Check size={48} />
                    </div>
                    <h1>Request Sent!</h1>
                    <p>Your booking request has been sent to the driver. You will be notified once they respond.</p>
                    <div className="trip-summary">
                        <div className="summary-item">
                            <span className="label">Route</span>
                            <span className="value">{trip.from_location} → {trip.to_location}</span>
                        </div>
                        <div className="summary-item">
                            <span className="label">Date</span>
                            <span className="value">{formatDate(trip.travel_date)}</span>
                        </div>
                        <div className="summary-item">
                            <span className="label">Seats Requested</span>
                            <span className="value">{seatsRequested}</span>
                        </div>
                        <div className="summary-item">
                            <span className="label">Payment Mode</span>
                            <span className="value">{paymentMode === 'cod' ? 'Cash (COD)' : 'Online Payment'}</span>
                        </div>
                    </div>
                    <button className="done-btn" onClick={() => onSuccess ? onSuccess() : onBack()}>
                        View My Bookings
                    </button>
                </div>
            </div>
        );
    }

    const totalPrice = trip.price_per_seat ? trip.price_per_seat * seatsRequested : null;

    return (
        <div className="trip-booking-container">
            {/* Header */}
            <div className="booking-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1>Book Trip</h1>
                <div className="header-spacer" />
            </div>

            {/* Trip Details */}
            <div className="trip-details-card">
                {/* Driver Info */}
                <div className="driver-section">
                    <div className="driver-avatar">
                        <User size={28} />
                    </div>
                    <div className="driver-info">
                        <h2>{trip.driver_name || 'Driver'}</h2>
                        <span className="vehicle-badge">
                            {trip.vehicle_type === 'car' ? <Car size={14} /> : <Bike size={14} />}
                            {trip.vehicle_type}
                        </span>
                    </div>
                </div>

                {/* Route */}
                <div className="route-section">
                    <div className="route-point">
                        <div className="dot from"></div>
                        <div className="point-info">
                            <span className="label">From</span>
                            <span className="location">{trip.from_location}</span>
                        </div>
                    </div>
                    <div className="route-line"></div>
                    <div className="route-point">
                        <div className="dot to"></div>
                        <div className="point-info">
                            <span className="label">To</span>
                            <span className="location">{trip.to_location}</span>
                        </div>
                    </div>
                </div>

                {/* Date & Time */}
                <div className="datetime-section">
                    <div className="datetime-item">
                        <Calendar size={20} />
                        <div>
                            <span className="label">Date</span>
                            <span className="value">{formatDate(trip.travel_date)}</span>
                        </div>
                    </div>
                    <div className="datetime-item">
                        <Clock size={20} />
                        <div>
                            <span className="label">Departure</span>
                            <span className="value">{formatTime(trip.travel_time)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Booking Form */}
            <div className="booking-form">
                {/* Seats Selection */}
                <div className="form-section">
                    <label className="section-label">
                        <Users size={18} />
                        Number of Seats
                    </label>
                    <div className="seats-selector">
                        {Array.from({ length: Math.min(trip.available_seats, 6) }, (_, i) => i + 1).map(num => (
                            <button
                                key={num}
                                type="button"
                                className={`seat-btn ${seatsRequested === num ? 'active' : ''}`}
                                onClick={() => setSeatsRequested(num)}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                    <span className="seats-available">
                        {trip.available_seats} seat{trip.available_seats > 1 ? 's' : ''} available
                    </span>
                </div>

                {/* Payment Mode Selection */}
                <div className="form-section">
                    <label className="section-label">
                        Payment Method
                    </label>
                    <div className="payment-options">
                        <button
                            className={`payment-option ${paymentMode === 'cod' ? 'active' : ''}`}
                            onClick={() => setPaymentMode('cod')}
                        >
                            <span>💵</span> Cash on Delivery
                        </button>
                        <button
                            className={`payment-option ${paymentMode === 'online' ? 'active' : ''}`}
                            onClick={() => setPaymentMode('online')}
                        >
                            <span>💳</span> Online Payment
                        </button>
                    </div>
                </div>

                {/* Message (Optional) */}
                <div className="form-section">
                    <label className="section-label">
                        <MessageCircle size={18} />
                        Message to Driver (Optional)
                    </label>
                    <textarea
                        className="message-input"
                        placeholder="E.g., I'll have a small bag with me..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                    />
                </div>

                {/* Price Summary */}
                {totalPrice && (
                    <div className="price-summary">
                        <div className="price-row">
                            <span>Price per seat</span>
                            <span>₹{trip.price_per_seat}</span>
                        </div>
                        <div className="price-row">
                            <span>Seats</span>
                            <span>×{seatsRequested}</span>
                        </div>
                        <div className="price-row total">
                            <span>Total</span>
                            <span>₹{totalPrice}</span>
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    className="book-btn"
                    onClick={handleBooking}
                    disabled={loading}
                >
                    <Send size={20} />
                    {loading ? 'Sending Request...' : 'Send Booking Request'}
                </button>

                <p className="booking-note">
                    The driver will review your request and you'll be notified once they respond.
                </p>
            </div>
        </div>
    );
};

export default TripBooking;

