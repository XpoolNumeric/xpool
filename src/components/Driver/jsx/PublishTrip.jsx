import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Car, Bike, MapPin, Calendar, Clock, Users,
    IndianRupee, Check, LogOut, Calculator, AlertCircle, Loader
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import LocationInput from '../../common/LocationInput';
import { PricingService } from '../../../utils/pricingService';
import '../css/PublishTrip.css';

const PublishTrip = ({ onBack, onSuccess, onLogout }) => {
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [formData, setFormData] = useState({
        vehicleType: 'car',
        availableSeats: 3,
        fromLocation: '',
        toLocation: '',
        travelDate: '',
        travelTime: '',
        pricePerSeat: '',
        ladiesOnly: false,
        noSmoking: false,
        petFriendly: false,
        isRecurring: false,
    });

    const [fareDetails, setFareDetails] = useState(null);
    const [fareBreakdown, setFareBreakdown] = useState([]);
    const [driverId, setDriverId] = useState(null);

    const minDate = new Date().toISOString().split('T')[0];

    // Debounced fare calculation
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    useEffect(() => {
        fetchDriverInfo();
    }, []);

    // Auto-calculate fare ONLY when locations change (debounced)
    useEffect(() => {
        if (formData.fromLocation.trim() && formData.toLocation.trim()) {
            const timer = setTimeout(() => {
                calculateFare(formData.fromLocation, formData.toLocation, formData.vehicleType, formData.availableSeats);
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [formData.fromLocation, formData.toLocation]);

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

    const calculateFare = useCallback(async (
        from = formData.fromLocation,
        to = formData.toLocation,
        vehicle = formData.vehicleType,
        seats = formData.availableSeats
    ) => {
        if (!from.trim() || !to.trim()) {
            return;
        }

        setCalculating(true);
        try {
            // Calculate fare for current passenger count
            const fare = await PricingService.calculateFareFromAddresses(
                from,
                to,
                vehicle,
                seats
            );

            setFareDetails(fare);

            // Get breakdown for different passenger counts
            const breakdownData = await PricingService.getFareBreakdown(
                from,
                to,
                vehicle
            );

            setFareBreakdown(breakdownData.breakdowns);

            // Auto-fill price with newly calculated fare
            if (fare.perPersonFare) {
                setFormData(prev => ({
                    ...prev,
                    pricePerSeat: fare.perPersonFare.toString()
                }));
            }

            toast.success('Fare calculated successfully!', {
                icon: '✅',
                duration: 3000
            });
        } catch (error) {
            console.error('Error calculating fare:', error);
            toast.error('Could not calculate fare automatically.', {
                duration: 4000
            });
        } finally {
            setCalculating(false);
        }
    }, [formData.fromLocation, formData.toLocation, formData.vehicleType, formData.availableSeats]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleVehicleChange = (type) => {
        const newSeats = type === 'bike' ? 1 : 3;
        setFormData(prev => ({
            ...prev,
            vehicleType: type,
            availableSeats: newSeats
        }));

        if (formData.fromLocation && formData.toLocation) {
            calculateFare(formData.fromLocation, formData.toLocation, type, newSeats);
        }
    };

    const togglePreference = (pref) => {
        setFormData(prev => ({
            ...prev,
            [pref]: !prev[pref]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
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
        if (!formData.pricePerSeat) {
            toast.error('Please set price per seat');
            return;
        }

        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Please login to publish a trip');
                return;
            }

            // Prepare trip data with fare calculation details
            const baseTripData = {
                user_id: user.id,
                driver_id: driverId,
                vehicle_type: formData.vehicleType,
                available_seats: parseInt(formData.availableSeats),
                from_location: formData.fromLocation.trim(),
                to_location: formData.toLocation.trim(),
                travel_date: formData.travelDate,
                travel_time: formData.travelTime,
                price_per_seat: Math.round(parseFloat(formData.pricePerSeat)),
                status: 'active',
                ladies_only: formData.ladiesOnly,
                no_smoking: formData.noSmoking,
                pet_friendly: formData.petFriendly,
                is_recurring: formData.isRecurring,
                // Store fare calculation details
                distance_km: fareDetails?.routeInfo?.distanceKm ? Math.round(fareDetails.routeInfo.distanceKm) : null,
                duration_min: fareDetails?.routeInfo?.durationMin ? Math.round(fareDetails.routeInfo.durationMin) : null,
                calculated_price: fareDetails?.perPersonFare ? Math.round(fareDetails.perPersonFare) : null,
                fare_tier: fareDetails?.tier || null,
                min_passengers: fareDetails?.minPassengersRequired || null,
                fare_details: fareDetails || null
            };

            const tripsToInsert = [baseTripData];

            // If recurring, create additional trips
            if (formData.isRecurring) {
                const startDate = new Date(formData.travelDate);
                for (let i = 1; i < 5; i++) {
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

            // Show success message
            toast.success(
                formData.isRecurring
                    ? 'Recurring trips published successfully!'
                    : 'Trip published successfully!',
                {
                    duration: 5000,
                    icon: '🎉'
                }
            );

            // Navigate back on success
            if (onSuccess) {
                setTimeout(() => onSuccess(data), 1000);
            }

        } catch (error) {
            console.error('Error publishing trip:', error);
            toast.error('Failed to publish trip. Please try again.', {
                duration: 5000
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSeatChange = (seats) => {
        setFormData(prev => ({
            ...prev,
            availableSeats: seats
        }));

        // Recalculate fare immediately with new passenger count
        if (formData.fromLocation && formData.toLocation) {
            calculateFare(formData.fromLocation, formData.toLocation, formData.vehicleType, seats);
        }
    };

    const renderFareDetails = () => {
        if (!fareDetails) return null;

        return (
            <div className="fare-details-card">
                <div className="fare-header">
                    <Calculator size={20} />
                    <h3>Calculated Fare</h3>
                    {calculating ? (
                        <span className="calculating-badge">
                            <Loader size={14} className="spin" />
                            Calculating...
                        </span>
                    ) : (
                        <span className="success-badge">✓ Calculated</span>
                    )}
                </div>

                <div className="fare-body">
                    <div className="fare-main">
                        <div>
                            <span className="fare-label">Per Person:</span>
                            <div className="fare-subtext">
                                {formData.availableSeats} seat{formData.availableSeats > 1 ? 's' : ''} available
                            </div>
                        </div>
                        <div className="fare-amount">₹{fareDetails.perPersonFare}</div>
                    </div>

                    <div className="fare-breakdown">
                        <div className="breakdown-item">
                            <span>Distance:</span>
                            <span className="breakdown-value">{fareDetails.routeInfo?.distance}</span>
                        </div>
                        <div className="breakdown-item">
                            <span>Duration:</span>
                            <span className="breakdown-value">{fareDetails.routeInfo?.duration}</span>
                        </div>
                        <div className="breakdown-item">
                            <span>Tier:</span>
                            <span className="tier-badge">{fareDetails.tier}</span>
                        </div>
                        <div className="breakdown-item">
                            <span>Min Passengers:</span>
                            <span className="breakdown-value">{fareDetails.minPassengersRequired}</span>
                        </div>
                    </div>

                    {/* Savings section */}
                    {fareDetails.savings && (
                        <div className="savings-section">
                            <div className="savings-item">
                                <AlertCircle size={16} />
                                <span>Save {fareDetails.savings.vsTaxi}% vs Taxi</span>
                                <span className="savings-price">(Taxi: ₹{fareDetails.savings.taxiPrice})</span>
                            </div>
                            <div className="savings-item">
                                <AlertCircle size={16} />
                                <span>Save {fareDetails.savings.vsBus}% vs Bus</span>
                                <span className="savings-price">(Bus: ₹{fareDetails.savings.busPrice})</span>
                            </div>
                        </div>
                    )}

                    {/* Passenger breakdown */}
                    {fareBreakdown.length > 0 && (
                        <div className="passenger-breakdown">
                            <p className="breakdown-title">Price comparison:</p>
                            <div className="passenger-grid">
                                {fareBreakdown.map((item, index) => (
                                    <div
                                        key={index}
                                        className={`passenger-item ${item.passengers === formData.availableSeats ? 'active' : ''}`}
                                        onClick={() => handleSeatChange(item.passengers)}
                                    >
                                        <span className="passenger-count">{item.passengers} person{item.passengers > 1 ? 's' : ''}</span>
                                        <span className="passenger-price">₹{item.fare}</span>
                                        {item.passengers === formData.availableSeats && (
                                            <div className="selected-indicator">✓ Selected</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Driver earnings info */}
                    {fareDetails.driverEarningPerPerson && (
                        <div className="driver-earnings">
                            <p className="earnings-title">Driver Earnings:</p>
                            <div className="earnings-grid">
                                <div className="earnings-item">
                                    <span>Per person:</span>
                                    <span>₹{fareDetails.driverEarningPerPerson}</span>
                                </div>
                                <div className="earnings-item">
                                    <span>Total (all seats):</span>
                                    <span>₹{fareDetails.totalDriverEarning}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
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
                    <button className="logout-btn-header" onClick={onLogout}>
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
                            {[1, 2, 3, 4].map(num => (
                                <button
                                    key={num}
                                    type="button"
                                    className={`seat-btn ${formData.availableSeats === num ? 'active' : ''}`}
                                    onClick={() => handleSeatChange(num)}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Fare Calculation Display */}
                {renderFareDetails()}

                {/* Preferences */}
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
                        onPlaceSelected={(place) => {
                            setFormData(prev => ({
                                ...prev,
                                fromLocation: place.formatted_address || place.name
                            }));
                        }}
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
                        onPlaceSelected={(place) => {
                            setFormData(prev => ({
                                ...prev,
                                toLocation: place.formatted_address || place.name
                            }));
                        }}
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

                {/* Recurring Option */}
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

                {/* Price per Seat */}
                <div className="form-section">
                    <label className="section-label">
                        <IndianRupee size={18} />
                        Price per Seat
                        <button
                            type="button"
                            className="calculate-btn"
                            onClick={calculateFare}
                            disabled={calculating || !formData.fromLocation || !formData.toLocation}
                        >
                            {calculating ? (
                                <>
                                    <Loader size={14} className="spin" />
                                    Calculating
                                </>
                            ) : 'Calculate'}
                        </button>
                    </label>
                    <div className="price-input-wrapper">
                        <span className="currency-symbol">₹</span>
                        <input
                            type="number"
                            name="pricePerSeat"
                            className="form-input price-input readonly-input"
                            placeholder="Calculated automatically"
                            value={formData.pricePerSeat}
                            readOnly
                        />
                    </div>

                    {/* Price comparison */}
                    {fareDetails && formData.pricePerSeat && (
                        <div className="price-comparison">
                            {parseFloat(formData.pricePerSeat) > fareDetails.perPersonFare ? (
                                <span className="price-higher">
                                    ₹{parseFloat(formData.pricePerSeat) - fareDetails.perPersonFare} higher than calculated
                                </span>
                            ) : parseFloat(formData.pricePerSeat) < fareDetails.perPersonFare ? (
                                <span className="price-lower">
                                    ₹{fareDetails.perPersonFare - parseFloat(formData.pricePerSeat)} lower than calculated
                                </span>
                            ) : (
                                <span className="price-match">✓ Matches calculated price</span>
                            )}
                        </div>
                    )}

                    {/* Help text */}
                    {!formData.pricePerSeat && (
                        <div className="price-help">
                            <AlertCircle size={14} />
                            <span>Price is calculated automatically based on distance and vehicle type</span>
                        </div>
                    )}
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    className="submit-btn"
                    disabled={loading || calculating}
                >
                    {loading ? (
                        <>
                            <Loader size={18} className="spin" />
                            Publishing...
                        </>
                    ) : 'Publish Trip'}
                </button>
            </form>
        </div>
    );
};

export default PublishTrip;