import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import { supabase } from './supabaseClient';
import { syncStateToBackend, fetchStateFromBackend } from './utils/userStateSync';
import { useNativePermissions } from './hooks/useNativePermissions';

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

import LinkGoogle from './components/common/LinkGoogle';

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

import { APIProvider } from '@vis.gl/react-google-maps';

import './App.css';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function App() {
  const [currentScreen, setCurrentScreen] = useState(() => {
    const saved = localStorage.getItem('currentScreen');
    if (!saved) return 'splash';
    const validScreens = new Set(['splash', 'onboarding', 'roleSelection', 'authSelection', 'login', 'signup', 'phoneLogin', 'otpVerification', 'emailOTPVerification', 'rideOtpVerification', 'welcome', 'poolingSelection', 'driverDocuments', 'verificationInProgress', 'driverWelcome', 'driverHome', 'driverWallet', 'publishTrip', 'myTrips', 'bookingRequests', 'activeRide', 'passengerHome', 'searchTrips', 'tripBooking', 'passengerProfile', 'paymentDetails', 'myBookings', 'rideHistory', 'passengerRideDetails', 'paymentScreen', 'profile', 'linkGoogle']);
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

      localStorage.clear();
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
    // If a user logs in via Phone, they won't have an email until they link Google.
    // Google/Email auth natively provide an email.
    if (!user.email) {
      setCurrentScreen('linkGoogle');
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
  // Initial Session Check & State Restoration
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
        // [Manual Restore] Process manual token if exists
        const manualToken = localStorage.getItem('xpool_manual_token');
        if (manualToken) {
          console.log('[App] Found manual token. Claiming it to prevent loops...');
          // Remove the token immediately to prevent infinite reload loops if this crashes
          localStorage.removeItem('xpool_manual_token');

          try {
            // Attempt to parse the JSON bundle (v2.1)
            let tokenBundle;
            try {
              tokenBundle = JSON.parse(manualToken);
            } catch (e) {
              // Fallback for old simple refresh token format (v2.0)
              tokenBundle = { refresh_token: manualToken };
            }

            const { data, error } = await supabase.auth.setSession(tokenBundle);

            if (!error && data?.session) {
              console.log('[App] Manual restore success');
              // Only write it back if successful
              localStorage.setItem('xpool_manual_token', JSON.stringify({
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token
              }));
            } else {
              console.warn('[App] Manual restore failed, attempting refresh...', error);

              // Fallback: If setSession fails, try refreshing
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

              if (!refreshError && refreshData?.session) {
                console.log('[App] Session refresh successful');
                localStorage.setItem('xpool_manual_token', JSON.stringify({
                  access_token: refreshData.session.access_token,
                  refresh_token: refreshData.session.refresh_token
                }));
              } else {
                console.error('[App] Complete session restoration failed');
                // Do NOT write the token back, it's dead
              }
            }
          } catch (e) {
            console.error('[App] Manual restore error:', e);
          }
        }

        const { data: { session: existingSession } } = await supabase.auth.getSession();
        console.log('[App] Session loaded:', existingSession ? 'Yes' : 'No');
        setSession(existingSession);

        if (existingSession?.user) {
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

            // Validate if the saved screen is valid for this user
            const validScreens = new Set([
              'splash', 'onboarding', 'roleSelection', 'authSelection', 'login',
              'signup', 'phoneLogin', 'otpVerification', 'emailOTPVerification', 'rideOtpVerification', 'welcome', 'poolingSelection',
              'driverDocuments', 'verificationInProgress', 'driverWelcome', 'driverHome',
              'driverWallet', 'publishTrip', 'myTrips', 'bookingRequests', 'activeRide',
              'passengerHome', 'searchTrips', 'tripBooking', 'passengerProfile',
              'paymentDetails', 'myBookings', 'rideHistory', 'passengerRideDetails', 'profile'
            ]);

            // Check if saved screen is valid
            const isValidScreen = backendState.screen && validScreens.has(backendState.screen);

            // Check if screen is appropriate for user role
            const isAppropriateForRole = () => {
              if (!backendState.screen) return false;
              if (backendState.role === 'driver') {
                return !backendState.screen.includes('passenger') ||
                  ['profile'].includes(backendState.screen);
              } else {
                return !backendState.screen.includes('driver') ||
                  ['profile'].includes(backendState.screen);
              }
            };

            // Priority Check: Driver Status
            if (backendState.role === 'driver' && backendState.driverStatus === 'approved') {
              console.log('[App] Approved driver, setting screen to driverHome');
              setCurrentScreen('driverHome');
            }
            // Smart redirection check
            else if (['login', 'signup', 'authSelection', 'roleSelection', 'splash', 'onboarding'].includes(backendState.screen)) {
              if (backendState.role === 'driver') {
                console.log('[App] Driver on auth screen, redirecting to driverHome');
                setCurrentScreen('driverHome');
              } else if (backendState.role === 'passenger') {
                console.log('[App] Passenger on auth screen, redirecting to passengerHome');
                setCurrentScreen('passengerHome');
              } else {
                setCurrentScreen(backendState.screen);
              }
            }
            // Only restore if screen is valid AND appropriate for role
            else if (isValidScreen && isAppropriateForRole()) {
              if (backendState.role === 'driver' && backendState.driverStatus === 'rejected') {
                console.log('[App] Rejected driver, setting to driverDocuments');
                setCurrentScreen('driverDocuments');
              } else {
                console.log('[App] Restoring saved screen:', backendState.screen);
                setCurrentScreen(backendState.screen || 'welcome');
              }
            }
            // If invalid screen, use role-based fallback
            else {
              console.log('[App] Invalid or inappropriate screen detected, using role-based fallback');
              if (backendState.role === 'driver') {
                if (backendState.driverStatus === 'approved') {
                  setCurrentScreen('driverHome');
                } else if (backendState.driverStatus === 'pending') {
                  setCurrentScreen('verificationInProgress');
                } else {
                  setCurrentScreen('driverDocuments');
                }
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
      if (newSession) {
        localStorage.setItem('xpool_manual_token', JSON.stringify({
          access_token: newSession.access_token,
          refresh_token: newSession.refresh_token
        }));
      } else if (!newSession && _event === 'SIGNED_OUT') {
        localStorage.removeItem('xpool_manual_token');
      }

      setSession(newSession);

      // ─── TOKEN_REFRESHED: Silent background refresh on app resume ─────────
      // Supabase fires this when the app comes back from background/tab switch.
      // We only need to persist the new token — the user is already on the
      // correct screen, so we must NOT re-navigate or reset any state.
      if (_event === 'TOKEN_REFRESHED') {
        console.log('[App] Token refreshed silently — no navigation change.');
        return; // Early return: nothing else to do
      }

      // ─── SIGNED_IN: Re-hydrate user role AND navigate for OAuth ─────────
      if (_event === 'SIGNED_IN' && newSession?.user) {
        const backendState = await fetchStateFromBackend(newSession.user.id);
        if (backendState?.role) setUserRole(backendState.role);

        // If user is on an auth screen, they just finished OAuth → route to home
        const authScreens = ['authSelection', 'login', 'signup', 'roleSelection', 'linkGoogle', 'onboarding', 'splash'];
        const current = localStorage.getItem('currentScreen');
        if (!current || authScreens.includes(current)) {
          console.log('[App] OAuth SIGNED_IN on auth screen → routing to home');
          const role = backendState?.role || localStorage.getItem('userRole') || 'passenger';
          setUserRole(role);
          if (role === 'driver') {
            if (backendState?.driverStatus === 'approved') setCurrentScreen('driverHome');
            else if (backendState?.driverStatus === 'pending') setCurrentScreen('verificationInProgress');
            else setCurrentScreen('driverDocuments');
          } else {
            setCurrentScreen('passengerHome');
          }
        }
      }

      // ─── SIGNED_OUT: Full state teardown ─────────────────────────────────
      if (_event === 'SIGNED_OUT') {
        console.log('[App] SIGNED_OUT event received');
        localStorage.clear();
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
            } else {
              // Rejected, Unknown, or New Driver -> Document Upload
              console.log('❌ Driver not approved (status: ' + backendState.driverStatus + ') -> Navigating to driverDocuments');
              setCurrentScreen('driverDocuments');
            }
          } else {
            // Passenger logic
            if (backendState.screen && !['login', 'signup', 'authSelection', 'linkGoogle'].includes(backendState.screen)) {
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

  const appContent = (
    <div className="app-container">

      <NetworkStatus />
      <Toaster position="top-center" reverseOrder={false} />

      {/* Loading / Splash Logic */}
      {(currentScreen === 'splash' || isSessionInitializing) && (
        <Splash
          onFinish={handleSplashFinish}
          isReady={!isSessionInitializing}
        />
      )}
      {currentScreen === 'onboarding' && <Onboarding onFinish={handleOnboardingFinish} />}
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

      {currentScreen === 'linkGoogle' && (
        <LinkGoogle />
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

        {currentScreen === 'passengerHome' && !isSessionInitializing && (
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
            session={session} // ADDED: Pass session
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
            session={session} // ADDED: Pass session
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
            onPaymentComplete={() => setCurrentScreen('myBookings')}
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
  );

  return API_KEY && API_KEY.trim() !== '' ? (
    <APIProvider apiKey={API_KEY} libraries={['places', 'geometry']}>
      {appContent}
    </APIProvider>
  ) : (
    appContent
  );
}

export default App;