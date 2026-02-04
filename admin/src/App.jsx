import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './components/AdminLogin';
import { supabase } from './supabaseClient';
import Dashboard from './components/Dashboard';
import DriverReview from './components/DriverReview';
import WithdrawalRequests from './components/WithdrawalRequests';
import AllUsers from './components/AllUsers';
import AllTrips from './components/AllTrips';

const PrivateRoute = ({ children }) => {
  const isAuth = localStorage.getItem('adminAuth') === 'true';
  return isAuth ? children : <Navigate to="/" />;
};

function App() {
  const [session, setSession] = React.useState(null);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_OUT') {
        localStorage.removeItem('adminAuth');
        window.location.href = '/';
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<AdminLogin />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/users" element={<PrivateRoute><AllUsers /></PrivateRoute>} />
        <Route path="/trips" element={<PrivateRoute><AllTrips /></PrivateRoute>} />
        <Route path="/driver/:id" element={<PrivateRoute><DriverReview /></PrivateRoute>} />
        <Route path="/withdrawals" element={<PrivateRoute><WithdrawalRequests /></PrivateRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
