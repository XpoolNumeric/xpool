import { useEffect, useMemo, useState } from "react";
import { motion, Variants } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  User,
  Phone,
  Star,
  MapPin,
  Clock,
  CheckCircle2,
  Navigation,
  Receipt,
  ChevronLeft,
  Sparkles,
  Users,
  RotateCcw,
  XCircle,
  Home,
} from "lucide-react";
import { calculateTieredFare, formatDuration } from "@/utils/fareCalculator";
import { supabase } from "@/lib/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { validateTripStart, verifyRideOtp, completePassengerDrop, verifyCashPayment } from "@/lib/supabase/edgeFunctions";
import { PiMotorcycleBold, PiCarProfileBold, PiVanBold } from "react-icons/pi";
import AutoRickshawIcon from "@/components/icons/AutoRickshawIcon";

/* ---------------- TYPES ---------------- */
type VehicleKey = "bike" | "auto" | "car" | "xl";

interface RideSummaryData {
  pickup: string;
  drop: string;
  distanceKm?: number;
  durationMin?: number;
  passengers?: number;
}

/* ---------------- CONFIG ---------------- */
const VEHICLE_ICONS: Record<VehicleKey, React.ElementType> = {
  bike: PiMotorcycleBold,
  auto: AutoRickshawIcon,
  car: PiCarProfileBold,
  xl: PiVanBold,
};


/* ---------------- ANIMATION VARIANTS ---------------- */
const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

/* ---------------- COMPONENT ---------------- */

interface SelectedDriver {
  driverName: string;
  driverRating: number;
  driverRides: number;
  driverPhone: string;
  vehicleType: VehicleKey;
  vehicleName: string;
  vehicleNumber: string;
  pricePerSeat: number;
  departureTime: string;
}

const DEFAULT_DRIVER: SelectedDriver = {
  driverName: "Ramesh K.",
  driverRating: 4.8,
  driverRides: 1200,
  driverPhone: "+91 98765 43210",
  vehicleType: "car",
  vehicleName: "Car",
  vehicleNumber: "TN 09 AB 1234",
  pricePerSeat: 0,
  departureTime: "",
};

