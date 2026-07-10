import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MapPin, Navigation2, Phone, MessageCircle, AlertTriangle, CheckCircle, Clock, ExternalLink, ShieldAlert, X, User, CreditCard, Banknote, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { loadGoogleMapsScript, initializeMap, createRoute, addMarker } from '../../../utils/googleMapsHelper';
import Chat from '../../common/Chat';
import UnifiedRatingModal from '../../common/jsx/UnifiedRatingModal';
import { liveTrackingService } from '../../../services/tracking/LiveTrackingService';
import '../css/ActiveRide.css';

const ActiveRide = ({ trip: initialTrip, onBack }) => {
    const [trip, setTrip] = useState(initialTrip);
    const [passengers, setPassengers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [isDropping, setIsDropping] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null);
    const [showChat, setShowChat] = useState(false);
    const [activeChatTripId, setActiveChatTripId] = useState(null);
    const [activeChatBookingId, setActiveChatBookingId] = useState(null);
    const [showRating, setShowRating] = useState(false);
    const [currentPassengerToRate, setCurrentPassengerToRate] = useState(null);
    const [sosActive, setSosActive] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);

    // Drop flow state
    const [dropTarget, setDropTarget] = useState(null); // passenger being drop-confirmed
    const [cashConfirmVisible, setCashConfirmVisible] = useState(false);
    const [dropOptionsVisible, setDropOptionsVisible] = useState(false);
    const [processingPaymentId, setProcessingPaymentId] = useState(null); // tracks which passenger's payment is being verified

    // OTP Verification State
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpTarget, setOtpTarget] = useState(null);
    const [otpInput, setOtpInput] = useState('');
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

    // Swipe state
    const [swipeProgress, setSwipeProgress] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);
    const swipeRef = useRef(null);
    const swipeContainerRef = useRef(null);

    // Bottom sheet state
    const [sheetHeight, setSheetHeight] = useState(45); // percent of viewport
    const sheetRef = useRef(null);

    const mapInstanceRef = useRef(null);

    useEffect(() => {
        let mounted = true;

        const initRide = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user && mounted) setCurrentUserId(session.user.id);

            // Fetch latest trip details to ensure we have the correct status (e.g. 'in_progress')
            await fetchTripDetails();
            await fetchTripData();
            
            // Only initialize map if not already done
            if (!mapInstanceRef.current) {
                await initializeGoogleMaps();
            }

            if (trip.status === 'in_progress') {
                liveTrackingService.startTracking(trip.id, () => {}, 'driver');
            }
        };

        initRide();

        const tripSubscription = supabase
            .channel(`active_trip_${trip.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'trips',
                filter: `id=eq.${trip.id}`
            }, (payload) => {
                if (payload.new && mounted) setTrip(payload.new);
            })
            .subscribe();

        const bookingsSubscription = supabase
            .channel(`trip_bookings_${trip.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'booking_requests',
                filter: `trip_id=eq.${trip.id}`
            }, () => {
                if (mounted) fetchTripData();
            })
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(tripSubscription);
            supabase.removeChannel(bookingsSubscription);
            liveTrackingService.stopTracking();
            
            // Cleanup map instance
            if (mapInstanceRef.current) {
                mapInstanceRef.current = null;
            }
        };
    }, [trip.id]); // Removed trip.status from deps to prevent re-init loops

    const fetchTripDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .eq('id', trip.id)
                .single();
            
            if (error) throw error;
            if (data) setTrip(data);
        } catch (error) {
            console.error('Error fetching trip details:', error);
        }
    };

    const fetchTripData = async () => {
        try {
            const { data: bookings, error } = await supabase
                .from('booking_requests')
                .select(`
                    id,
                    seats_requested,
                    status,
                    drop_status,
                    passenger_id,
                    payment_mode,
                    otp_verified,
                    otp_code,
                    passenger_location,
                    passenger_destination,
                    agreed_price,
                    ride_payments ( id, payment_status, total_amount )
                `)
                .eq('trip_id', trip.id)
                .in('status', ['approved', 'in_progress', 'completed']);

            if (error) throw error;

            const passengerIds = [...new Set((bookings || []).map(b => b.passenger_id).filter(Boolean))];
            let profilesMap = {};

            if (passengerIds.length > 0) {
                const { data: profiles, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, full_name') // Fix: Removed phone_number to prevent RLS/schema block
                    .in('id', passengerIds);

                if (!profileError && profiles) {
                    profiles.forEach(p => { profilesMap[p.id] = p; });
                }
            }

            const bookingsWithProfiles = (bookings || []).map(b => {
                const ridePayment = Array.isArray(b.ride_payments) ? b.ride_payments[0] : b.ride_payments;
                return {
                    ...b,
                    ride_payment: ridePayment || null,
                    profiles: profilesMap[b.passenger_id] || { full_name: 'Passenger' }
                };
            });

            setPassengers(bookingsWithProfiles);

            const needsOtp = bookingsWithProfiles.some(b => !b.otp_verified && !b.otp_code);
            if (needsOtp) {
                const { data: { session } } = await supabase.auth.getSession();
                const { error: otpError } = await supabase.functions.invoke('generate-ride-otp', {
                    body: { trip_id: trip.id },
                    headers: { Authorization: `Bearer ${session?.access_token}` }
                });
                if (!otpError) {
                    // Refetch quietly once to get the new OTP codes
                    const { data: refreshedBookings } = await supabase
                        .from('booking_requests')
                        .select('id, otp_verified, otp_code')
                        .eq('trip_id', trip.id)
                        .in('status', ['approved', 'in_progress', 'completed']);
                    
                    if (refreshedBookings) {
                        setPassengers(prev => prev.map(p => {
                            const latest = refreshedBookings.find(rb => rb.id === p.id);
                            return latest ? { ...p, otp_code: latest.otp_code, otp_verified: latest.otp_verified } : p;
                        }));
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching passengers:', error);
            toast.error('Failed to load passengers');
        } finally {
            setLoading(false);
        }
    };

    const initializeGoogleMaps = async () => {
        if (mapInstanceRef.current) return;
        
        try {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            if (!apiKey) return;

            await loadGoogleMapsScript(apiKey);
            
            const container = document.getElementById('active-ride-map');
            if (!container) return;

            container.innerHTML = '';

            // Start with a neutral India-wide view
            const map = initializeMap('active-ride-map', { lat: 20.5937, lng: 78.9629 }, 6);
            mapInstanceRef.current = map;

            const route = await createRoute(
                map,
                trip.from_location,
                trip.to_location
            );

            // Fit the map to show the full route centered, with padding for header + bottom sheet
            if (route.route && route.route.routes[0]) {
                const bounds = route.route.routes[0].bounds;
                // top: header + pill, bottom: bottom sheet (45vh), left/right margins
                map.fitBounds(bounds, { top: 120, bottom: window.innerHeight * 0.45, left: 30, right: 30 });
            }

            setRouteInfo(route);
            setMapLoaded(true);
        } catch (error) {
            console.error('Map error:', error);
        }
    };

    // Recenter map to fit route bounds
    const recenterMap = () => {
        if (!mapInstanceRef.current || !routeInfo?.route) return;
        const bounds = routeInfo.route.routes[0].bounds;
        mapInstanceRef.current.fitBounds(bounds, {
            top: 120,
            bottom: window.innerHeight * (sheetHeight / 100),
            left: 30,
            right: 30
        });
    };

    // ── Bottom Sheet Touch Handlers ──
    // Unified: scroll content when expanded, drag sheet when at scroll boundary
    const sheetTouchRef = useRef({ startY: 0, startHeight: 0, isDragging: false });
    const scrollContentRef = useRef(null);

    const handleSheetTouchStart = (e) => {
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        sheetTouchRef.current = {
            startY: y,
            startHeight: sheetHeight,
            isDragging: false
        };
    };

    const handleSheetTouchMove = (e) => {
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        const deltaY = sheetTouchRef.current.startY - y; // positive = swiping up
        const scrollEl = scrollContentRef.current;
        const atTop = !scrollEl || scrollEl.scrollTop <= 0;
        const atBottom = scrollEl && (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2);

        // Determine if we should drag the sheet or scroll content
        if (!sheetTouchRef.current.isDragging) {
            // Start dragging if: swiping up from non-expanded, OR swiping down and content is at scroll top
            if ((deltaY > 5 && sheetHeight < 83) || (deltaY < -5 && atTop)) {
                sheetTouchRef.current.isDragging = true;
            }
        }

        if (sheetTouchRef.current.isDragging) {
            e.preventDefault();
            const deltaPercent = (deltaY / window.innerHeight) * 100;
            const newHeight = Math.min(Math.max(sheetTouchRef.current.startHeight + deltaPercent, 18), 85);
            setSheetHeight(newHeight);
        }
        // Otherwise normal scroll happens inside .sheet-scroll-content
    };

    const handleSheetTouchEnd = () => {
        if (sheetTouchRef.current.isDragging) {
            sheetTouchRef.current.isDragging = false;
            // Snap to nearest detent
            if (sheetHeight < 30) setSheetHeight(18);
            else if (sheetHeight < 65) setSheetHeight(45);
            else setSheetHeight(85);
        }
    };

    // Auto-expand sheet when user scrolls content, collapse when back at top
    const handleContentScroll = (e) => {
        const scrollTop = e.target.scrollTop;
        if (scrollTop > 5 && sheetHeight < 84) {
            setSheetHeight(85);
        } else if (scrollTop === 0 && sheetHeight >= 84) {
            setSheetHeight(45);
        }
    };

    // Attach non-passive touch listeners so e.preventDefault() works
    useEffect(() => {
        const el = sheetRef.current;
        if (!el) return;
        el.addEventListener('touchstart', handleSheetTouchStart, { passive: true });
        el.addEventListener('touchmove', handleSheetTouchMove, { passive: false });
        el.addEventListener('touchend', handleSheetTouchEnd, { passive: true });
        return () => {
            el.removeEventListener('touchstart', handleSheetTouchStart);
            el.removeEventListener('touchmove', handleSheetTouchMove);
            el.removeEventListener('touchend', handleSheetTouchEnd);
        };
    });

    // ── OTP Verification Flow ──────────────────────────────────
    const handleVerifyOtp = async () => {
        if (!otpTarget || otpInput.length !== 4) {
            toast.error('Please enter a valid 4-digit OTP');
            return;
        }

        setIsVerifyingOtp(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const { data, error } = await supabase.functions.invoke('verify-ride-otp', {
                body: {
                    trip_id: trip.id,
                    booking_id: otpTarget.id,
                    otp: otpInput
                },
                headers: { Authorization: `Bearer ${session?.access_token}` }
            });

            if (error) throw error;

            if (data.success) {
                toast.success('Passenger successfully verified! ✅');
                setOtpInput('');
                setShowOtpModal(false);
                setOtpTarget(null);

                // Update local state to reflect verification
                setPassengers(prev => prev.map(p =>
                    p.id === otpTarget.id ? { ...p, otp_verified: true } : p
                ));
            } else {
                toast.error(data.message || 'Invalid OTP');
            }
        } catch (err) {
            console.error('OTP Verification Error:', err);
            toast.error('Failed to verify OTP');
        } finally {
            setIsVerifyingOtp(false);
        }
    };

    // ── Drop Flow ──────────────────────────────────────────────
    const initiateDropPassenger = (passenger) => {
        if (passenger.drop_status === 'completed') return;
        setDropTarget(passenger);

        const rp = passenger.ride_payment;
        const isPaidOnline = rp && rp.payment_status === 'paid';

        if (isPaidOnline) {
            // Online payment already confirmed → drop directly
            handleDropPassenger(passenger);
        } else {
            // Give driver explicit options: Check Online or Cash
            setDropOptionsVisible(true);
        }
    };

    const checkOnlinePaymentAndDrop = async (passenger) => {
        setProcessingPaymentId(passenger.passenger_id);
        try {
            // Re-fetch payment status from DB
            const { data, error } = await supabase
                .from('ride_payments')
                .select('id, payment_status')
                .eq('booking_id', passenger.id)
                .maybeSingle();

            if (error) throw error;

            if (data && data.payment_status === 'paid') {
                toast.success('Online payment verified ✓');
                await handleDropPassenger(passenger);
            } else {
                toast.error('Payment not received yet. Ask passenger to complete payment or collect cash.');
                setCashConfirmVisible(true); // Fallback to cash option
            }
        } catch (err) {
            console.error('Payment check error:', err);
            toast.error('Could not verify payment');
        } finally {
            setProcessingPaymentId(null);
        }
    };

    const handleCashConfirmed = async () => {
        if (!dropTarget) return;
        const targetCopy = { ...dropTarget }; // capture before any state resets
        setProcessingPaymentId(targetCopy.passenger_id);
        try {
            // Call verify-cash-payment to mark as paid
            const { data, error } = await supabase.functions.invoke('verify-cash-payment', {
                body: {
                    booking_id: targetCopy.id,
                    payment_id: targetCopy.ride_payment?.id
                }
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.error || 'Failed to verify cash');

            toast.success('Cash payment verified!');
            setCashConfirmVisible(false);
            setDropTarget(null);
            await handleDropPassenger(targetCopy);
        } catch (err) {
            console.error('Cash verify error:', err);
            toast.error(err.message || 'Failed to verify cash payment');
            setCashConfirmVisible(false);
            setDropTarget(null);
        } finally {
            setProcessingPaymentId(null);
        }
    };

    const handleDropPassenger = async (passenger) => {
        const target = passenger || dropTarget;
        if (!target || target.drop_status === 'completed') return;

        setIsDropping(target.passenger_id);
        try {
            let dropSuccess = false;
            let allDropped = false;

            // Try edge function first
            try {
                const { data, error } = await supabase.functions.invoke('complete-passenger-drop', {
                    body: { trip_id: trip.id, booking_id: target.id }
                });

                if (error) throw error;
                if (!data.success) throw new Error(data.error || 'Failed to drop passenger');

                dropSuccess = true;
                allDropped = data.all_dropped;
                toast.success(data.message || `${target.profiles?.full_name} dropped off ✓`);
            } catch (edgeFnError) {
                console.warn('Edge function failed, using direct DB fallback:', edgeFnError);

                // ── Fallback: update DB directly ──
                const { error: dropError } = await supabase
                    .from('booking_requests')
                    .update({
                        drop_status: 'completed',
                        dropped_at: new Date().toISOString(),
                        status: 'completed'
                    })
                    .eq('id', target.id);

                if (dropError) throw dropError;

                dropSuccess = true;
                toast.success(`${target.profiles?.full_name} dropped off ✓`);

                // Check if all passengers are now dropped
                const { data: allBookings } = await supabase
                    .from('booking_requests')
                    .select('id, drop_status')
                    .eq('trip_id', trip.id)
                    .in('status', ['approved', 'completed']);

                allDropped = allBookings?.every(b =>
                    b.id === target.id ? true : b.drop_status === 'completed'
                ) || false;

                // Don't mark trip as completed here — that happens on swipe-to-finish
            }

            if (dropSuccess) {
                setCashConfirmVisible(false);
                setDropTarget(null);
                await fetchTripData();

                if (allDropped) {
                    toast.success('All passengers dropped! Swipe to finish ride.');
                }
            }
        } catch (error) {
            console.error('Drop error:', error);
            toast.error('Failed to drop passenger');
        } finally {
            setIsDropping(null);
        }
    };

    // ── Finish Ride (Swipe) ────────────────────────────────────
    const allDropped = passengers.length > 0 && passengers.every(p => p.drop_status === 'completed');

    const handleFinishRide = async () => {
        if (!allDropped) {
            toast.error('Drop off all passengers before finishing the ride.');
            return;
        }
        setIsFinishing(true);
        try {
            // Trip should already be marked completed by complete-passenger-drop
            // but ensure it's done
            const { error } = await supabase
                .from('trips')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', trip.id);

            if (error) throw error;

            liveTrackingService.stopTracking();
            toast.success('🎉 Ride completed! Earnings credited to your wallet.');
            
            // Trigger the rating flow for the first passenger (or show trip completion)
            if (passengers.length > 0) {
                const p = passengers[0];
                setCurrentPassengerToRate({
                    id: p.passenger_id,
                    name: p.profiles?.full_name || 'Passenger'
                });
                setShowRating(true);
            } else {
                setTimeout(() => onBack(), 1500);
            }
        } catch (err) {

            console.error('Finish ride error:', err);
            toast.error('Failed to finish ride');
        } finally {
            setIsFinishing(false);
        }
    };

    // Swipe gesture handlers
    const handleSwipeStart = (e) => {
        if (!allDropped || isFinishing) return;
        setIsSwiping(true);
    };

    const handleSwipeMove = (e) => {
        if (!isSwiping || !swipeContainerRef.current) return;
        const containerWidth = swipeContainerRef.current.offsetWidth - 64; // minus thumb width
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const rect = swipeContainerRef.current.getBoundingClientRect();
        const progress = Math.min(Math.max((clientX - rect.left - 32) / containerWidth, 0), 1);
        setSwipeProgress(progress);
    };

    const handleSwipeEnd = () => {
        if (!isSwiping) return;
        setIsSwiping(false);
        if (swipeProgress > 0.75) {
            handleFinishRide();
        }
        setSwipeProgress(0);
    };

    const handleCall = (phone) => {
        if (phone) window.location.href = `tel:${phone}`;
        else toast.error('Phone not available');
    };

    const handleSOS = () => {
        setSosActive(!sosActive);
        if (!sosActive) {
            toast.error('SOS Activated! Alerts sent to emergency services.');
        }
    };

    const openNavigation = () => {
        const dest = encodeURIComponent(trip.to_location);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
    };

    // ── Helpers ────────────────────────────────────────────────
    const getPassengerAmount = (p) => {
        if (p.ride_payment?.total_amount) return p.ride_payment.total_amount;
        if (p.agreed_price) return p.agreed_price;
        return p.seats_requested * trip.price_per_seat;
    };

    const getPaymentBadge = (p) => {
        const rp = p.ride_payment;
        if (rp && rp.payment_status === 'paid') {
            return { text: 'Paid ✓', color: '#10b981', bg: '#ecfdf5' };
        }
        if (p.payment_mode === 'online') {
            return { text: 'Online', color: '#3b82f6', bg: '#eff6ff' };
        }
        return { text: 'Cash', color: '#f59e0b', bg: '#fffbeb' };
    };

    const droppedCount = passengers.filter(p => p.drop_status === 'completed').length;

    return (
        <div className="active-ride-container animate-page-in">
            {/* Full-screen map base layer */}
            <div className="map-section">
                <div id="active-ride-map" className="map-container"></div>
                <div className="map-vignette" />
            </div>

            {/* Floating header over map */}
            <header className="ride-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1>Active Ride</h1>
                <div className="header-right-actions">
                    <button className={`sos-btn ${sosActive ? 'active' : ''}`} onClick={handleSOS}>
                        <ShieldAlert size={20} />
                    </button>
                </div>
            </header>

            {/* Route info pill floating on map */}
            {routeInfo && (
                <div className="route-info-card">
                    <div className="route-stat">
                        <Navigation2 size={16} />
                        <span>{routeInfo.distance}</span>
                    </div>
                    <div className="route-info-divider" />
                    <div className="route-stat">
                        <Clock size={16} />
                        <span>{routeInfo.duration}</span>
                    </div>
                </div>
            )}

            {/* Recenter map button */}
            <button 
                className="recenter-btn" 
                onClick={recenterMap} 
                aria-label="Recenter map"
                style={{ bottom: `calc(${sheetHeight}vh + 1rem)` }}
            >
                <Navigation2 size={18} />
            </button>

            {/* Draggable bottom sheet */}
            <div
                ref={sheetRef}
                className="ride-content"
                style={{ height: `${sheetHeight}vh` }}
                onMouseDown={handleSheetTouchStart}
                onMouseMove={handleSheetTouchMove}
                onMouseUp={handleSheetTouchEnd}
            >
                {/* Drag handle */}
                <div className="sheet-drag-handle">
                    <div className="sheet-handle-bar" />
                </div>
                <div className="sheet-scroll-content" ref={scrollContentRef} onScroll={handleContentScroll}>
                <div className="navigation-card">
                    <div className="route-info-flow">
                        <div className="stop">
                            <div className="dot from"></div>
                            <span className="address">{trip.from_location}</span>
                        </div>
                        <div className="route-line"></div>
                        <div className="stop">
                            <div className="dot to"></div>
                            <span className="address">{trip.to_location}</span>
                        </div>
                    </div>
                    <button className="navigate-btn" onClick={openNavigation}>
                        <ExternalLink size={18} />
                        Start Google Navigation
                    </button>
                </div>

                {/* Progress bar */}
                {passengers.length > 0 && (
                    <div className="drop-progress-bar">
                        <div className="drop-progress-text">
                            <span>{droppedCount} of {passengers.length} dropped</span>
                            {allDropped && <CheckCircle size={16} color="#10b981" />}
                        </div>
                        <div className="drop-progress-track">
                            <div
                                className="drop-progress-fill"
                                style={{ width: `${(droppedCount / passengers.length) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="passengers-section">
                    <h3>Passengers ({passengers.length})</h3>
                    {passengers.length === 0 ? (
                        <p className="empty-text">No passengers for this ride yet.</p>
                    ) : (
                        passengers.map((p) => {
                            const badge = getPaymentBadge(p);
                            const amount = getPassengerAmount(p);
                            const isDropped = p.drop_status === 'completed';
                            const isDroppingThis = isDropping === p.passenger_id;

                            return (
                                <div key={p.id} className={`passenger-card-active ${isDropped ? 'dropped' : ''}`}>
                                    <div className="p-info">
                                        <div className="p-avatar">{p.profiles?.full_name?.charAt(0) || <User size={20} />}</div>
                                        <div className="p-details">
                                            <h4>{p.profiles?.full_name}</h4>
                                            <div className="p-meta">
                                                <span className="seats-count">{p.seats_requested} Seat(s)</span>
                                                <span className="p-amount">₹{amount}</span>
                                                <span className="payment-badge" style={{ color: badge.color, background: badge.bg }}>
                                                    {badge.text}
                                                </span>
                                            </div>
                                            <div className="p-drop-location" style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '4px', flexShrink: 0 }}></div>
                                                    <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.3' }}>
                                                        {p.passenger_location || trip.from_location}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                                                    <MapPin size={10} color="#dc2626" style={{ minWidth: '10px', marginTop: '3px', flexShrink: 0 }} />
                                                    <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.3' }}>
                                                        {p.passenger_destination || trip.to_location}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-actions">
                                        {isDropped ? (
                                            <div className="dropped-badge">
                                                <CheckCircle size={16} />
                                                <span>Dropped</span>
                                            </div>
                                        ) : trip.status === 'in_progress' ? (
                                            !p.otp_verified ? (
                                                <button
                                                    className="drop-btn verify"
                                                    style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#fff' }}
                                                    onClick={() => {
                                                        setOtpTarget(p);
                                                        setOtpInput('');
                                                        setShowOtpModal(true);
                                                    }}
                                                >
                                                    <CheckCircle size={16} /> Verify
                                                </button>
                                            ) : (
                                                <button
                                                    className="drop-btn"
                                                    onClick={() => initiateDropPassenger(p)}
                                                    disabled={isDroppingThis || processingPaymentId === p.passenger_id}
                                                >
                                                    {isDroppingThis ? (
                                                        <><Loader2 size={16} className="spinning-loader" /> Dropping...</>
                                                    ) : (
                                                        <><MapPin size={16} /> Drop</>
                                                    )}
                                                </button>
                                            )
                                        ) : (
                                            <div className="status-badge pending">
                                                <Clock size={14} />
                                                <span>Waiting</span>
                                            </div>
                                        )}
                                        <button className="icon-btn-circle chat" onClick={() => {
                                            setActiveChatTripId(trip.id);
                                            setActiveChatBookingId(p.id);
                                            setShowChat(true);
                                        }}>
                                            <MessageCircle size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                </div> {/* end sheet-scroll-content */}
            </div> {/* end ride-content */}

            {/* Swipe to Finish Ride */}
            {trip.status === 'in_progress' && (
                <div className="ride-footer">
                    <div
                        ref={swipeContainerRef}
                        className={`swipe-container ${allDropped ? 'enabled' : 'disabled'} ${isFinishing ? 'finishing' : ''}`}
                        onMouseMove={handleSwipeMove}
                        onMouseUp={handleSwipeEnd}
                        onMouseLeave={handleSwipeEnd}
                        onTouchMove={handleSwipeMove}
                        onTouchEnd={handleSwipeEnd}
                    >
                        {isFinishing ? (
                            <div className="swipe-finishing">
                                <Loader2 size={20} className="spinning-loader" />
                                <span>Completing ride...</span>
                            </div>
                        ) : (
                            <>
                                <div
                                    className="swipe-track-fill"
                                    style={{ width: `${swipeProgress * 100}%` }}
                                />
                                <div
                                    ref={swipeRef}
                                    className="swipe-thumb"
                                    style={{ left: `${swipeProgress * (100)}%` }}
                                    onMouseDown={handleSwipeStart}
                                    onTouchStart={handleSwipeStart}
                                >
                                    <ChevronRight size={20} />
                                    <ChevronRight size={20} style={{ marginLeft: '-12px' }} />
                                </div>
                                <span className="swipe-text">
                                    {allDropped
                                        ? 'Swipe to Finish Ride →'
                                        : `Drop all passengers first (${droppedCount}/${passengers.length})`}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* OTP Verification Modal */}
            {showOtpModal && otpTarget && (
                <div className="modal-overlay" onClick={() => !isVerifyingOtp && setShowOtpModal(false)}>
                    <div className="cash-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-icon" style={{ backgroundColor: '#fef3c7' }}>
                            <CheckCircle size={32} color="#f59e0b" />
                        </div>
                        <h3>Verify Passenger</h3>
                        <p className="modal-passenger">{otpTarget.profiles?.full_name}</p>
                        <p className="modal-subtitle">Ask this passenger for their 4-digit Ride OTP.</p>

                        <div className="otp-input-container" style={{ margin: '1.5rem 0', display: 'flex', justifyContent: 'center' }}>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="• • • •"
                                value={otpInput}
                                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                maxLength={4}
                                disabled={isVerifyingOtp}
                                style={{
                                    fontSize: '2rem',
                                    letterSpacing: '1rem',
                                    textAlign: 'center',
                                    width: '100%',
                                    maxWidth: '200px',
                                    padding: '10px',
                                    borderRadius: '12px',
                                    border: '2px solid #e2e8f0',
                                    outline: 'none',
                                    backgroundColor: '#f8fafc'
                                }}
                                autoFocus
                            />
                        </div>

                        <div className="modal-actions">
                            <button
                                className="modal-btn cancel"
                                onClick={() => setShowOtpModal(false)}
                                disabled={isVerifyingOtp}
                            >
                                Cancel
                            </button>
                            <button
                                className="modal-btn confirm"
                                style={{ backgroundColor: '#f59e0b', color: '#fff' }}
                                onClick={handleVerifyOtp}
                                disabled={isVerifyingOtp || otpInput.length !== 4}
                            >
                                {isVerifyingOtp ? (
                                    <><Loader2 size={16} className="spinning-loader" /> Verifying...</>
                                ) : (
                                    <>Verify</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cash Payment Confirmation Modal */}
            {cashConfirmVisible && dropTarget && (
                <div className="modal-overlay" onClick={() => { setCashConfirmVisible(false); setDropTarget(null); }}>
                    <div className="cash-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-icon">
                            <Banknote size={32} color="#f59e0b" />
                        </div>
                        <h3>Confirm Cash Payment</h3>
                        <p className="modal-passenger">{dropTarget.profiles?.full_name}</p>
                        <div className="modal-amount">₹{getPassengerAmount(dropTarget)}</div>
                        <p className="modal-subtitle">Have you collected cash from this passenger?</p>

                        <div className="modal-actions">
                            <button
                                className="modal-btn cancel"
                                onClick={() => { setCashConfirmVisible(false); setDropTarget(null); }}
                                disabled={processingPaymentId !== null}
                            >
                                Not Yet
                            </button>
                            <button
                                className="modal-btn confirm"
                                onClick={handleCashConfirmed}
                                disabled={processingPaymentId !== null}
                            >
                                {processingPaymentId !== null ? (
                                    <><Loader2 size={16} className="spinning-loader" /> Verifying...</>
                                ) : (
                                    <>Yes, Cash Received</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Drop Options Modal */}
            {dropOptionsVisible && dropTarget && (
                <div className="modal-overlay" onClick={() => { setDropOptionsVisible(false); setDropTarget(null); }}>
                    <div className="cash-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-icon">
                            <Banknote size={32} color="#10b981" />
                        </div>
                        <h3>Payment Verification</h3>
                        <p className="modal-passenger">{dropTarget.profiles?.full_name}</p>
                        <div className="modal-amount">₹{getPassengerAmount(dropTarget)}</div>
                        <p className="modal-subtitle">How did the passenger pay?</p>

                        <div className="modal-actions" style={{ flexDirection: 'column', gap: '12px' }}>
                            <button
                                className="modal-btn confirm"
                                onClick={() => {
                                    setDropOptionsVisible(false);
                                    checkOnlinePaymentAndDrop(dropTarget);
                                }}
                                disabled={processingPaymentId !== null}
                            >
                                <CreditCard size={18} />
                                Verify Online Payment
                            </button>
                            <button
                                className="modal-btn cash"
                                onClick={() => {
                                    setDropOptionsVisible(false);
                                    setCashConfirmVisible(true);
                                }}
                                disabled={processingPaymentId !== null}
                            >
                                <Banknote size={18} />
                                Paid via Cash
                            </button>
                            <button
                                className="modal-btn cancel"
                                onClick={() => { setDropOptionsVisible(false); setDropTarget(null); }}
                            >
                                Cancel Drop
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showChat && (
                <div className="chat-overlay-container">
                    <Chat
                        tripId={activeChatTripId}
                        bookingId={activeChatBookingId}
                        currentUserId={currentUserId}
                        onBack={() => setShowChat(false)}
                    />
                </div>
            )}

            {showRating && currentPassengerToRate && (
                <UnifiedRatingModal
                    targetUser={currentPassengerToRate}
                    tripId={trip.id}
                    onClose={() => {
                        setShowRating(false);
                        onBack();
                    }}
                    onFinish={() => {
                        setShowRating(false);
                        onBack();
                    }}
                />
            )}
        </div>
    );
};

export default ActiveRide;
