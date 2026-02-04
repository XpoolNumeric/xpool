import React, { useState, useEffect } from 'react';
import { ArrowLeft, Car, Bike, MapPin, Calendar, Clock, Users, IndianRupee, Check, LogOut } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import LocationInput from '../../common/LocationInput';
import '../css/PublishTrip.css';

const PublishTrip = ({ onBack, onSuccess, onLogout }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        vehicleType: 'car',
        availableSeats: 3,
        fromLocation: '',
        toLocation: '',
        travelDate: '',
        travelTime: '',
        pricePerSeat: '',
        // New Features
        ladiesOnly: false,
        noSmoking: false,
        petFriendly: false,
        isRecurring: false,
        recurringDays: [] // e.g., ['Mon', 'Tue'] - For simple implementation, let's just do "Repeat for next 7 days" or "Mon-Fri"
    });

    const [driverId, setDriverId] = useState(null);

    const minDate = new Date().toISOString().split('T')[0];

    useEffect(() => {
        fetchDriverInfo();
    }, []);

    const fetchDriverInfo = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('drivers')
                    .select('id')
                    .eq('user_id', user.id)
                    .single();

                if (error) throw error;
                if (data) setDriverId(data.id);
            }
        } catch (error) {
            console.error('Error fetching driver info:', error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleVehicleChange = (type) => {
        setFormData(prev => ({
            ...prev,
            vehicleType: type,
            availableSeats: type === 'bike' ? 1 : 3 // Reset seats default
        }));
    };

    const togglePreference = (pref) => {
        setFormData(prev => ({
            ...prev,
            [pref]: !prev[pref]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();


        if (!formData.fromLocation.trim()) {
            toast.error('Please enter pickup location');
            return;
        }
        if (!formData.toLocation.trim()) {
            toast.error('Please enter destination');
            return;
        }
        if (!formData.travelDate) {
            toast.error('Please select travel date');
            return;
        }
        if (!formData.travelTime) {
            toast.error('Please select travel time');
            return;
        }

        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Please login to publish a trip');
                return;
            }

            const baseTripData = {
                user_id: user.id,
                driver_id: driverId,
                vehicle_type: formData.vehicleType,
                available_seats: parseInt(formData.availableSeats),
                from_location: formData.fromLocation.trim(),
                to_location: formData.toLocation.trim(),
                travel_time: formData.travelTime,
                price_per_seat: formData.pricePerSeat ? parseFloat(formData.pricePerSeat) : null,
                status: 'active',
                // New Fields
                ladies_only: formData.ladiesOnly,
                no_smoking: formData.noSmoking,
                pet_friendly: formData.petFriendly
            };

            const tripsToInsert = [];

            // Single Trip
            if (!formData.isRecurring) {
                tripsToInsert.push({
                    ...baseTripData,
                    travel_date: formData.travelDate
                });
            } else {
                // Recurring Logic: Create trips for next 5 days
                // (Simple implementation as requested for "Repeat Mon-Fri" flow)
                const startDate = new Date(formData.travelDate);
                for (let i = 0; i < 5; i++) { // Generate for 5 occurrences including start date
                    const nextDate = new Date(startDate);
                    nextDate.setDate(startDate.getDate() + i);
                    tripsToInsert.push({
                        ...baseTripData,
                        travel_date: nextDate.toISOString().split('T')[0],
                        is_recurring: true
                    });
                }
            }

            const { data, error } = await supabase
                .from('trips')
                .insert(tripsToInsert)
                .select();

            if (error) throw error;

            toast.success(formData.isRecurring ? 'Recurring trips published!' : 'Trip published successfully!');
            if (onSuccess) onSuccess(data);

        } catch (error) {
            console.error('Error publishing trip:', error);
            toast.error('Failed to publish trip. Check connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="publish-trip-container animate-page-in">
            {/* Header */}
            <div className="publish-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1>Publish a Trip</h1>
                {onLogout && (
                    <button
                        className="logout-btn-header"
                        onClick={onLogout}
                        style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '12px',
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: '#ef4444',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <LogOut size={18} />
                        Logout
                    </button>
                )}
            </div>

            {/* Form */}
            <form className="publish-form" onSubmit={handleSubmit}>
                {/* Vehicle Type Selection */}
                <div className="form-section">
                    <label className="section-label">Vehicle Type</label>
                    <div className="vehicle-options">
                        <button
                            type="button"
                            className={`vehicle-option ${formData.vehicleType === 'car' ? 'active' : ''}`}
                            onClick={() => handleVehicleChange('car')}
                        >
                            <div className="option-icon">
                                <Car size={28} />
                            </div>
                            <span>Car</span>
                            {formData.vehicleType === 'car' && (
                                <div className="check-badge"><Check size={14} /></div>
                            )}
                        </button>
                        <button
                            type="button"
                            className={`vehicle-option ${formData.vehicleType === 'bike' ? 'active' : ''}`}
                            onClick={() => handleVehicleChange('bike')}
                        >
                            <div className="option-icon">
                                <Bike size={28} />
                            </div>
                            <span>Bike</span>
                            {formData.vehicleType === 'bike' && (
                                <div className="check-badge"><Check size={14} /></div>
                            )}
                        </button>
                    </div>
                </div>

                {/* Number of Seats */}
                <div className="form-section">
                    <label className="section-label">
                        <Users size={18} />
                        Available Seats
                    </label>
                    {formData.vehicleType === 'bike' ? (
                        <div className="seats-display">
                            <span className="seat-number">1</span>
                            <span className="seat-label">seat (Bike pillion only)</span>
                        </div>
                    ) : (
                        <div className="seats-selector">
                            {[1, 2, 3, 4, 5, 6].map(num => (
                                <button
                                    key={num}
                                    type="button"
                                    className={`seat-btn ${formData.availableSeats === num ? 'active' : ''}`}
                                    onClick={() => setFormData(prev => ({ ...prev, availableSeats: num }))}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Preferences (Feature 8) */}
                <div className="form-section">
                    <label className="section-label">Preferences</label>
                    <div className="preferences-grid">
                        <button
                            type="button"
                            className={`pref-chip ${formData.ladiesOnly ? 'active' : ''}`}
                            onClick={() => togglePreference('ladiesOnly')}
                        >
                            👩 Ladies Only
                        </button>
                        <button
                            type="button"
                            className={`pref-chip ${formData.noSmoking ? 'active' : ''}`}
                            onClick={() => togglePreference('noSmoking')}
                        >
                            🚭 No Smoking
                        </button>
                        <button
                            type="button"
                            className={`pref-chip ${formData.petFriendly ? 'active' : ''}`}
                            onClick={() => togglePreference('petFriendly')}
                        >
                            🐾 Pet Friendly
                        </button>
                    </div>
                </div>

                {/* From Location */}
                <div className="form-section">
                    <label className="section-label">
                        <MapPin size={18} />
                        From (Pickup Location)
                    </label>
                    <LocationInput
                        name="fromLocation"
                        placeholder="Enter pickup address"
                        value={formData.fromLocation}
                        onChange={handleChange}
                        className="form-input"
                    />
                </div>

                {/* To Location */}
                <div className="form-section">
                    <label className="section-label">
                        <MapPin size={18} className="destination-icon" />
                        To (Destination)
                    </label>
                    <LocationInput
                        name="toLocation"
                        placeholder="Enter destination address"
                        value={formData.toLocation}
                        onChange={handleChange}
                        className="form-input"
                    />
                </div>

                {/* Date & Time Row */}
                <div className="form-row">
                    <div className="form-section half">
                        <label className="section-label">
                            <Calendar size={18} />
                            Travel Date
                        </label>
                        <input
                            type="date"
                            name="travelDate"
                            className="form-input"
                            value={formData.travelDate}
                            onChange={handleChange}
                            min={minDate}
                        />
                    </div>
                    <div className="form-section half">
                        <label className="section-label">
                            <Clock size={18} />
                            Departure Time
                        </label>
                        <input
                            type="time"
                            name="travelTime"
                            className="form-input"
                            value={formData.travelTime}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                {/* Recurring Option (Feature 2) */}
                <div className="form-section checkbox-section">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={formData.isRecurring}
                            onChange={(e) => setFormData(prev => ({ ...prev, isRecurring: e.target.checked }))}
                        />
                        <span>Repeat for next 5 days</span>
                    </label>
                </div>

                {/* Price per Seat (Optional) */}
                <div className="form-section">
                    <label className="section-label">
                        <IndianRupee size={18} />
                        Price per Seat (Optional)
                    </label>
                    <div className="price-input-wrapper">
                        <span className="currency-symbol">₹</span>
                        <input
                            type="number"
                            name="pricePerSeat"
                            className="form-input price-input"
                            placeholder="0"
                            value={formData.pricePerSeat}
                            onChange={handleChange}
                            min="0"
                        />
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    className="submit-btn"
                    disabled={loading}
                >
                    {loading ? 'Publishing...' : 'Publish Trip'}
                </button>
            </form>
        </div>
    );
};

export default PublishTrip;