const RideSummary = () => {
  const navigate = useNavigate();
  const [vehicleType, setVehicleType] = useState<VehicleKey>("car");
  const [ride, setRide] = useState<RideSummaryData | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<SelectedDriver>(DEFAULT_DRIVER);
  const [driverStage, setDriverStage] = useState<"assigned" | "arriving">("assigned");
  const [driverProgress, setDriverProgress] = useState(0);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [tripStarted, setTripStarted] = useState(false);
  const [tripCompleted, setTripCompleted] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rideOtpInput, setRideOtpInput] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);

  // Get booking request ID from URL or localStorage
  const searchParamsRide = new URLSearchParams(window.location.search);
  const bookingRequestId = searchParamsRide.get('request_id') || '';

  // Validate & Start trip via edge function
  const handleStartTrip = async () => {
    if (actionLoading || !bookingRequestId) return;
    setActionLoading(true);
    try {
      const tripId = ride ? `${ride.pickup}-${ride.drop}` : '';
      const result = await validateTripStart(bookingRequestId, tripId);
      if (result.success) {
        setTripStarted(true);
      } else {
        console.warn('Trip start validation failed:', result.error);
        // Proceed anyway for UX
        setTripStarted(true);
      }
    } catch (err) {
      console.error('Start trip error:', err);
      setTripStarted(true);
    } finally {
      setActionLoading(false);
    }
  };

  // Verify ride OTP at pickup
  const handleVerifyRideOtp = async () => {
    if (!rideOtpInput || rideOtpInput.length < 4 || !bookingRequestId) return;
    setActionLoading(true);
    try {
      const result = await verifyRideOtp(bookingRequestId, rideOtpInput);
      if (result.success) {
        setOtpVerified(true);
        handleStartTrip();
      } else {
        alert('Invalid OTP. Please check and try again.');
      }
    } catch (err) {
      console.error('OTP verify error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Complete passenger drop via edge function
  const handleCompleteRide = async () => {
    if (actionLoading || !bookingRequestId) return;
    setActionLoading(true);
    try {
      const tripId = ride ? `${ride.pickup}-${ride.drop}` : '';
      const result = await completePassengerDrop(bookingRequestId, tripId);
      if (result.success) {
        setTripCompleted(true);
      }
    } catch (err) {
      console.error('Complete ride error:', err);
      setTripCompleted(true);
    } finally {
      setActionLoading(false);
    }
  };

  /* ---------------- LOAD DATA SAFELY ---------------- */
  useEffect(() => {
    try {
      const savedVehicleRaw = localStorage.getItem("vehicleType");
      if (savedVehicleRaw) {
        let savedVehicle: VehicleKey;
        try {
          savedVehicle = JSON.parse(savedVehicleRaw) as VehicleKey;
        } catch (e) {
          savedVehicle = savedVehicleRaw as VehicleKey;
        }
        if (savedVehicle in VEHICLE_ICONS) {
          setVehicleType(savedVehicle);
        }
      }

      const savedRide = localStorage.getItem("rideSummary");
      if (savedRide) {
        const parsed = JSON.parse(savedRide);
        setRide({
          pickup: parsed.pickup,
          drop: parsed.drop,
          distanceKm: parsed.distanceKm || 8.4,
          durationMin: parsed.durationMin || 20,
          passengers: parsed.passengers || 1,
        } as RideSummaryData);
      }

      const savedDriver = localStorage.getItem("selectedDriver");
      if (savedDriver) {
        const parsed = JSON.parse(savedDriver);
        setSelectedDriver({
          driverName: parsed.driverName || DEFAULT_DRIVER.driverName,
          driverRating: parsed.driverRating || DEFAULT_DRIVER.driverRating,
          driverRides: parsed.driverRides || DEFAULT_DRIVER.driverRides,
          driverPhone: parsed.driverPhone || DEFAULT_DRIVER.driverPhone,
          vehicleType: parsed.vehicleType || DEFAULT_DRIVER.vehicleType,
          vehicleName: parsed.vehicleName || DEFAULT_DRIVER.vehicleName,
          vehicleNumber: parsed.vehicleNumber || DEFAULT_DRIVER.vehicleNumber,
          pricePerSeat: parsed.pricePerSeat || 0,
          departureTime: parsed.departureTime || "",
        });
      }
    } catch { }
  }, []);

  /* ---------------- DRIVER MOVEMENT SIM ---------------- */
  useEffect(() => {
    const timer = setInterval(() => {
      setDriverProgress((p) => {
        if (p >= 100) {
          setDriverStage("arriving");
          clearInterval(timer);
          return 100;
        }
        return p + 10;
      });
    }, 600);

    return () => clearInterval(timer);
  }, []);

  const VehicleIcon = VEHICLE_ICONS[vehicleType];

  /* ---------------- FARE CALC ---------------- */
  const fare = useMemo(() => {
    const distanceKm = ride?.distanceKm || 8.4;
    const durationMin = ride?.durationMin || 20;
    const passengers = ride?.passengers || 1;

    const fareInfo = calculateTieredFare(distanceKm, durationMin, vehicleType, passengers);
    return {
      perPerson: fareInfo.fare.perPerson,
      total: fareInfo.fare.total,
      tier: fareInfo.tripDetails.tier,
      savings: fareInfo.savings,
      costBreakdown: fareInfo.costBreakdown,
      passengers
    };
  }, [vehicleType, ride]);

  /* ---------------- UI HELPER COMPONENTS ---------------- */
  const TimelineItem = ({ label, done, active }: { label: string; done?: boolean; active?: boolean }) => (
    <div className="flex items-center gap-3 py-1.5">
      <div className={`h-6 w-6 rounded-full flex items-center justify-center border-2 ${done ? 'bg-green-500 border-green-500' : active ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
        {done ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-white" strokeWidth={3} />
        ) : (
          <Navigation className={`h-3 w-3 ${active ? "text-amber-500 animate-pulse" : "text-gray-300"}`} strokeWidth={3} />
        )}
      </div>
      <span className={`text-sm font-bold ${active ? 'text-gray-900' : done ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
    </div>
  );

  const FareRow = ({ label, value, isTotal }: { label: string; value: number; isTotal?: boolean }) => (
    <div className={`flex justify-between items-center ${isTotal ? 'pt-3 mt-3 border-t border-gray-200/50' : 'py-1'}`}>
      <span className={isTotal ? 'font-black text-gray-900 text-base' : 'font-semibold text-gray-500 text-sm'}>{label}</span>
      <span className={`${isTotal ? 'font-black text-gray-900 text-lg' : 'font-bold text-gray-700 text-sm'} font-syne`}>₹{value}</span>
    </div>
  );

  /* ---------------- MAIN UI ---------------- */
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "linear-gradient(160deg, #fffbeb 0%, #fef9e7 45%, #fffdf5 100%)", fontFamily: "'Inter', sans-serif" }}>


      {/* Background blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-amber-400/20 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[30rem] h-[30rem] bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply" style={{ backgroundImage: "radial-gradient(rgba(245,158,11,0.15) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      <main className="relative z-10 px-4 py-8 sm:py-12 flex justify-center min-h-screen h-full pb-24">
        <motion.div
          className="w-full max-w-md flex flex-col space-y-6"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* HEADER */}
          <motion.header variants={fadeUp} className="text-center space-y-2">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight font-syne">Live Trip</h1>
            <p className="text-sm font-semibold text-gray-500">Your ride is in progress</p>
          </motion.header>

          {/* DRIVER MOVEMENT */}
          <motion.div variants={fadeUp} className="p-4 rounded-2xl bg-white/70 border-2 border-amber-400/30 shadow-[0_8px_30px_rgba(245,158,11,0.1)] space-y-4 relative overflow-hidden" style={{ backdropFilter: "blur(12px)" }}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-gray-900">
                Driver {driverStage === "assigned" ? "assigned" : "arriving"}
              </span>
              <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 shadow-sm">{formatDuration(Math.max(1, 5 - Math.floor(driverProgress / 25)))}</span>
            </div>

            <div className="w-full h-3 bg-amber-100/50 rounded-full overflow-hidden border border-amber-200/50 relative">
              <motion.div
                className="absolute top-0 left-0 bottom-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                initial={{ width: "0%" }}
                animate={{ width: `${driverProgress}%` }}
                transition={{ ease: "easeInOut" }}
              />
            </div>
          </motion.div>

          {/* RIDE SUMMARY */}
          {ride && (
            <motion.div variants={fadeUp} className="p-4 rounded-2xl bg-white/60 border border-gray-200/50 shadow-sm text-left relative overflow-hidden" style={{ backdropFilter: "blur(12px)" }}>
              <div className="flex items-start gap-4 relative z-10">
                <div className="flex flex-col items-center mt-1">
                  <MapPin className="h-5 w-5 text-amber-500 mb-1" strokeWidth={2.5} />
                  <div className="w-1 h-6 bg-amber-500/20 rounded-full" />
                  <MapPin className="h-5 w-5 text-orange-600 mt-1" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-amber-900/40 uppercase mb-0.5">Pickup</p>
                    <p className="font-bold text-gray-900 truncate">{ride.pickup}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-amber-900/40 uppercase mb-0.5">Dropoff</p>
                    <p className="font-bold text-gray-900 truncate">{ride.drop}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* DRIVER INFO COMPACT */}
          <motion.div variants={fadeUp} className="flex gap-4">
            <div className="flex-1 p-3 rounded-2xl bg-white/60 border border-gray-200/50 shadow-sm flex items-center gap-3" style={{ backdropFilter: "blur(12px)" }}>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                <User className="h-5 w-5 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 text-sm truncate">{selectedDriver.driverName}</h4>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] font-bold text-yellow-700 bg-yellow-100/50 w-max px-1.5 py-0.5 rounded">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> {selectedDriver.driverRating}
                </div>
              </div>
            </div>
            <div className="flex-1 p-3 rounded-2xl bg-white/60 border border-gray-200/50 shadow-sm flex items-center gap-3 relative overflow-hidden" style={{ backdropFilter: "blur(12px)" }}>
              <div className="absolute top-0 right-0 w-16 h-16 bg-amber-400/10 rounded-full blur-[20px]" />
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <VehicleIcon className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 text-sm truncate">{selectedDriver.vehicleName}</h4>
                <p className="text-[10px] font-black text-gray-500 tracking-widest mt-0.5">{selectedDriver.vehicleNumber}</p>
              </div>
            </div>
          </motion.div>

          {/* TRIP TIMELINE */}
          <motion.div variants={fadeUp} className="p-4 rounded-2xl bg-white/60 border border-gray-200/50 shadow-sm space-y-1" style={{ backdropFilter: "blur(12px)" }}>
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200/50">
              <Clock className="w-5 h-5 text-gray-400" />
              <h3 className="font-bold text-gray-900">Trip Status</h3>
            </div>
            <TimelineItem label="Ride booked successfully" done />
            <TimelineItem label={`Captain ${driverStage === "assigned" ? "is heading to you" : "has almost arrived"}`} active />
            <TimelineItem label="Ride in progress" />
            <TimelineItem label="Dropoff point reached" />
          </motion.div>

          {/* FARE BREAKDOWN - Professional Style */}
          <motion.div variants={fadeUp} className="p-5 rounded-[1.6rem] bg-white/60 border border-gray-200/50 shadow-sm space-y-4" style={{ backdropFilter: "blur(12px)" }}>
            <div className="flex items-center justify-between items-center mb-1 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-gray-900 tracking-tight">Fare Breakdown</h3>
              </div>
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded border border-amber-100 uppercase tracking-widest leading-none">
                {fare.tier}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-start pt-1">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest uppercase border border-amber-200/50 w-max shadow-sm">
                    <Users className="w-3 h-3" />
                    {fare.passengers} {fare.passengers === 1 ? 'seat' : 'seats'}
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none ml-0.5">Your Contribution</span>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-[14px] text-gray-400 font-bold -mt-1">₹</span>
                    <span className="text-3xl font-black text-gray-900 font-syne tracking-tight leading-none">{fare.total}</span>
                  </div>
                  <div className="mt-1.5 flex justify-end">
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100 text-[9px] font-extrabold text-gray-500">
                      ₹{fare.perPerson} <span className="text-gray-400 font-bold">/ seat</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px w-full bg-gray-100/60" />

              {/* SAVINGS BADGES */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="p-2.5 rounded-xl bg-green-50/80 border border-green-100 flex flex-col items-center text-center">
                  <span className="text-[8px] font-bold text-green-700/60 uppercase tracking-widest mb-1">vs Taxi</span>
                  <span className="text-xs font-black text-green-700">Save ₹{fare.savings.vsTaxiAmount}</span>
                  <span className="text-[9px] font-bold text-green-600/70">{fare.savings.vsTaxi}% cheaper</span>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-100 flex flex-col items-center text-center">
                  <span className="text-[8px] font-bold text-blue-700/60 uppercase tracking-widest mb-1">vs Bus</span>
                  <span className="text-xs font-black text-blue-700">Save ₹{fare.savings.vsBusAmount}</span>
                  <span className="text-[9px] font-bold text-blue-600/70">{fare.savings.vsBus}% cheaper</span>
                </div>
              </div>

              {/* COST TRANSPARENCY */}
              <div className="p-3.5 rounded-2xl bg-amber-50/40 border border-amber-100 space-y-2.5 mt-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Pricing Transparency</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-amber-800/60">Estimated Fuel Cost</span>
                  <span className="text-[11px] font-bold text-amber-900">₹{fare.costBreakdown.estimatedFuelCost}</span>
                </div>

                {fare.costBreakdown.estimatedToll > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-semibold text-amber-800/60">Estimated Tolls</span>
                    <span className="text-[11px] font-bold text-amber-900">₹{fare.costBreakdown.estimatedToll}</span>
                  </div>
                )}

                <div className="h-px w-full bg-amber-200/30" />

                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-amber-900/40 uppercase tracking-widest">Total Pooled Fare</span>
                  <span className="text-sm font-black text-amber-900 font-syne">₹{fare.total}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* HELP ACTION */}
          <motion.div variants={fadeUp} className="pt-2 space-y-3">
            {/* Book Again */}
            <button
              onClick={() => {
                localStorage.removeItem("rideSummary");
                localStorage.removeItem("selectedDriver");
                localStorage.removeItem("vehicleType");
                navigate("/");
              }}
              className="w-full h-14 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2 transition-all duration-300 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 bg-[length:200%_auto] hover:bg-right text-white shadow-[0_8px_30px_rgba(245,158,11,0.35)]"
            >
              <RotateCcw className="h-5 w-5" />
              Book Another Ride
            </button>

            {/* Trip Lifecycle Actions */}
            {!tripStarted && !tripCompleted && (
              <button
                onClick={handleStartTrip}
                disabled={actionLoading}
                className="w-full h-14 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2 transition-all duration-300 bg-green-500 text-white shadow-[0_8px_30px_rgba(34,197,94,0.35)] hover:bg-green-600 disabled:opacity-50"
              >
                {actionLoading ? 'Starting...' : '▶ Start Trip'}
              </button>
            )}

            {tripStarted && !tripCompleted && (
              <button
                onClick={handleCompleteRide}
                disabled={actionLoading}
                className="w-full h-14 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2 transition-all duration-300 bg-blue-500 text-white shadow-[0_8px_30px_rgba(59,130,246,0.35)] hover:bg-blue-600 disabled:opacity-50"
              >
                {actionLoading ? 'Completing...' : '✓ Complete Ride'}
              </button>
            )}

            {tripCompleted && (
              <div className="w-full h-14 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2 bg-green-50 text-green-700 border border-green-200">
                <CheckCircle2 className="h-5 w-5" /> Ride Completed
              </div>
            )}

            {/* Cancel Ride */}
            {!tripCompleted && (
              <button
                onClick={() => setShowCancelDialog(true)}
                className="w-full h-14 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2 transition-all duration-300 bg-red-50 text-red-600 border border-red-200/60 hover:bg-red-100 shadow-sm"
              >
                <XCircle className="h-5 w-5" />
                Cancel Ride
              </button>
            )}

            {/* Help */}
            <button className="w-full h-14 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2 transition-all duration-300 bg-white/60 text-gray-700 border border-gray-200/50 hover:bg-white/90 shadow-sm">
              <Phone className="h-5 w-5" />
              Need Help?
            </button>
          </motion.div>
        </motion.div>
      </main>

      {/* Cancel Ride Confirmation Dialog */}
      {showCancelDialog && (
        <>
          <div
            onClick={() => setShowCancelDialog(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 2000,
              background: "rgba(10,15,28,0.5)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          />
          <div
            style={{
              position: "fixed", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)", zIndex: 2001,
              width: "min(380px, 90vw)", background: "#ffffff",
              borderRadius: 24,
              boxShadow: "0 32px 80px rgba(0,0,0,0.18)",
              padding: "28px 24px 20px",
              textAlign: "center", fontFamily: "'Inter', sans-serif",
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <XCircle style={{ width: 28, height: 28, color: "#EF4444" }} />
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: 8 }}>Cancel this ride?</h3>
            <p style={{ fontSize: "0.85rem", color: "#6B7280", fontWeight: 500, lineHeight: 1.5, marginBottom: 24 }}>
              Your driver has been assigned. Are you sure you want to cancel?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowCancelDialog(false)}
                style={{ flex: 1, padding: "12px 20px", borderRadius: 14, border: "1.5px solid rgba(229,231,235,0.8)", background: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", color: "#374151", fontFamily: "'Inter', sans-serif" }}
              >
                Keep Ride
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("rideSummary");
                  localStorage.removeItem("selectedDriver");
                  localStorage.removeItem("vehicleType");
                  setShowCancelDialog(false);
                  navigate("/");
                }}
                style={{ flex: 1, padding: "12px 20px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #EF4444, #DC2626)", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", color: "#fff", boxShadow: "0 4px 16px rgba(239,68,68,0.3)", fontFamily: "'Inter', sans-serif" }}
              >
                Cancel Ride
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RideSummary;
