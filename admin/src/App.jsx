import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AdminLogin from './components/AdminLogin';
import { supabase } from './supabaseClient';
import Dashboard from './components/Dashboard';
import DriverReview from './components/DriverReview';
import WithdrawalRequests from './components/WithdrawalRequests';
import AllUsers from './components/AllUsers';
import AllTrips from './components/AllTrips';
import LiveTracking from './components/LiveTracking';
import Settings from './components/Settings';
import Reports from './components/Reports';
import LogsPanel from './components/LogsPanel';
import AdminNotifications from './components/AdminNotifications';
import PendingDrivers from './components/PendingDrivers';
import './App.css';

// ─────────────────────────────────────────────────────────────────────────────
// Error Boundary — Gracefully catch rendering errors
// ─────────────────────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                    <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md text-center border border-gray-100">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h1 className="text-2xl font-extrabold text-gray-900 mb-3">Something went wrong</h1>
                        <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                            An unexpected error occurred. Please try refreshing the page.
                        </p>
                        <pre className="text-xs text-red-500 bg-red-50 p-3 rounded-xl mb-6 text-left overflow-auto max-h-32 border border-red-100">
                            {this.state.error?.message || 'Unknown error'}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-xl transition-colors"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private Route — Auth guard with shared credentials
// ─────────────────────────────────────────────────────────────────────────────
const PrivateRoute = ({ children, allowedRoles = [] }) => {
    const isAuth = localStorage.getItem('adminAuth') === 'true';
    const role = localStorage.getItem('adminRole') || '';

    if (!isAuth) {
        return <Navigate to="/" replace />;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

// ─────────────────────────────────────────────────────────────────────────────
// 404 Page
// ─────────────────────────────────────────────────────────────────────────────
const NotFound = () => {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-white p-6">
            <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md text-center border border-amber-100/50">
                <div className="text-7xl font-black text-amber-500 mb-4">404</div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-3">Page Not Found</h1>
                <p className="text-gray-500 mb-8 text-sm">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-amber-500/20"
                >
                    Return to Dashboard
                </button>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// App Component
// ─────────────────────────────────────────────────────────────────────────────
function App() {
    // Listen for sign-out events to clear local auth state
    React.useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                localStorage.removeItem('adminAuth');
                localStorage.removeItem('adminRole');
                localStorage.removeItem('adminName');
                localStorage.removeItem('adminEmail');
                localStorage.removeItem('adminAvatar');
                window.location.href = '/';
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <ErrorBoundary>
            <Router>
                <Toaster
                    position="top-right"
                    reverseOrder={false}
                    toastOptions={{
                        duration: 4000,
                        style: {
                            borderRadius: '14px',
                            background: '#1a1a1a',
                            color: '#fff',
                            fontSize: '13px',
                            fontWeight: '600',
                            padding: '12px 18px',
                            boxShadow: '0 15px 30px rgba(0,0,0,0.15)',
                        },
                        success: {
                            iconTheme: { primary: '#10b981', secondary: '#fff' },
                        },
                        error: {
                            iconTheme: { primary: '#ef4444', secondary: '#fff' },
                        },
                    }}
                />
                <AdminNotifications />
                <Routes>
                    <Route path="/" element={<AdminLogin />} />
                    <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                    <Route path="/users" element={<PrivateRoute allowedRoles={['super_admin', 'admin', 'support']}><AllUsers /></PrivateRoute>} />
                    <Route path="/trips" element={<PrivateRoute allowedRoles={['super_admin', 'admin', 'support']}><AllTrips /></PrivateRoute>} />
                    <Route path="/approvals" element={<PrivateRoute allowedRoles={['super_admin', 'admin']}><PendingDrivers /></PrivateRoute>} />
                    <Route path="/driver/:id" element={<PrivateRoute allowedRoles={['super_admin', 'admin']}><DriverReview /></PrivateRoute>} />
                    <Route path="/withdrawals" element={<PrivateRoute allowedRoles={['super_admin', 'admin']}><WithdrawalRequests /></PrivateRoute>} />
                    <Route path="/live-tracking" element={<PrivateRoute allowedRoles={['super_admin', 'admin', 'support']}><LiveTracking /></PrivateRoute>} />
                    <Route path="/settings" element={<PrivateRoute allowedRoles={['super_admin', 'admin']}><Settings /></PrivateRoute>} />
                    <Route path="/reports" element={<PrivateRoute allowedRoles={['super_admin', 'admin']}><Reports /></PrivateRoute>} />
                    <Route path="/logs" element={<PrivateRoute allowedRoles={['super_admin', 'admin']}><LogsPanel /></PrivateRoute>} />
                    {/* Catch-all 404 */}
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Router>
        </ErrorBoundary>
    );
}

export default App;
