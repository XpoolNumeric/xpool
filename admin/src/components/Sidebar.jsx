import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, ChevronRight, LogOut, X, Menu } from 'lucide-react';
import xpoolLogo from '../assets/xpool-logo.png';
import './Sidebar.css';

const Sidebar = ({ isOpen, setIsOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem('adminAuth');
        navigate('/');
    };

    const navItems = [
        { label: 'Pending Approvals', icon: <User size={20} />, path: '/dashboard' },
        { label: 'All Users', icon: <User size={20} />, path: '/users' },
        { label: 'All Trips', icon: <ChevronRight size={20} />, path: '/trips' },
        { label: 'Withdrawal Requests', icon: <ChevronRight size={20} />, path: '/withdrawals' },
    ];

    return (
        <>
            {/* Sidebar Overlay */}
            {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)}></div>}

            {/* Sidebar */}
            <aside className={`dashboard-sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <img src={xpoolLogo} alt="XPOOL" className="sidebar-logo" />
                    <button className="mobile-close-btn" onClick={() => setIsOpen(false)}>
                        <X size={24} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <button
                            key={item.path}
                            className={`sidebar-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                            onClick={() => {
                                navigate(item.path);
                                setIsOpen(false);
                            }}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="sidebar-logout-btn">
                        <LogOut size={18} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Mobile Header (Shows when sidebar is hidden) */}
            <header className="mobile-header">
                <button className="menu-toggle-btn" onClick={() => setIsOpen(true)}>
                    <Menu size={24} />
                </button>
                <img src={xpoolLogo} alt="XPOOL" className="header-logo-mobile" />
                <div style={{ width: 24 }}></div>
            </header>
        </>
    );
};

export default Sidebar;
