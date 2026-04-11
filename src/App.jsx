import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import { supabase } from './supabaseClient';
import { syncStateToBackend, fetchStateFromBackend } from './utils/userStateSync';
import { useNativePermissions } from './hooks/useNativePermissions';
import { App as CapacitorApp } from '@capacitor/app';

import Splash from './components/common/Splash';
import Onboarding from './components/common/Onboarding';
import RoleSelection from './components/common/RoleSelection';
import AuthSelection from './components/common/AuthSelection';
import Login from './components/common/Login';
import Signup from './components/common/Signup';
import Welcome from './components/common/Welcome';
import PhoneLogin from './components/common/PhoneLogin';

import OTPVerification from './components/common/OTPVerification';
import EmailOTPVerification from './components/common/EmailOTPVerification';

// Notification & Utilities
import { subscribeToNotifications, unsubscribeFromNotifications } from './utils/notificationHelper';
import toast from 'react-hot-toast';
import NetworkStatus from './components/common/NetworkStatus';


import PoolingSelection from './components/Driver/jsx/PoolingSelection';
import DriverDocuments from './components/Driver/jsx/DriverDocuments';
import VerificationInProgress from './components/Driver/jsx/VerificationInProgress';
import DriverWelcome from './components/Driver/jsx/DriverWelcome';

import Profile from './components/common/Profile';

// Lazy-loaded screens — only loaded when the user navigates to them
// This splits the bundle so the app starts faster and uses less memory
const PassengerHome = React.lazy(() => import('./components/Passenger/jsx/PassengerHome'));
const DriverHome = React.lazy(() => import('./components/Driver/jsx/DriverHome'));
const DriverWallet = React.lazy(() => import('./components/Driver/jsx/DriverWallet'));
const PublishTrip = React.lazy(() => import('./components/Driver/jsx/PublishTrip'));
const MyTrips = React.lazy(() => import('./components/Driver/jsx/MyTrips'));
const BookingRequests = React.lazy(() => import('./components/Driver/jsx/BookingRequests'));
const SearchTrips = React.lazy(() => import('./components/Passenger/jsx/SearchTrips'));
const TripBooking = React.lazy(() => import('./components/Passenger/jsx/TripBooking'));
const ActiveRide = React.lazy(() => import('./components/Driver/jsx/ActiveRide'));
const OTPVerificationScreen = React.lazy(() => import('./components/Driver/jsx/OTPVerificationScreen')); // Phase 3
const PassengerProfile = React.lazy(() => import('./components/Passenger/jsx/PassengerProfile'));
const PaymentDetails = React.lazy(() => import('./components/Passenger/jsx/PaymentDetails'));
const MyBookings = React.lazy(() => import('./components/Passenger/jsx/MyBookings'));
const RideHistory = React.lazy(() => import('./components/Passenger/jsx/RideHistory'));
const PassengerRideDetails = React.lazy(() => import('./components/Passenger/jsx/PassengerRideDetails'));
const PaymentScreen = React.lazy(() => import('./components/Passenger/jsx/PaymentScreen'));
const PassengerWallet = React.lazy(() => import('./components/Passenger/jsx/PassengerWallet'));

import { APIProvider } from '@vis.gl/react-google-maps';

