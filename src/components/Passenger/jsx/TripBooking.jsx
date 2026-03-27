import React, { useState } from 'react';
import { ArrowLeft, Car, Bike, MapPin, Calendar, Clock, Users, User, MessageCircle, Send, Check, Navigation } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import LocationInput from '../../common/LocationInput';
import '../css/TripBooking.css';

const TripBooking = ({ trip, onBack, onSuccess }) => {
    const [seatsRequested, setSeatsRequested] = useState(1);
    const [message, setMessage] = useState('');
    const [paymentMode, setPaymentMode] = useState('cod');
    const [pickupLocation, setPickupLocation] = useState('');
    const [loading, setLoading] = useState(false);
    const [bookingComplete, setBookingComplete] = useState(false);

    // Helper function to add timeout to promises
    const withTimeout = (promise, timeoutMs = 10000) => {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout. Please try again.')), timeoutMs)
            )
        ]);
    };

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
        if (loading) return;

        setLoading(true);
        console.log('[TripBooking] Starting booking process...');

        try {
            if (!trip || !trip.id) {
                throw new Error('Invalid trip data');
            }

            // Get current session with fresh token
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                toast.error('Please login to book a trip');
                setLoading(false);
                return;
            }

            console.log('[TripBooking] Using book-trip edge function...');

            const { data, error } = await supabase.functions.invoke('book-trip', {
                body: {
                    trip_id: trip.id,
                    passenger_id: session.user.id,
                    seats_requested: seatsRequested,
                    message: message.trim() || null,
                    payment_mode: paymentMode,
                    passenger_location: pickupLocation.trim() || null,
                    passenger_destination: trip.to_location
                },
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });

            if (error) {
                console.error('[TripBooking] Edge function error:', error);
                // Extract the actual error message from the response body
                let errorMessage = 'Failed to connect to booking service';
                try {
                    if (error.context && error.context.json) {
                        const errorBody = await error.context.json();
                        console.error('[TripBooking] Error body:', errorBody);
                        errorMessage = errorBody?.error || error.message || errorMessage;
                    } else {
                        errorMessage = error.message || errorMessage;
                    }
                } catch (parseErr) {
                    console.error('[TripBooking] Could not parse error body:', parseErr);
                    errorMessage = error.message || errorMessage;
                }
                throw new Error(errorMessage);
            }

            if (!data?.success) {
                throw new Error(data?.error || 'Booking failed');
            }

            console.log('[TripBooking] Booking created successfully:', data.data);
            setBookingComplete(true);
            toast.success('Booking request sent!');

        } catch (error) {
            console.error('[TripBooking] Error:', error);
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

                {/* Pickup Location */}
                <div className="form-section">
                    <label className="section-label">
                        <Navigation size={18} />
                        Pickup Location
                    </label>
                    <LocationInput
                        name="pickupLocation"
                        placeholder="Enter your pickup point"
                        value={pickupLocation}
                        onChange={(e) => setPickupLocation(e.target.value)}
                        onPlaceSelect={(prediction) => {
                            setPickupLocation(prediction.description || prediction.structured_formatting?.main_text || '');
                        }}
                        Icon={MapPin}
                        iconColor="green"
                        className="pickup-input-group"
                    />
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