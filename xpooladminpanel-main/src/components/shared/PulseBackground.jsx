import React, { memo } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Animated background blobs — shared across all pages.
 * Pass a `color` prop: 'amber' (default), 'blue', 'emerald', 'purple'
 * to theme the page uniquely.
 */

const COLOR_MAP = {
    amber:   { r: 245, g: 158, b: 11 },
    blue:    { r: 59,  g: 130, b: 246 },
    emerald: { r: 16,  g: 185, b: 129 },
    purple:  { r: 139, g: 92,  b: 246 },
    red:     { r: 239, g: 68,  b: 68 },
};

const DEFAULT_PULSES = [
    { x: 15, y: 18, size: 380, delay: 0,   dur: 5.2, opacity: 0.13 },
    { x: 82, y: 68, size: 300, delay: 1.4, dur: 5.8, opacity: 0.11 },
    { x: 50, y: 78, size: 340, delay: 2.4, dur: 6.2, opacity: 0.14 },
];

const PulseBackground = memo(({ color = 'amber', pulses = DEFAULT_PULSES }) => {
    const prefersReducedMotion = useReducedMotion();
    if (prefersReducedMotion) return null;

    const { r, g, b } = COLOR_MAP[color] || COLOR_MAP.amber;

    return (
        <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
            {pulses.map((p, i) => (
                <div
                    key={i}
                    className="pulse-blob"
                    style={{
                        position: 'absolute',
                        left: `${p.x}%`, top: `${p.y}%`,
                        width: p.size, height: p.size,
                        borderRadius: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: `radial-gradient(circle, rgba(${r},${g},${b},${p.opacity}) 0%, rgba(${r},${g},${b},${p.opacity * 0.5}) 42%, transparent 70%)`,
                        filter: 'blur(50px)',
                        animationDuration: `${p.dur}s`,
                        animationDelay: `${p.delay}s`,
                    }}
                />
            ))}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: `radial-gradient(rgba(${r},${g},${b},0.05) 1px, transparent 1px)`,
                    backgroundSize: '24px 24px',
                    zIndex: 1,
                }}
            />
        </div>
    );
});

PulseBackground.displayName = 'PulseBackground';

export default PulseBackground;