import './App.css';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function App() {
  const [currentScreen, setCurrentScreen] = useState(() => {
    const saved = localStorage.getItem('currentScreen');
    if (!saved) return 'splash';
    const validScreens = new Set(['splash', 'onboarding', 'roleSelection', 'authSelection', 'login', 'signup', 'phoneLogin', 'otpVerification', 'emailOTPVerification', 'rideOtpVerification', 'welcome', 'poolingSelection', 'driverDocuments', 'verificationInProgress', 'driverWelcome', 'driverHome', 'driverWallet', 'publishTrip', 'myTrips', 'bookingRequests', 'activeRide', 'passengerHome', 'searchTrips', 'tripBooking', 'passengerProfile', 'passengerWallet', 'paymentDetails', 'myBookings', 'rideHistory', 'passengerRideDetails', 'paymentScreen', 'profile', 'linkGoogle']);
    return validScreens.has(saved) ? saved : 'splash';
  });

  // Request native permissions on app startup
  useNativePermissions();

  const [userRole, setUserRole] = useState(() => localStorage.getItem('userRole') || null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [isSignupFlow, setIsSignupFlow] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [session, setSession] = useState(null);
  const [passengerSearchParams, setPassengerSearchParams] = useState({
    from: '',
    to: '',
    date: '',
    vehicle: 'any'
  });
  const [paymentData, setPaymentData] = useState(null);
  const [isSessionInitializing, setIsSessionInitializing] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  // Add this function to handle invalid screens/404s
  const handleInvalidScreen = () => {
    console.log('[App] Invalid screen detected, redirecting based on role');
    if (session?.user) {
      if (userRole === 'driver') {
        // Check driver status from session or fetch it
        const checkDriverStatus = async () => {
          const backendState = await fetchStateFromBackend(session.user.id);
          if (backendState?.driverStatus === 'approved') {
            setCurrentScreen('driverHome');
          } else if (backendState?.driverStatus === 'pending') {
            setCurrentScreen('verificationInProgress');
          } else if (backendState?.driverStatus === 'suspended') {
            setCurrentScreen('driverWallet');
          } else {
            setCurrentScreen('driverDocuments');
          }
        };
        checkDriverStatus();
      } else {
        setCurrentScreen('passengerHome');
      }
    } else {
      setCurrentScreen('roleSelection');
    }
  };

  // Logout handler - simple and robust
  const handleLogout = async () => {
    console.log('[App] Logout initiated');
    const toastId = toast.loading('Logging out...');

    try {
      // FORCE Logout safely: Race against a timeout so the UI never hangs
      const { error } = await Promise.race([
        supabase.auth.signOut(),
        new Promise(resolve => setTimeout(() => resolve({ error: 'Logout timed out' }), 2000))
      ]);

      if (error) {
        console.warn('[App] Logout warning:', error);
      }

      // Kill ALL realtime subscriptions to prevent zombies across sessions
      supabase.removeAllChannels();

      // Clear state but redirect to RoleSelection
      console.log('[App] Logout successful, redirecting to RoleSelection');
      toast.success('Logged out successfully', { id: toastId });

      // Targeted removal instead of localStorage.clear() to preserve onboarding state
      localStorage.removeItem('currentScreen');
      localStorage.removeItem('userRole');
      localStorage.removeItem('xpool_manual_token');
      localStorage.removeItem('xpool-auth-token');
      sessionStorage.clear();
      setSession(null);
      setUserRole(null);
      setCurrentScreen('roleSelection');

    } catch (err) {
      console.error('[App] Logout exception:', err);
      // Fallback
      window.location.href = window.location.origin;
    }
  };

  const checkOnboardingStatus = async (user, backendState) => {
    if (!user.email) {
      setCurrentScreen('addEmailSignup');
      return false;
    }
    if (!user.phone) {
      setCurrentScreen('addPhoneLogin');
      return false;
    }
    return true;
  };

  const handleOnboardingStepComplete = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Refresh backend state
    const backendState = await fetchStateFromBackend(session.user.id);

    const isComplete = await checkOnboardingStatus(session.user, backendState);
    if (isComplete) {
      const roleToUse = userRole || backendState?.role || 'passenger';
      if (roleToUse === 'driver') {
        if (backendState?.driverStatus === 'approved') setCurrentScreen('driverHome');
        else if (backendState?.driverStatus === 'pending') setCurrentScreen('verificationInProgress');
        else if (backendState?.driverStatus === 'suspended') setCurrentScreen('driverWallet');
        else setCurrentScreen('driverDocuments');
      } else {
        setCurrentScreen('passengerHome');
      }
    }
  };

  // CRITICAL FIX: Add handleSignupSuccess function
  const handleSignupSuccess = async () => {
    try {
      console.log('handleSignupSuccess called');

      // Get fresh session after signup
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      console.log('Current session after signup:', currentSession?.user?.id);

      if (currentSession?.user) {
        // Create initial profile for the new user
        const roleToUse = userRole || currentSession.user.user_metadata?.role || 'passenger';
        const fullName = currentSession.user.user_metadata?.full_name || currentSession.user.email?.split('@')[0] || 'User';

        console.log('Creating profile for new user with role:', roleToUse);

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: currentSession.user.id,
            full_name: fullName,
            user_role: roleToUse,
            last_screen: roleToUse === 'driver' ? 'driverDocuments' : 'passengerHome',
            // For drivers, set initial status
            ...(roleToUse === 'driver' && {
              driver_status: 'pending',
              vehicle_type: 'Car' // Default, will be updated in documents screen
            })
          });

        if (profileError) {
          console.error('Error creating profile after signup:', profileError);
          // Still proceed with navigation
        }

        setUserRole(roleToUse);

        // Fetch fresh state to route properly
        const backendState = await fetchStateFromBackend(currentSession.user.id);
        const isComplete = await checkOnboardingStatus(currentSession.user, backendState);
        if (!isComplete) return; // Router takes over

        // Navigate based on role
        if (roleToUse === 'driver') {
          console.log('Navigating to driverDocuments for new driver');
          setCurrentScreen('driverDocuments');
        } else {
          console.log('Navigating to passengerHome for new passenger');
          setCurrentScreen('passengerHome');
        }
      } else {
        console.error('No session found after signup');
        // Fallback to role selection
        setCurrentScreen('roleSelection');
      }
    } catch (error) {
      console.error('Error in handleSignupSuccess:', error);
      // Fallback navigation on error
      if (userRole === 'driver') {
        setCurrentScreen('welcome');
      } else if (userRole === 'passenger') {
        setCurrentScreen('passengerHome');
      } else {
        setCurrentScreen('roleSelection');
      }
    }
  };

  // Initial Session Check & State Restoration
  useEffect(() => {
    // Listen for deep links (e.g., from Google OAuth or Email Verification)
    const listenerPromise = CapacitorApp.addListener('appUrlOpen', async (event) => {
      console.log('[App] Deep link received:', event.url);

      // Supabase's JS client will automatically parse the session from the URL
      // if detectSessionInUrl is true in the client config, 
      // but we need to ensure the App component re-evaluates auth state.
      // Often, just the redirect triggers the onAuthStateChange listener anyway.
    });

    return () => {
      listenerPromise.then(listener => {
        if (listener && listener.remove) {
          listener.remove();
        }
      });
    };
  }, []);

  useEffect(() => {
    // Safety Timeout to force Splash screen to clear
    const safetyTimeout = setTimeout(() => {
      if (isSessionInitializing) {
        console.warn('[App] Session initialization timed out! Forcing app start.');
        setIsSessionInitializing(false);
        setIsInitialLoad(false);

        // CRITICAL FIX: Also set a valid screen so the user isn't stuck
        // Use localStorage to restore what they had, or fallback to roleSelection
        const savedScreen = localStorage.getItem('currentScreen');
        const savedRole = localStorage.getItem('userRole');
        if (savedScreen && savedScreen !== 'splash') {
          console.log('[App] Timeout: Restoring saved screen:', savedScreen);
          setCurrentScreen(savedScreen);
          if (savedRole) setUserRole(savedRole);
        } else if (savedRole === 'driver') {
          setCurrentScreen('driverHome');
        } else if (savedRole === 'passenger') {
          setCurrentScreen('passengerHome');
        } else {
          setCurrentScreen('roleSelection');
        }
      }
    }, 3000); // 3 seconds max (was 5s, reduced for faster recovery)

    const initializeSession = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        console.log('[App] Session loaded:', existingSession ? 'Yes' : 'No');
        setSession(existingSession);

        if (existingSession?.user) {
          // Silent repair of onboarding flag just in case it was wiped by former clear() bug
          if (!localStorage.getItem('hasSeenOnboarding')) {
            localStorage.setItem('hasSeenOnboarding', 'true');
          }

          // Restore state from backend if user is logged in
          console.log('[App] Fetching backend state for user:', existingSession.user.id);
          const backendState = await fetchStateFromBackend(existingSession.user.id);
          console.log('[App] Backend state:', backendState);

          if (backendState) {
            if (backendState.role) setUserRole(backendState.role);

            // --- ONBOARDING INTERCEPT ---
            // Natively routes user if they are missing email/google link
            const isComplete = await checkOnboardingStatus(existingSession.user, backendState);
            if (!isComplete) {
              return;
            }

            // Build the set of FULL valid stateless screens. We exclude screens that require transient state (like selectedTrip)
            const statelessScreens = new Set([
              'driverHome', 'driverWallet', 'publishTrip', 'myTrips', 'bookingRequests', 'activeRide',
              'passengerHome', 'searchTrips', 'passengerProfile', 'passengerWallet', 'myBookings', 'rideHistory',
              'profile'
            ]);

            // We prefer the screen saved in localStorage because backend sync is debounced and could be behind
            const savedScreenLocal = localStorage.getItem('currentScreen');
            const targetScreen = savedScreenLocal && statelessScreens.has(savedScreenLocal)
              ? savedScreenLocal
              : (backendState.screen && statelessScreens.has(backendState.screen) ? backendState.screen : null);

            // Check if screen is appropriate for user role
            const isAppropriateForRole = (screen) => {
              if (backendState.role === 'driver') {
                return !screen.includes('passenger') || ['profile'].includes(screen);
              } else {
                return !screen.includes('driver') || ['profile'].includes(screen);
              }
            };

            if (targetScreen && isAppropriateForRole(targetScreen)) {
              if (backendState.role === 'driver') {
                if (backendState.driverStatus === 'suspended') {
                  setCurrentScreen('driverWallet');
                } else if (backendState.driverStatus === 'rejected') {
                  setCurrentScreen('driverDocuments');
                } else if (backendState.driverStatus === 'pending') {
                  setCurrentScreen('verificationInProgress');
                } else {
                  console.log('[App] Restoring saved driver screen:', targetScreen);
                  setCurrentScreen(targetScreen);
                }
              } else {
                console.log('[App] Restoring saved passenger screen:', targetScreen);
                setCurrentScreen(targetScreen);
              }
            } else {
              // Fallback routing
              console.log('[App] Invalid, auth, or inappropriate screen, routing to default');
              if (backendState.role === 'driver') {
                if (backendState.driverStatus === 'approved') setCurrentScreen('driverHome');
                else if (backendState.driverStatus === 'pending') setCurrentScreen('verificationInProgress');
                else if (backendState.driverStatus === 'suspended') setCurrentScreen('driverWallet');
                else setCurrentScreen('driverDocuments');
              } else {
                setCurrentScreen('passengerHome');
              }
            }
          } else {
            // No backend state, use role from localStorage or default to passenger
            console.log('[App] No backend state found, using localStorage role');
            const role = localStorage.getItem('userRole') || 'passenger';
            setUserRole(role);
            if (role === 'driver') {
              setCurrentScreen('driverDocuments');
            } else {
              setCurrentScreen('passengerHome');
            }
          }
        } else {
          // No session, check if they've seen onboarding
          console.log('[App] No session found');
          const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
          if (!hasSeenOnboarding) {
            console.log('[App] New user detected, going to onboarding');
            setCurrentScreen('onboarding');
          } else {
            console.log('[App] Existing user, going to roleSelection');
            setCurrentScreen('roleSelection');
          }
        }
      } catch (error) {
        console.error('[App] Session initialization error:', error);
        // Fallback to role selection on error
        setCurrentScreen('roleSelection');
      } finally {
        setIsSessionInitializing(false);
        setIsInitialLoad(false);
        clearTimeout(safetyTimeout);
      }
    };

    initializeSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      console.log('[App] Auth state changed:', _event, newSession?.user?.id);

      // ─── Manual Token Sync ────────────────────────────────────────────────
      // Removed manual token sync as it conflicts with Supabase native persistence

      setSession(newSession);

      // ─── TOKEN_REFRESHED: Silent background refresh on app resume ─────────
      // Supabase fires this when the app comes back from background/tab switch.
      // We only need to persist the new token — the user is already on the
      // correct screen, so we must NOT re-navigate or reset any state.
      if (_event === 'TOKEN_REFRESHED') {
        console.log('[App] Token refreshed silently — no navigation change.');
        return; // Early return: nothing else to do
      }

      // ─── SIGNED_IN: Re-hydrate user role AND navigate for Auth ─────────
      if (_event === 'SIGNED_IN' && newSession?.user) {
        let backendState = await fetchStateFromBackend(newSession.user.id);

        const authScreens = ['authSelection', 'login', 'signup', 'roleSelection', 'onboarding', 'splash'];
        const current = localStorage.getItem('currentScreen');
        const isAuthFlow = !current || authScreens.includes(current);

        // If coming from an auth screen, prioritize the role the user intentionally selected
        if (isAuthFlow) {
          console.log('[App] SIGNED_IN on auth screen → resolving role');
          const intendedRole = localStorage.getItem('userRole') || 'passenger';

          // Resolve mismatch if the user chose a different role than what is in their profile
          if (backendState?.role && backendState.role !== intendedRole) {
            console.log(`[App] Resolving role mismatch: updating backend from ${backendState.role} to intended ${intendedRole}`);
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ user_role: intendedRole })
              .eq('id', newSession.user.id);

            if (!updateError) {
              backendState = await fetchStateFromBackend(newSession.user.id);
            }
          }

          setUserRole(intendedRole);

          if (intendedRole === 'driver') {
            if (backendState?.driverStatus === 'approved') setCurrentScreen('driverHome');
            else if (backendState?.driverStatus === 'pending') setCurrentScreen('verificationInProgress');
            else if (backendState?.driverStatus === 'suspended') setCurrentScreen('driverWallet');
            else setCurrentScreen('driverDocuments');
          } else {
            setCurrentScreen('passengerHome');
          }
        } else {
          // Normal background session hydration
          if (backendState?.role) setUserRole(backendState.role);
        }
      }

      // ─── SIGNED_OUT: Full state teardown ─────────────────────────────────
      if (_event === 'SIGNED_OUT') {
        console.log('[App] SIGNED_OUT event received');
        // Targeted removal instead of localStorage.clear() to preserve onboarding state
        localStorage.removeItem('currentScreen');
        localStorage.removeItem('userRole');
        localStorage.removeItem('xpool_manual_token');
        localStorage.removeItem('xpool-auth-token');
        sessionStorage.clear();
        setUserRole(null);
        setCurrentScreen('roleSelection');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Notifications Initialization (Supabase Real-time)
  // Only re-subscribe when user ID changes (not on every token refresh)
  const currentUserId = session?.user?.id;
  useEffect(() => {
    if (!currentUserId) return;

    const sub = subscribeToNotifications(currentUserId, (notif) => {
      toast.success(notif.message, { icon: '🔔', position: 'top-right' });
    });

    return () => {
      if (sub) unsubscribeFromNotifications(sub);
    };
  }, [currentUserId]);

  // Sync state to LocalStorage and Backend (debounced)
  useEffect(() => {
    // LocalStorage (instant — cheap)
    localStorage.setItem('currentScreen', currentScreen);
    if (userRole) {
      localStorage.setItem('userRole', userRole);
    } else {
      localStorage.removeItem('userRole');
    }

    // Backend Sync (debounced — avoid flooding on rapid navigation)
    if (session?.user) {
      const syncTimer = setTimeout(() => {
        syncStateToBackend(session.user.id, currentScreen, userRole);
      }, 500);
      return () => clearTimeout(syncTimer);
    }
  }, [currentScreen, userRole, session]);

  // Stable reference via useCallback: prevents Splash.jsx from calling onFinish()
  // again on re-renders caused by session state updates during initialization.
  const handleSplashFinish = useCallback(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    setCurrentScreen(prev => {
      if (prev === 'splash') {
        return hasSeenOnboarding ? 'roleSelection' : 'onboarding';
      }
      return prev; // Guard: no-op if already past splash
    });
  }, []); // Empty deps: this function never needs to change

  const handleOnboardingFinish = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setCurrentScreen('roleSelection');
  };

  const handleRoleSelectionFinish = (role) => {
    console.log('Selected role:', role);
    setUserRole(role);
    setCurrentScreen('authSelection');
  };

  /* --- Existing Handler Updates --- */

  const handleAuthLogin = () => {
    setCurrentScreen('login');
  };

  const handleAuthSignup = () => {
    setCurrentScreen('signup');
  };

  const handlePhoneLogin = () => {
    setCurrentScreen('phoneLogin');
  };

  const handlePhoneProceed = (enteredPhone) => {
    setPhoneNumber(enteredPhone);
    setCurrentScreen('otpVerification');
  };

  // Called after a standalone phone login (not signup), reset signup flow flag
  const handlePhoneLoginProceed = (enteredPhone) => {
    setPhoneNumber(enteredPhone);
    setIsSignupFlow(false);
    setCurrentScreen('otpVerification');
  };

  // Called by Signup.jsx after supabase.auth.signUp() succeeds
  // Stores the email and routes to email OTP verification screen
  const handleSignupOTPNeeded = (email) => {
    setSignupEmail(email);
    setIsSignupFlow(true);
    setCurrentScreen('emailOTPVerification');
  };

  // Called by EmailOTPVerification.jsx after supabase.auth.verifyOtp() succeeds
  const handleEmailOTPVerified = async () => {
    toast.success('Email verified successfully!');
    setIsSignupFlow(false);
    await handleSignupSuccess();
  };

  const handleOTPVerify = async (otp) => {
    console.log('Verified OTP:', otp);
    if (isSignupFlow) {
      // Phone OTP verified as part of signup — finalize profile creation & route
      setIsSignupFlow(false);
      await handleSignupSuccess();
    } else {
      // Standalone phone login
      await handleLoginSuccess();
    }
  };

  const handleBackToAuth = () => {
    setCurrentScreen('authSelection');
  };

  const handleBackToRole = () => {
    setCurrentScreen('roleSelection');
  };

  const handleLoginSuccess = async () => {
    try {
      console.log('handleLoginSuccess called');

      // We need fresh state here because onAuthStateChange might not have finished updating everything
      // or we want to be explicit about the redirection logic post-login
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      console.log('Current session:', currentSession?.user?.id);

      if (currentSession?.user) {
        let backendState = await fetchStateFromBackend(currentSession.user.id);
        console.log('Backend state:', backendState);

        // If no backend state exists, create a profile for this user
        if (!backendState || !backendState.role) {
          console.log('No profile found, creating one...');

          // FIXED: Prioritize the currently selected role over user metadata
          // This ensures driver selection is respected during login
          const roleToUse = userRole || currentSession.user.user_metadata?.role || 'passenger';
          const fullName = currentSession.user.user_metadata?.full_name || currentSession.user.email?.split('@')[0] || 'User';

          console.log('Creating profile with role:', roleToUse, '(userRole:', userRole, ', metadata role:', currentSession.user.user_metadata?.role, ')');

          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: currentSession.user.id,
              full_name: fullName,
              user_role: roleToUse,
              last_screen: 'welcome',
              // Add driver-specific fields if role is driver
              ...(roleToUse === 'driver' && {
                driver_status: 'pending',
                vehicle_type: 'Car'
              })
            });

          if (profileError) {
            console.error('Error creating profile:', profileError);
            // If profile creation fails, use fallback navigation
            setUserRole(roleToUse);
            if (roleToUse === 'driver') {
              setCurrentScreen('welcome');
            } else {
              setCurrentScreen('passengerHome');
            }
            return;
          }

          // Fetch the newly created profile
          backendState = await fetchStateFromBackend(currentSession.user.id);
          console.log('Created profile, new backend state:', backendState);
        }

        // FIXED: Check if there's a role mismatch between selection and stored profile
        // This handles the case where user previously signed up as one role but is now logging in as another
        if (backendState?.role && userRole && backendState.role !== userRole) {
          console.warn('Role mismatch detected! Backend role:', backendState.role, 'Selected role:', userRole);
          console.log('Updating profile to match selected role:', userRole);

          // Update the profile with the newly selected role
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              user_role: userRole,
              last_screen: userRole === 'driver' ? 'welcome' : 'passengerHome'
            })
            .eq('id', currentSession.user.id);

          if (updateError) {
            console.error('Error updating role:', updateError);
          } else {
            // Refresh backend state after update
            backendState = await fetchStateFromBackend(currentSession.user.id);
            console.log('Updated backend state:', backendState);
          }
        }

        // --- NEW ONBOARDING ROUTER LOGIC ---
        const isComplete = await checkOnboardingStatus(currentSession.user, backendState);
        if (!isComplete) {
          console.log('[App] Onboarding router taking over navigation');
          return;
        }

        if (backendState?.role) {
          setUserRole(backendState.role);
          console.log('User role set to:', backendState.role);

          if (backendState.role === 'driver') {
            console.log('[handleLoginSuccess] Driver Status:', backendState.driverStatus);
            console.log('[handleLoginSuccess] Backend State:', backendState);

            if (backendState.driverStatus === 'approved') {
              console.log('✅ Navigating to driverHome (approved driver)');
              toast.success("Driver Verified! Redirecting to Home...", { id: 'driver-verified' });
              setCurrentScreen('driverHome');
            } else if (backendState.driverStatus === 'pending') {
              console.log('⏳ Driver verification pending');
              setCurrentScreen('verificationInProgress');
            } else if (backendState.driverStatus === 'suspended') {
              console.log('❌ Driver suspended (negative wallet balance) -> Navigating to driverWallet');
              setCurrentScreen('driverWallet');
            } else {
              // Rejected, Unknown, or New Driver -> Document Upload
              console.log('❌ Driver not approved (status: ' + backendState.driverStatus + ') -> Navigating to driverDocuments');
              setCurrentScreen('driverDocuments');
            }
          } else {
            // Passenger logic
            const safePassengerScreens = ['passengerHome', 'passengerProfile', 'paymentDetails', 'myBookings', 'rideHistory', 'profile'];
            if (backendState.screen && safePassengerScreens.includes(backendState.screen)) {
              console.log('Navigating to saved screen:', backendState.screen);
              setCurrentScreen(backendState.screen);
            } else {
              console.log('Navigating to passengerHome');
              setCurrentScreen('passengerHome');
            }
          }
        } else {
          // Fallbacks if no backend state - use the role from role selection
          console.log('No backend role found, using userRole:', userRole);
          if (userRole === 'driver') {
            console.log('Navigating to driverDocuments (driver, no backend state)');
            setCurrentScreen('driverDocuments');
          } else if (userRole === 'passenger') {
            console.log('Navigating to passengerHome (passenger, no backend state)');
            setCurrentScreen('passengerHome');
          } else {
            console.log('Navigating to passengerHome (no role)');
            setCurrentScreen('passengerHome');
          }
        }
      } else {
        // Should not happen if confirmed logged in
        console.log('No session found, using fallback navigation');
        if (userRole === 'driver') {
          setCurrentScreen('welcome');
        } else if (userRole === 'passenger') {
          setCurrentScreen('passengerHome');
        } else {
          setCurrentScreen('welcome');
        }
      }
    } catch (error) {
      console.error('Error in handleLoginSuccess:', error);
      // Fallback navigation on error
      if (userRole === 'driver') {
        setCurrentScreen('welcome');
      } else if (userRole === 'passenger') {
        setCurrentScreen('passengerHome');
      } else {
        setCurrentScreen('welcome');
      }
    }
  };

  // Modified to handle redirection based on role
  const handleWelcomeGetStarted = () => {
    if (userRole === 'driver') {
      setCurrentScreen('poolingSelection');
    } else {
      setCurrentScreen('passengerHome');
    }
  };

  /* --- New Handlers for Driver Flow --- */

  const handlePoolingConfirm = (option) => {
    console.log('Pooling Option Selected:', option);
    // You might want to save this to state/backend
    setCurrentScreen('driverDocuments');
  };

  const handleDocumentsComplete = () => {
    setCurrentScreen('verificationInProgress');
  };

  const handleVerificationConfirm = () => {
    setCurrentScreen('driverWelcome');
  };

  const handleBackToWelcome = () => {
    console.log('Navigating back to Welcome');
    setCurrentScreen('welcome');
  };

  const handleBackToPooling = () => {
    console.log('Navigating back to Pooling Selection');
    setCurrentScreen('poolingSelection');
  };

  /* --- Render --- */
  // Suspense fallback for lazy-loaded screens
  const lazyFallback = (
    <div className="loading-overlay">
      <div className="loading-spinner"></div>
      <p className="loading-text">Loading...</p>
    </div>
  );

  // Check if we're on a full-screen page (onboarding/splash)
  const isFullScreenPage = currentScreen === 'splash' || currentScreen === 'onboarding' || isSessionInitializing;

  const appContent = (
    <>
      {/* ── Full-screen pages (onboarding, splash) ── */}
      {isFullScreenPage && (
        <div className="app-fullscreen">
          <NetworkStatus />
          <Toaster position="top-center" reverseOrder={false} />
          {(currentScreen === 'splash' || isSessionInitializing) && (
            <Splash
              onFinish={handleSplashFinish}
              isReady={!isSessionInitializing}
            />
          )}
          {currentScreen === 'onboarding' && <Onboarding onFinish={handleOnboardingFinish} />}
        </div>
      )}

      {/* ── Mobile app container (all other screens) ── */}
      {!isFullScreenPage && (
        <div className="app-container">

          <NetworkStatus />
          <Toaster position="top-center" reverseOrder={false} />

          {currentScreen === 'roleSelection' && <RoleSelection onFinish={handleRoleSelectionFinish} />}

          {currentScreen === 'authSelection' && (
            <AuthSelection
              onLogin={handleAuthLogin}
              onSignup={handleAuthSignup}
              onPhoneLogin={handlePhoneLogin}
              onBack={handleBackToRole}
            />
          )}

          {currentScreen === 'login' && (
            <Login
              onBack={handleBackToAuth}
              onSignupClick={handleAuthSignup}
              onLoginSuccess={handleLoginSuccess}
              role={userRole}
            />
          )}

          {currentScreen === 'signup' && (
            <Signup
              onBack={handleBackToAuth}
              onLoginClick={handleAuthLogin}
              onSignupOTPNeeded={handleSignupOTPNeeded}
              role={userRole}
            />
          )}

          {currentScreen === 'emailOTPVerification' && (
            <EmailOTPVerification
              email={signupEmail}
              onVerified={handleEmailOTPVerified}
              onBack={() => setCurrentScreen('signup')}
            />
          )}

          {currentScreen === 'phoneLogin' && (
            <PhoneLogin
              onBack={isSignupFlow ? () => setCurrentScreen('emailOTPVerification') : handleBackToAuth}
              onProceed={isSignupFlow ? handlePhoneProceed : handlePhoneLoginProceed}
              isSignupFlow={isSignupFlow}
              role={userRole}
            />
          )}

          {currentScreen === 'otpVerification' && (
            <OTPVerification
              phoneNumber={phoneNumber}
              onBack={() => setCurrentScreen('phoneLogin')}
              onVerify={handleOTPVerify}
              isSignupFlow={isSignupFlow}
            />
          )}

          {currentScreen === 'addEmailSignup' && (
            <Signup
              isAddMode={true}
              onBack={handleLogout}
              onSignupOTPNeeded={(email) => {
                setSignupEmail(email);
                setCurrentScreen('addEmailOTPVerification');
              }}
              role={userRole}
            />
          )}

          {currentScreen === 'addEmailOTPVerification' && (
            <EmailOTPVerification
              isAddMode={true}
              email={signupEmail}
              onBack={() => setCurrentScreen('addEmailSignup')}
              onVerified={handleSignupSuccess}
            />
          )}

          {currentScreen === 'addPhoneLogin' && (
            <PhoneLogin
              isAddMode={true}
              onBack={handleLogout}
              onProceed={(phone) => {
                setPhoneNumber(phone);
                setCurrentScreen('addOTPVerification');
              }}
            />
          )}

          {currentScreen === 'addOTPVerification' && (
            <OTPVerification
              isAddMode={true}
              phoneNumber={phoneNumber}
              onBack={() => setCurrentScreen('addPhoneLogin')}
              onVerify={handleOnboardingStepComplete}
            />
          )}

          {currentScreen === 'welcome' && (
            <Welcome
              onGetStarted={handleWelcomeGetStarted}
              onBack={handleBackToRole}
            />
          )}

          {/* --- Driver Onboarding Screens --- */}

          {currentScreen === 'poolingSelection' && (
            <PoolingSelection
              onConfirm={handlePoolingConfirm}
              onBack={() => setCurrentScreen('welcome')}
            />
          )}

          {currentScreen === 'driverDocuments' && (
            <DriverDocuments
              selectedVehicle="Car" // Dynamic in future
              onBack={handleBackToPooling}
              onComplete={handleDocumentsComplete}
              onLogout={handleLogout}
              session={session} // ADDED: Pass session for uploads
            />
          )}

          {currentScreen === 'verificationInProgress' && !isSessionInitializing && (
            <VerificationInProgress
              onConfirm={handleVerificationConfirm}
              onLogout={handleLogout}
              session={session} // ADDED: Pass session
            />
          )}

          {/* Lazy-loaded screens wrapped in Suspense */}
          <Suspense fallback={lazyFallback}>

            {currentScreen === 'driverWelcome' && !isSessionInitializing && (
              <DriverWelcome onContinue={() => setCurrentScreen('driverHome')} />
            )}

            {/* --- Driver Dashboard Screens --- */}

            {currentScreen === 'driverHome' && !isSessionInitializing && (
              <DriverHome
                session={session}
                onNavigate={(screen) => setCurrentScreen(screen)}
                onLogout={handleLogout}
              />
            )}

            {currentScreen === 'driverWallet' && (
              <DriverWallet
                onBack={() => setCurrentScreen('driverHome')}
                session={session} // ADDED: Pass session for wallet data
              />
            )}

            {currentScreen === 'publishTrip' && (
              <PublishTrip
                onBack={() => setCurrentScreen('driverHome')}
                onSuccess={() => setCurrentScreen('myTrips')}
                onLogout={handleLogout}
                session={session} // ADDED: Pass session for trip creation
              />
            )}

            {currentScreen === 'myTrips' && (
              <MyTrips
                onBack={() => setCurrentScreen('driverHome')}
                onRideStart={(trip) => {
                  setSelectedTrip(trip);
                  setCurrentScreen('rideOtpVerification');
                }}
                session={session} // ADDED: Pass session for trip data
              />
            )}

            {currentScreen === 'bookingRequests' && (
              <BookingRequests
                onBack={() => setCurrentScreen('driverHome')}
                session={session} // ADDED: Pass session for booking data
              />
            )}

            {currentScreen === 'rideOtpVerification' && selectedTrip && (
              <OTPVerificationScreen
                trip={selectedTrip}
                onBack={() => setCurrentScreen('myTrips')}
                onVerified={() => setCurrentScreen('activeRide')}
              />
            )}

            {currentScreen === 'activeRide' && selectedTrip && (
              <ActiveRide
                trip={selectedTrip}
                onBack={() => setCurrentScreen('driverHome')}
                onComplete={() => {
                  setSelectedTrip(null);
                  setCurrentScreen('driverHome');
                }}
                onLogout={handleLogout}
                session={session} // ADDED: Pass session for ride updates
              />
            )}

            {(currentScreen === 'passengerHome' || currentScreen === 'searchTrips') && !isSessionInitializing && (
              <PassengerHome
                onBack={() => setCurrentScreen('welcome')}
                searchParams={passengerSearchParams}
                setSearchParams={setPassengerSearchParams}
                onSearchTrips={(params) => {
                  setPassengerSearchParams(params);
                  setCurrentScreen('searchTrips');
                }}
                onNavigate={(screen) => {
                  if (screen === 'logout') {
                    handleLogout();
                  } else {
                    setCurrentScreen(screen);
                  }
                }}
                onLogout={handleLogout}
                session={session}
                isSearchOverlayActive={currentScreen === 'searchTrips'}
              />
            )}

            {/* --- Passenger Trip Search Screens --- */}

            {currentScreen === 'searchTrips' && (
              <SearchTrips
                onBack={() => setCurrentScreen('passengerHome')}
                searchParams={passengerSearchParams}
                onTripSelect={(trip) => {
                  setSelectedTrip(trip);
                  setCurrentScreen('tripBooking');
                }}
                session={session}
              />
            )}

            {currentScreen === 'tripBooking' && selectedTrip && (
              <TripBooking
                trip={selectedTrip}
                onBack={() => setCurrentScreen('searchTrips')}
                onSuccess={() => {
                  setSelectedTrip(null);
                  setCurrentScreen('myBookings');
                }}
                session={session} // ADDED: Pass session for booking
              />
            )}

            {/* --- New Passenger Pages --- */}

            {currentScreen === 'passengerProfile' && (
              <PassengerProfile
                onBack={() => setCurrentScreen('passengerHome')}
                onLogout={handleLogout} // Uses robust handler: clears localStorage, state, and all realtime channels
                session={session}
              />
            )}

            {currentScreen === 'passengerWallet' && (
              <PassengerWallet
                onBack={() => setCurrentScreen('passengerHome')}
              />
            )}

            {currentScreen === 'paymentDetails' && (
              <PaymentDetails
                onBack={() => setCurrentScreen('passengerHome')}
                session={session} // ADDED: Pass session
              />
            )}

            {currentScreen === 'myBookings' && (
              <MyBookings
                onBack={() => setCurrentScreen('passengerHome')}
                onViewDetails={(booking) => {
                  setSelectedTrip(booking);
                  setCurrentScreen('passengerRideDetails');
                }}
                onPaymentRequired={(data) => {
                  setPaymentData(data);
                  setCurrentScreen('paymentScreen');
                }}
                session={session} // ADDED: Pass session
              />
            )}

            {currentScreen === 'rideHistory' && (
              <RideHistory
                onBack={() => setCurrentScreen('passengerHome')}
                onViewDetails={(ride) => {
                  setSelectedTrip(ride);
                  setCurrentScreen('passengerRideDetails');
                }}
                session={session} // ADDED: Pass session
              />
            )}

            {currentScreen === 'passengerRideDetails' && selectedTrip && (
              <PassengerRideDetails
                booking={selectedTrip}
                onBack={() => setCurrentScreen(selectedTrip.status === 'completed' ? 'rideHistory' : 'myBookings')}
                onPaymentRequired={(data) => {
                  setPaymentData(data);
                  setCurrentScreen('paymentScreen');
                }}
                session={session} // ADDED: Pass session
              />
            )}

            {currentScreen === 'paymentScreen' && paymentData && (
              <PaymentScreen
                paymentData={paymentData}
                onBack={() => setCurrentScreen('myBookings')}
                onPaymentComplete={() => setCurrentScreen('rideHistory')}
              />
            )}

            {currentScreen === 'profile' && (
              <Profile
                session={session}
                onBack={() => setCurrentScreen(userRole === 'driver' ? 'driverHome' : 'passengerHome')}
                onLogout={handleLogout}
              />
            )}
          </Suspense>
          {/* Duplicate Splash removed — handled at line 672 */}

        </div>
      )}
    </>
  );

  return API_KEY && API_KEY.trim() !== '' ? (
    <APIProvider apiKey={API_KEY} libraries={['places', 'geometry', 'marker']}>
      {appContent}
    </APIProvider>
  ) : (


    appContent
  );
}

export default App;