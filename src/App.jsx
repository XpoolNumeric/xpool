import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { supabase } from './supabaseClient';
import { syncStateToBackend, fetchStateFromBackend } from './utils/userStateSync';

import Splash from './components/common/Splash';
import Onboarding from './components/common/Onboarding';
import RoleSelection from './components/common/RoleSelection';
import AuthSelection from './components/common/AuthSelection';
import Login from './components/common/Login';
import Signup from './components/common/Signup';
import Welcome from './components/common/Welcome';
import PhoneLogin from './components/common/PhoneLogin';

import OTPVerification from './components/common/OTPVerification';

// Notification & Utilities
import { subscribeToNotifications, unsubscribeFromNotifications } from './utils/notificationHelper';
import toast from 'react-hot-toast';
import NetworkStatus from './components/common/NetworkStatus';
import DebugConsole from './components/common/DebugConsole';

import PoolingSelection from './components/Driver/jsx/PoolingSelection';
import DriverDocuments from './components/Driver/jsx/DriverDocuments';
import VerificationInProgress from './components/Driver/jsx/VerificationInProgress';
import DriverWelcome from './components/Driver/jsx/DriverWelcome';
import PassengerHome from './components/Passenger/jsx/PassengerHome';

import Profile from './components/common/Profile';

// New Trip Publishing Components
import DriverHome from './components/Driver/jsx/DriverHome';
import DriverWallet from './components/Driver/jsx/DriverWallet';
import PublishTrip from './components/Driver/jsx/PublishTrip';
import MyTrips from './components/Driver/jsx/MyTrips';
import BookingRequests from './components/Driver/jsx/BookingRequests';
import SearchTrips from './components/Passenger/jsx/SearchTrips';
import TripBooking from './components/Passenger/jsx/TripBooking';
import ActiveRide from './components/Driver/jsx/ActiveRide';

// New Passenger Components
import PassengerProfile from './components/Passenger/jsx/PassengerProfile';
import PaymentDetails from './components/Passenger/jsx/PaymentDetails';
import MyBookings from './components/Passenger/jsx/MyBookings';
import RideHistory from './components/Passenger/jsx/RideHistory';
import PassengerRideDetails from './components/Passenger/jsx/PassengerRideDetails';

import { APIProvider } from '@vis.gl/react-google-maps';

