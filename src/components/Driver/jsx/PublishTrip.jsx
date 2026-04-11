import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    ArrowLeft, Car, Bike, MapPin, Calendar, Clock, Users,
    IndianRupee, Check, Calculator, AlertCircle, Loader,
    User, Ban, PawPrint, ChevronRight, Sparkles, TrendingUp,
    Shield, Zap, Navigation, Star
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import LocationInput from '../../common/LocationInput';
import { PricingService } from '../../../utils/pricingService';
import '../css/PublishTrip.css';

const STEPS = ['vehicle', 'route', 'schedule', 'pricing'];
const STEP_LABELS = ['Vehicle', 'Route', 'Schedule', 'Pricing'];

const PublishTrip = ({ onBack, onSuccess, onLogout }) => {
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState(new Set());
    const [animatingStep, setAnimatingStep] = useState(false);
    const formRef = useRef(null);

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
    const [routePreview, setRoutePreview] = useState(null);

    const minDate = new Date().toISOString().split('T')[0];

    useEffect(() => {
        fetchDriverInfo();
    }, []);

<<<<<<< HEAD
    // Auto-calculate fare ONLY when locations change (debounced)
=======
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
    useEffect(() => {
        if (formData.fromLocation.trim() && formData.toLocation.trim()) {
            const timer = setTimeout(() => {
                calculateFare(formData.fromLocation, formData.toLocation, formData.vehicleType, formData.availableSeats);
            }, 1000);
<<<<<<< HEAD

=======
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
            return () => clearTimeout(timer);
        }
    }, [formData.fromLocation, formData.toLocation]);

    const fetchDriverInfo = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('drivers').select('id').eq('user_id', user.id).single();
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
<<<<<<< HEAD
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
=======
        if (!from.trim() || !to.trim()) return;
        setCalculating(true);
        try {
            const fare = await PricingService.calculateFareFromAddresses(from, to, vehicle, seats);
            setFareDetails(fare);
            const breakdownData = await PricingService.getFareBreakdown(from, to, vehicle);
            setFareBreakdown(breakdownData.breakdowns);
            if (fare.perPersonFare) {
                setFormData(prev => ({ ...prev, pricePerSeat: fare.perPersonFare.toString() }));
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
            }
            if (fare.routeInfo) {
                setRoutePreview({
                    distance: fare.routeInfo.distance,
                    duration: fare.routeInfo.duration,
                    distanceKm: fare.routeInfo.distanceKm
                });
            }
            toast.success('Fare calculated!', { icon: '✅', duration: 2500 });
        } catch (error) {
            console.error('Error calculating fare:', error);
<<<<<<< HEAD
            toast.error('Could not calculate fare automatically.', {
                duration: 4000
            });
=======
            toast.error('Could not calculate fare automatically.', { duration: 4000 });
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
        } finally {
            setCalculating(false);
        }
    }, [formData.fromLocation, formData.toLocation, formData.vehicleType, formData.availableSeats]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleVehicleChange = (type) => {
        const newSeats = type === 'bike' ? 1 : 3;
<<<<<<< HEAD
        setFormData(prev => ({
            ...prev,
            vehicleType: type,
            availableSeats: newSeats
        }));

=======
        setFormData(prev => ({ ...prev, vehicleType: type, availableSeats: newSeats }));
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
        if (formData.fromLocation && formData.toLocation) {
            calculateFare(formData.fromLocation, formData.toLocation, type, newSeats);
        }
    };

    const togglePreference = (pref) => {
        setFormData(prev => ({ ...prev, [pref]: !prev[pref] }));
    };

    const handleSeatChange = (seats) => {
        setFormData(prev => ({ ...prev, availableSeats: seats }));
        if (formData.fromLocation && formData.toLocation) {
            calculateFare(formData.fromLocation, formData.toLocation, formData.vehicleType, seats);
        }
    };

    const goToStep = (step) => {
        setAnimatingStep(true);
        setTimeout(() => {
            setCurrentStep(step);
            setAnimatingStep(false);
            formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }, 220);
    };

    const nextStep = () => {
        setCompletedSteps(prev => new Set([...prev, currentStep]));
        if (currentStep < STEPS.length - 1) goToStep(currentStep + 1);
    };

    const canProceed = () => {
        switch (currentStep) {
            case 0: return true;
            case 1: return formData.fromLocation.trim() && formData.toLocation.trim();
            case 2: return formData.travelDate && formData.travelTime;
            case 3: return !!formData.pricePerSeat;
            default: return false;
        }
    };

    const handleSubmit = async () => {
        if (!formData.fromLocation.trim()) { toast.error('Please enter pickup location'); return; }
        if (!formData.toLocation.trim()) { toast.error('Please enter destination'); return; }
        if (!formData.travelDate) { toast.error('Please select travel date'); return; }
        if (!formData.travelTime) { toast.error('Please select travel time'); return; }
        if (!formData.pricePerSeat) { toast.error('Please set price per seat'); return; }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { toast.error('Please login to publish a trip'); return; }

            const baseTripData = {
                user_id: user.id, driver_id: driverId,
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
                distance_km: fareDetails?.routeInfo?.distanceKm ? Math.round(fareDetails.routeInfo.distanceKm) : null,
                duration_min: fareDetails?.routeInfo?.durationMin ? Math.round(fareDetails.routeInfo.durationMin) : null,
                calculated_price: fareDetails?.perPersonFare ? Math.round(fareDetails.perPersonFare) : null,
                fare_tier: fareDetails?.tier || null,
                min_passengers: fareDetails?.minPassengersRequired || null,
                fare_details: fareDetails || null
            };

            const tripsToInsert = [baseTripData];
            if (formData.isRecurring) {
                const startDate = new Date(formData.travelDate);
                for (let i = 1; i < 5; i++) {
                    const nextDate = new Date(startDate);
                    nextDate.setDate(startDate.getDate() + i);
                    tripsToInsert.push({ ...baseTripData, travel_date: nextDate.toISOString().split('T')[0], is_recurring: true });
                }
            }

            const { data, error } = await supabase.from('trips').insert(tripsToInsert).select();
            if (error) throw error;

            toast.success(formData.isRecurring ? 'Recurring trips published!' : 'Trip published successfully!', { duration: 5000, icon: '🎉' });
            if (onSuccess) setTimeout(() => onSuccess(data), 1000);
        } catch (error) {
            console.error('Error publishing trip:', error);
            toast.error('Failed to publish trip. Please try again.', { duration: 5000 });
        } finally {
            setLoading(false);
        }
    };

