import React, { useState } from 'react';
import Sidebar from '../Sidebar';
import GlobalStyles from './GlobalStyles';
import PulseBackground from './PulseBackground';

/**
 * PageLayout — Shared layout wrapper for all admin pages.
 * Handles sidebar state, background gradient, animations, and content spacing.
 *
 * Props:
 *   - color: 'amber' | 'blue' | 'emerald' | 'purple' — theme for background blobs
 *   - gradient: CSS gradient string for the background
 *   - fullscreen: if true, skip max-w + padding (for map/live-tracking pages)
 *   - children: receives ({ sidebarOpen }) so child can react to sidebar state
 */

const GRADIENTS = {
    amber:   'linear-gradient(160deg, #fffbeb 0%, #fef9e7 45%, #fffdf5 100%)',
    blue:    'linear-gradient(160deg, #eff6ff 0%, #f8fafc 45%, #ffffff 100%)',
    emerald: 'linear-gradient(160deg, #ecfdf5 0%, #f0fdf4 45%, #ffffff 100%)',
    purple:  'linear-gradient(160deg, #faf5ff 0%, #f5f3ff 45%, #ffffff 100%)',
};

const PageLayout = ({ color = 'amber', gradient, fullscreen = false, children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(
        typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
    );

    const bg = gradient || GRADIENTS[color] || GRADIENTS.amber;

    return (
        <div
            className="dashboard-container inter-font"
            style={{ minHeight: '100vh', position: 'relative', background: bg }}
        >
            <GlobalStyles />
            <PulseBackground color={color} />
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div
                className={`dashboard-content-wrapper relative z-10 h-full transition-all duration-300 pt-16 pb-10 ${
                    sidebarOpen ? 'md:ml-64 lg:ml-72' : 'ml-0'
                }`}
            >
                {fullscreen ? (
                    typeof children === 'function'
                        ? children({ sidebarOpen, setSidebarOpen })
                        : children
                ) : (
                    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">
                        {typeof children === 'function'
                            ? children({ sidebarOpen, setSidebarOpen })
                            : children}
                    </main>
                )}
            </div>
        </div>
    );
};

export default PageLayout;