import './App.css';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function App() {
  const [currentScreen, setCurrentScreen] = useState(() => {
    const saved = localStorage.getItem('currentScreen');
    if (!saved) return 'splash';
    const validScreens = new Set(['splash', 'onboarding', 'roleSelection', 'authSelection', 'login', 'signup', 'phoneLogin', 'otpVerification', 'welcome', 'poolingSelection', 'driverDocuments', 'verificationInProgress', 'driverWelcome', 'driverHome', 'driverWallet', 'publishTrip', 'myTrips', 'bookingRequests', 'activeRide', 'passengerHome', 'searchTrips', 'tripBooking', 'passengerProfile', 'paymentDetails', 'myBookings', 'rideHistory', 'passengerRideDetails', 'profile']);
    return validScreens.has(saved) ? saved : 'splash';
  });
  const [userRole, setUserRole] = useState(() => localStorage.getItem('userRole') || null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [session, setSession] = useState(null);
  const [passengerSearchParams, setPassengerSearchParams] = useState({
    from: '',
    to: '',
    date: '',
    vehicle: 'any'
  });
  const [isSessionInitializing, setIsSessionInitializing] = useState(true);

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
    // Safety Timeout to force Splash screen to clear
    const safetyTimeout = setTimeout(() => {
      if (isSessionInitializing) {
        console.warn('[App] Session initialization timed out! Forcing app start.');
        setIsSessionInitializing(false);
      }
    }, 5000); // 5 seconds max

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
        setSession(existingSession);

        if (existingSession?.user) {
          // Restore state from backend if user is logged in
          const backendState = await fetchStateFromBackend(existingSession.user.id);
          if (backendState) {
            if (backendState.role) setUserRole(backendState.role);

            // Priority Check: Driver Status
            if (backendState.role === 'driver' && backendState.driverStatus === 'approved') {
              setCurrentScreen('driverHome');
            }
            // Smart redirection check
            else if (['login', 'signup', 'authSelection', 'roleSelection', 'splash', 'onboarding'].includes(backendState.screen)) {
              if (backendState.role === 'driver') setCurrentScreen('driverHome');
              else if (backendState.role === 'passenger') setCurrentScreen('passengerHome');
              else setCurrentScreen(backendState.screen);
            } else {
              if (backendState.role === 'driver' && backendState.driverStatus === 'rejected') {
                setCurrentScreen('driverDocuments');
              } else {
                setCurrentScreen(backendState.screen || 'welcome');
              }
            }
          }
        }
      } catch (error) {
        console.error('[App] Session initialization error:', error);
      } finally {
        setIsSessionInitializing(false);
        clearTimeout(safetyTimeout);
      }
    };

    initializeSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      // Manual Token Sync
      if (newSession) {
        localStorage.setItem('xpool_manual_token', JSON.stringify({
          access_token: newSession.access_token,
          refresh_token: newSession.refresh_token
        }));
      } else if (!newSession && _event === 'SIGNED_OUT') {
        localStorage.removeItem('xpool_manual_token');
      }

      setSession(newSession);
      if (_event === 'SIGNED_IN' && newSession?.user) {
        // Refetch implementation in case of fresh login
        const backendState = await fetchStateFromBackend(newSession.user.id);
        if (backendState?.role) setUserRole(backendState.role);
      }
      if (_event === 'SIGNED_OUT') {
        console.log('[App] SIGNED_OUT event received');
        localStorage.clear();
        sessionStorage.clear();
        setTimeout(() => {
          window.location.href = window.location.origin;
        }, 100);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Notifications Initialization (Supabase Real-time)
  useEffect(() => {
    if (session?.user) {
      const initNotifications = () => {
        // Subscribe to Real-time Notifications (DB table)
        const sub = subscribeToNotifications(session.user.id, (notif) => {
          toast.success(notif.message, { icon: '🔔', position: 'top-right' });
        });

        return sub;
      };

      const subscription = initNotifications();

      return () => {
        if (subscription) unsubscribeFromNotifications(subscription);
      };
    }
  }, [session]);

  // Sync state to LocalStorage and Backend
  useEffect(() => {
    // LocalStorage
    localStorage.setItem('currentScreen', currentScreen);
    if (userRole) {
      localStorage.setItem('userRole', userRole);
    } else {
      localStorage.removeItem('userRole');
    }

    // Backend Sync
    if (session?.user) {
      // Avoid syncing transient states if desired, but user wants "exact progress"
      syncStateToBackend(session.user.id, currentScreen, userRole);
    }
  }, [currentScreen, userRole, session]);

  const handleSplashFinish = () => {
    setCurrentScreen('onboarding');
  };

  const handleOnboardingFinish = () => {
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

  const handleOTPVerify = (otp) => {
    console.log('Verified OTP:', otp);
    // Mock verification success
    setCurrentScreen('welcome');
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
            if (backendState.screen && !['login', 'signup', 'authSelection'].includes(backendState.screen)) {
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
            console.log('Navigating to welcome (driver, no backend state)');
            setCurrentScreen('welcome');
          } else if (userRole === 'passenger') {
            console.log('Navigating to passengerHome (passenger, no backend state)');
            setCurrentScreen('passengerHome');
          } else {
            console.log('Navigating to welcome (no role)');
            setCurrentScreen('welcome');
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
  const appContent = (
    <div className="app-container">
      <DebugConsole />
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
          onSignupSuccess={handleSignupSuccess} // ADDED THIS LINE - CRITICAL FIX
          role={userRole}
        />
      )}

      {currentScreen === 'phoneLogin' && (
        <PhoneLogin
          onBack={handleBackToAuth}
          onProceed={handlePhoneProceed}
        />
      )}

      {currentScreen === 'otpVerification' && (
        <OTPVerification
          phoneNumber={phoneNumber}
          onBack={handlePhoneLogin}
          onVerify={handleOTPVerify}
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

      {currentScreen === 'driverWelcome' && !isSessionInitializing && (
        <DriverWelcome onContinue={() => setCurrentScreen('driverHome')} />
      )}

      {/* --- Driver Dashboard Screens --- */}

      {currentScreen === 'driverHome' && !isSessionInitializing && (
        <DriverHome
          session={session}
          onPublishTrip={() => setCurrentScreen('publishTrip')}
          onMyTrips={() => setCurrentScreen('myTrips')}
          onBookingRequests={() => setCurrentScreen('bookingRequests')}
          onProfile={() => setCurrentScreen('profile')}
          onWallet={() => setCurrentScreen('driverWallet')}
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
            setCurrentScreen('activeRide');
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

      {currentScreen === 'activeRide' && selectedTrip && (
        <ActiveRide
          tripId={selectedTrip.id}
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
          onLogout={() => {
            supabase.auth.signOut();
          }}
          session={session} // ADDED: Pass session
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
          session={session} // ADDED: Pass session
        />
      )}

      {currentScreen === 'profile' && (
        <Profile
          session={session}
          onBack={() => setCurrentScreen(userRole === 'driver' ? 'driverHome' : 'passengerHome')}
          onLogout={handleLogout}
        />
      )}

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