<<<<<<< HEAD
    const handleSeatChange = (seats) => {
        setFormData(prev => ({
            ...prev,
            availableSeats: seats
        }));

        // Recalculate fare immediately with new passenger count
        if (formData.fromLocation && formData.toLocation) {
            calculateFare(formData.fromLocation, formData.toLocation, formData.vehicleType, seats);
        }
=======
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0: return <StepVehicle formData={formData} onVehicleChange={handleVehicleChange} onSeatChange={handleSeatChange} onTogglePref={togglePreference} />;
            case 1: return <StepRoute formData={formData} onChange={handleChange} onFormDataChange={setFormData} routePreview={routePreview} calculating={calculating} />;
            case 2: return <StepSchedule formData={formData} onChange={handleChange} onFormDataChange={setFormData} minDate={minDate} formatDate={formatDate} />;
            case 3: return <StepPricing formData={formData} fareDetails={fareDetails} fareBreakdown={fareBreakdown} calculating={calculating} onSeatChange={handleSeatChange} onCalculate={calculateFare} />;
            default: return null;
        }
    };

    return (
        <div className="publish-trip-container animate-page-in">
            {/* Header */}
            <div className="publish-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={20} />
                </button>
                <div className="header-center">
                    <h1>Publish a Trip</h1>
                    <p className="header-sub">Step {currentStep + 1} of {STEPS.length}</p>
                </div>
                {/* Spacer for centering */}
                <div style={{ width: 40 }} />
            </div>

            {/* Progress Bar */}
            <div className="progress-track">
                {STEPS.map((step, i) => (
                    <button
                        key={step}
                        className={`progress-step ${i === currentStep ? 'active' : ''} ${completedSteps.has(i) ? 'done' : ''}`}
                        onClick={() => completedSteps.has(i) && goToStep(i)}
                        disabled={!completedSteps.has(i) && i !== currentStep}
                    >
                        <div className="step-dot">
                            {completedSteps.has(i) ? <Check size={11} /> : <span>{i + 1}</span>}
                        </div>
                        <span className="step-label">{STEP_LABELS[i]}</span>
                    </button>
                ))}
                <div className="progress-fill" style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }} />
            </div>

            {/* Trip Summary Bar (step > 0) */}
            {currentStep > 0 && (
                <div className="trip-summary-bar">
                    <div className="summary-pill">
                        {formData.vehicleType === 'car' ? <Car size={13} /> : <Bike size={13} />}
                        <span>{formData.availableSeats} seat{formData.availableSeats > 1 ? 's' : ''}</span>
                    </div>
                    {formData.fromLocation && (
                        <div className="summary-pill route-pill">
                            <Navigation size={13} />
                            <span className="pill-from">{formData.fromLocation.split(',')[0]}</span>
                            <ChevronRight size={11} />
                            <span className="pill-to">{formData.toLocation.split(',')[0] || '—'}</span>
                        </div>
                    )}
                    {formData.travelDate && (
                        <div className="summary-pill">
                            <Calendar size={13} />
                            <span>{formatDate(formData.travelDate)}</span>
                        </div>
                    )}
                    {formData.pricePerSeat && (
                        <div className="summary-pill price-pill">
                            <IndianRupee size={13} />
                            <span>{formData.pricePerSeat}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Step Content */}
            <div ref={formRef} className={`step-content ${animatingStep ? 'step-exit' : 'step-enter'}`}>
                {renderStepContent()}
            </div>

            {/* Footer CTA */}
            <div className="step-footer">
                {currentStep < STEPS.length - 1 ? (
                    <button
                        className={`cta-btn ${canProceed() ? 'ready' : 'blocked'}`}
                        onClick={nextStep}
                        disabled={!canProceed()}
                    >
                        <span>Continue</span>
                        <div className="cta-icon"><ChevronRight size={18} /></div>
                    </button>
                ) : (
                    <button
                        className={`cta-btn publish-cta ${canProceed() && !loading ? 'ready' : 'blocked'}`}
                        onClick={handleSubmit}
                        disabled={loading || calculating || !canProceed()}
                    >
                        {loading ? (
                            <><Loader size={18} className="spin" /><span>Publishing...</span></>
                        ) : (
                            <><Sparkles size={18} /><span>Publish Trip</span></>
                        )}
                    </button>
                )}
            </div>
<<<<<<< HEAD

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
=======
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
        </div>
    );
};

/* ═══════════════ STEP COMPONENTS ═══════════════ */

const StepVehicle = ({ formData, onVehicleChange, onSeatChange, onTogglePref }) => (
    <div className="step-wrapper">
        <div className="step-heading">
            <h2>Your vehicle</h2>
            <p>What are you riding today?</p>
        </div>

        <div className="vehicle-options">
            {[
                { type: 'car', icon: Car, label: 'Car', sub: 'Up to 4 seats' },
                { type: 'bike', icon: Bike, label: 'Bike', sub: '1 pillion seat' }
            ].map(({ type, icon: Icon, label, sub }) => (
                <button
                    key={type}
                    className={`vehicle-card ${formData.vehicleType === type ? 'active' : ''}`}
                    onClick={() => onVehicleChange(type)}
                >
                    <div className="vc-glow" />
                    <div className="vc-icon-wrap">
                        <Icon size={26} />
                    </div>
                    <strong>{label}</strong>
                    <span>{sub}</span>
                    {formData.vehicleType === type && (
                        <div className="vc-check"><Check size={12} /></div>
                    )}
                </button>
            ))}
        </div>

        {/* Seats */}
        <div className="field-group">
            <label className="field-label"><Users size={15} /> Available Seats</label>
            {formData.vehicleType === 'bike' ? (
                <div className="bike-seat-display">
                    <span className="bsd-num">1</span>
                    <span className="bsd-text">Pillion seat only</span>
                </div>
            ) : (
                <div className="seat-grid">
                    {[1, 2, 3, 4].map(n => (
                        <button
                            key={n}
                            className={`seat-tile ${formData.availableSeats === n ? 'active' : ''}`}
                            onClick={() => onSeatChange(n)}
                        >
                            <span className="seat-num">{n}</span>
                            <span className="seat-sub">{n === 1 ? 'seat' : 'seats'}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* Preferences */}
        <div className="field-group">
            <label className="field-label"><Shield size={15} /> Ride Preferences</label>
            <div className="pref-row">
                {[
                    { key: 'ladiesOnly', icon: User, label: 'Ladies Only', color: '#ec4899' },
                    { key: 'noSmoking', icon: Ban, label: 'No Smoking', color: '#6366f1' },
                    { key: 'petFriendly', icon: PawPrint, label: 'Pet Friendly', color: '#10b981' },
                ].map(({ key, icon: Icon, label, color }) => (
                    <button
                        key={key}
                        className={`pref-chip ${formData[key] ? 'active' : ''}`}
                        style={formData[key] ? { '--pref-color': color } : {}}
                        onClick={() => onTogglePref(key)}
                    >
                        <Icon size={14} />
                        <span>{label}</span>
                        {formData[key] && <div className="pref-dot" />}
                    </button>
                ))}
            </div>
        </div>
    </div>
);

const StepRoute = ({ formData, onChange, onFormDataChange, routePreview, calculating }) => (
    <div className="step-wrapper">
        <div className="step-heading">
            <h2>Your route</h2>
            <p>Where are you headed?</p>
        </div>

        <div className="route-visual">
            <div className="route-dot from-dot" />
            <div className="route-line" />
            <div className="route-dot to-dot" />
        </div>

        <div className="field-group route-fields">
            <div className="route-field-wrap">
                <div className="route-field-icon from-icon"><MapPin size={16} /></div>
                <div className="route-field-input">
                    <label className="field-label-sm">FROM — Pickup</label>
                    <LocationInput
                        name="fromLocation"
                        placeholder="Enter pickup address"
                        value={formData.fromLocation}
                        onChange={onChange}
                        className="form-input"
                        onPlaceSelected={(place) =>
                            onFormDataChange(prev => ({ ...prev, fromLocation: place.formatted_address || place.name }))
                        }
                    />
                </div>
            </div>

            <div className="swap-divider">
                <div className="swap-line" />
                <div className="swap-icon"><Navigation size={14} /></div>
                <div className="swap-line" />
            </div>

            <div className="route-field-wrap">
                <div className="route-field-icon to-icon"><MapPin size={16} /></div>
                <div className="route-field-input">
                    <label className="field-label-sm">TO — Destination</label>
                    <LocationInput
                        name="toLocation"
                        placeholder="Enter destination address"
                        value={formData.toLocation}
                        onChange={onChange}
                        className="form-input"
                        onPlaceSelected={(place) =>
                            onFormDataChange(prev => ({ ...prev, toLocation: place.formatted_address || place.name }))
                        }
                    />
                </div>
            </div>
        </div>

        {/* Route Preview */}
        {calculating ? (
            <div className="route-preview loading">
                <Loader size={16} className="spin" />
                <span>Calculating route...</span>
            </div>
        ) : routePreview ? (
            <div className="route-preview loaded">
                <div className="rp-stat">
                    <span className="rp-val">{routePreview.distance}</span>
                    <span className="rp-key">Distance</span>
                </div>
                <div className="rp-divider" />
                <div className="rp-stat">
                    <span className="rp-val">{routePreview.duration}</span>
                    <span className="rp-key">Est. Duration</span>
                </div>
                <div className="rp-divider" />
                <div className="rp-stat">
                    <Zap size={14} className="rp-zap" />
                    <span className="rp-key">Auto-priced</span>
                </div>
            </div>
        ) : formData.fromLocation && formData.toLocation ? (
            <div className="route-preview hint">
                <Zap size={14} />
                <span>Route info will appear after fare calculation</span>
            </div>
        ) : null}
    </div>
);

const StepSchedule = ({ formData, onChange, onFormDataChange, minDate, formatDate }) => {
    const timeSlots = ['06:00', '07:00', '08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
    const quickDates = [0, 1, 2, 3].map(offset => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return { value: d.toISOString().split('T')[0], label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) };
    });

    return (
        <div className="step-wrapper">
            <div className="step-heading">
                <h2>When are you leaving?</h2>
                <p>Set your departure date &amp; time</p>
            </div>

            {/* Quick date */}
            <div className="field-group">
                <label className="field-label"><Calendar size={15} /> Quick Select</label>
                <div className="date-chips">
                    {quickDates.map(d => (
                        <button
                            key={d.value}
                            className={`date-chip ${formData.travelDate === d.value ? 'active' : ''}`}
                            onClick={() => onFormDataChange(prev => ({ ...prev, travelDate: d.value }))}
                        >
                            {d.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Full date picker */}
            <div className="field-group">
                <label className="field-label">Or pick a date</label>
                <input
                    type="date"
                    name="travelDate"
                    className="form-input"
                    value={formData.travelDate}
                    onChange={onChange}
                    min={minDate}
                />
            </div>

            {/* Time slots */}
            <div className="field-group">
                <label className="field-label"><Clock size={15} /> Departure Time</label>
                <div className="time-grid">
                    {timeSlots.map(t => (
                        <button
                            key={t}
                            className={`time-chip ${formData.travelTime === t ? 'active' : ''}`}
                            onClick={() => onFormDataChange(prev => ({ ...prev, travelTime: t }))}
                        >
                            {t}
                        </button>
                    ))}
                </div>
                <input
                    type="time"
                    name="travelTime"
                    className="form-input time-custom"
                    value={formData.travelTime}
                    onChange={onChange}
                    placeholder="Or enter custom time"
                />
            </div>

            {/* Recurring */}
            <div className="field-group">
                <button
                    className={`recurring-toggle ${formData.isRecurring ? 'active' : ''}`}
                    onClick={() => onFormDataChange(prev => ({ ...prev, isRecurring: !prev.isRecurring }))}
                >
                    <div className="rt-left">
                        <div className="rt-icon"><Star size={16} /></div>
                        <div>
                            <strong>Repeat for 5 days</strong>
                            <span>Same time, consecutive days</span>
                        </div>
                    </div>
                    <div className={`rt-toggle ${formData.isRecurring ? 'on' : ''}`}>
                        <div className="rt-knob" />
                    </div>
                </button>
            </div>

            {/* Preview */}
            {formData.travelDate && formData.travelTime && (
                <div className="schedule-preview">
                    <div className="sp-badge">
                        <Check size={13} />
                        <span>Departing {formatDate(formData.travelDate)} at {formData.travelTime}</span>
                    </div>
                    {formData.isRecurring && (
                        <p className="sp-recur">+ 4 more days after this</p>
                    )}
                </div>
            )}
        </div>
    );
};

const StepPricing = ({ formData, fareDetails, fareBreakdown, calculating, onSeatChange, onCalculate }) => (
    <div className="step-wrapper">
        <div className="step-heading">
            <h2>Pricing</h2>
            <p>AI-calculated fare based on your route</p>
        </div>

        {calculating ? (
            <div className="fare-loading">
                <div className="fare-loading-orbit">
                    <div className="orbit-ring" />
                    <Calculator size={22} className="orbit-icon" />
                </div>
                <p>Calculating best fare...</p>
            </div>
        ) : fareDetails ? (
            <div className="fare-card">
                {/* Glow bg */}
                <div className="fare-glow" />

                {/* Main fare */}
                <div className="fare-hero">
                    <div>
                        <p className="fare-hero-label">Per person fare</p>
                        <p className="fare-hero-sub">{formData.availableSeats} seat{formData.availableSeats > 1 ? 's' : ''} · {fareDetails.tier}</p>
                    </div>
                    <div className="fare-hero-amount">
                        <span className="fare-rupee">₹</span>
                        <span className="fare-num">{fareDetails.perPersonFare}</span>
                    </div>
                </div>

                {/* Stats row */}
                <div className="fare-stats">
                    <div className="fare-stat">
                        <span className="fs-val">{fareDetails.routeInfo?.distance || '—'}</span>
                        <span className="fs-key">Distance</span>
                    </div>
                    <div className="fare-stat-div" />
                    <div className="fare-stat">
                        <span className="fs-val">{fareDetails.routeInfo?.duration || '—'}</span>
                        <span className="fs-key">Duration</span>
                    </div>
                    <div className="fare-stat-div" />
                    <div className="fare-stat">
                        <span className="fs-val">{fareDetails.minPassengersRequired}</span>
                        <span className="fs-key">Min. pax</span>
                    </div>
                </div>

                {/* Savings */}
                {fareDetails.savings && (
                    <div className="savings-strip">
                        <div className="savings-item vs-taxi">
                            <TrendingUp size={13} />
                            <span>{fareDetails.savings.vsTaxi}% cheaper than Taxi</span>
                            <span className="savings-ref">₹{fareDetails.savings.taxiPrice}</span>
                        </div>
                        <div className="savings-item vs-bus">
                            <TrendingUp size={13} />
                            <span>{fareDetails.savings.vsBus}% cheaper than Bus</span>
                            <span className="savings-ref">₹{fareDetails.savings.busPrice}</span>
                        </div>
                    </div>
                )}

                {/* Passenger breakdown */}
                {fareBreakdown.length > 0 && (
                    <div className="pax-section">
                        <p className="pax-label">Adjust passengers</p>
                        <div className="pax-grid">
                            {fareBreakdown.map((item, i) => (
                                <button
                                    key={i}
                                    className={`pax-card ${item.passengers === formData.availableSeats ? 'active' : ''}`}
                                    onClick={() => onSeatChange(item.passengers)}
                                >
                                    {item.passengers === formData.availableSeats && <div className="pax-selected-bar" />}
                                    <span className="pax-num">{item.passengers}</span>
                                    <span className="pax-pax">pax</span>
                                    <span className="pax-price">₹{item.fare}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Driver earnings */}
                {fareDetails.driverEarningPerPerson && (
                    <div className="earnings-section">
                        <p className="earnings-label">Your earnings</p>
                        <div className="earnings-row">
                            <div className="earnings-cell">
                                <span>Per person</span>
                                <strong>₹{fareDetails.driverEarningPerPerson}</strong>
                            </div>
                            <div className="earnings-cell highlight">
                                <span>Total (all seats)</span>
                                <strong>₹{fareDetails.totalDriverEarning}</strong>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        ) : (
            <div className="no-fare-card">
                <Calculator size={32} />
                <p>No fare calculated yet</p>
                <span>Make sure you've entered both locations in the Route step</span>
                <button
                    className="manual-calc-btn"
                    onClick={() => onCalculate()}
                    disabled={!formData.fromLocation || !formData.toLocation}
                >
                    Calculate Fare
                </button>
            </div>
        )}

        {/* Price display */}
        {formData.pricePerSeat && (
            <div className="final-price-display">
                <span className="fpd-label">Price set to</span>
                <div className="fpd-amount">
                    <IndianRupee size={20} />
                    <span>{formData.pricePerSeat}</span>
                    <span className="fpd-per">/ seat</span>
                </div>
                <div className="fpd-check"><Check size={14} /></div>
            </div>
        )}
    </div>
);

export default PublishTrip;