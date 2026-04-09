import React from 'react';

/**
 * GlobalStyles — Single source of truth for all CSS custom properties,
 * glassmorphism utilities, animations, and shared classes.
 * Import this ONCE in each page layout instead of copy-pasting.
 */
const GlobalStyles = () => (
    <style>{`
      /* ── Design Tokens ────────────────────────────────────────────── */
      :root {
        --color-amber-50: #fffbeb; --color-amber-100: #fef3c7; --color-amber-200: #fde68a;
        --color-amber-300: #fcd34d; --color-amber-400: #fbbf24; --color-amber-500: #f59e0b;
        --color-amber-600: #d97706; --color-amber-700: #b45309;
        --color-emerald-500: #10b981; --color-blue-500: #3b82f6;
        --transition-base: 0.2s ease-in-out;
        --radius-sm: 0.5rem; --radius-md: 0.75rem; --radius-lg: 1rem;
        --radius-xl: 1.25rem; --radius-2xl: 1.5rem; --radius-3xl: 2rem;
      }

      .inter-font {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      /* ── Animations ───────────────────────────────────────────────── */
      @keyframes pulse-fade {
        0%, 100% { opacity: 0; } 50% { opacity: 1; }
      }
      .pulse-blob {
        animation: pulse-fade ease-in-out infinite;
        will-change: opacity;
      }

      @keyframes border-breathe {
        0%, 100% { border-color: rgba(245,158,11,0.18); }
        50%       { border-color: rgba(245,158,11,0.5); }
      }
      .badge-breathe { animation: border-breathe 3s ease-in-out infinite; }

      @keyframes shimmer {
        0%   { background-position: 200% center; }
        100% { background-position: -200% center; }
      }
      .cta-shimmer {
        background: linear-gradient(110deg, #10B981 0%, #34D399 30%, #059669 50%, #34D399 70%, #10B981 100%);
        background-size: 200% auto;
        animation: shimmer 3s linear infinite;
        color: #fff !important;
        font-weight: 700 !important;
        border: none !important;
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4), 0 1px 0 rgba(255,255,255,0.35) inset;
        transition: filter var(--transition-base), box-shadow var(--transition-base), transform 0.1s;
      }
      .cta-shimmer:hover {
        filter: brightness(1.1);
        box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5), 0 1px 0 rgba(255,255,255,0.35) inset;
      }
      .cta-shimmer:active { transform: scale(0.97); }

      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .animate-fade-in-up {
        animation: fadeInUp 0.4s ease-out both;
      }

      @keyframes slideInRight {
        from { opacity: 0; transform: translateX(20px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      .animate-slide-in-right {
        animation: slideInRight 0.35s ease-out both;
      }

      /* ── Glassmorphism ────────────────────────────────────────────── */
      .glass-card {
        background: rgba(255, 255, 255, 0.72);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border: 1px solid rgba(255, 255, 255, 0.85);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(255,255,255,0.1) inset;
      }

      .glass-card-hover {
        transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .glass-card-hover:hover {
        background: rgba(255, 255, 255, 0.92);
        border-color: rgba(245, 158, 11, 0.35);
        transform: translateY(-3px);
        box-shadow: 0 20px 50px rgba(245, 158, 11, 0.08), 0 0 0 1px rgba(245,158,11,0.15) inset;
      }

      .glass-modal {
        background: rgba(255, 255, 255, 0.88);
        backdrop-filter: blur(24px) saturate(200%);
        -webkit-backdrop-filter: blur(24px) saturate(200%);
        border: 1px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }

      .glass-input {
        background: rgba(255, 255, 255, 0.55);
        border: 1.5px solid rgba(245, 158, 11, 0.2);
        transition: all 0.2s ease;
      }
      .glass-input:focus {
        background: rgba(255, 255, 255, 0.95);
        border-color: rgba(245, 158, 11, 0.6);
        outline: none;
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.12), 0 2px 8px rgba(245,158,11,0.08);
      }

      /* ── Buttons ──────────────────────────────────────────────────── */
      .btn-danger {
        background: rgba(239, 68, 68, 0.08);
        color: #DC2626;
        border: 1px solid rgba(239, 68, 68, 0.2);
        font-weight: 600;
        transition: all 0.2s ease;
      }
      .btn-danger:hover {
        background: rgba(239, 68, 68, 0.15);
        border-color: rgba(239, 68, 68, 0.4);
        transform: scale(0.97);
      }

      /* ── Route Visualization ──────────────────────────────────────── */
      .dash-dotted {
        background-image: linear-gradient(to bottom, #d1d5db 50%, transparent 50%);
        background-size: 2px 8px;
        width: 2px;
      }

      /* ── Scrollbar ────────────────────────────────────────────────── */
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

      .custom-scrollbar::-webkit-scrollbar { width: 4px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(0,0,0,0.12); border-radius: 100px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(0,0,0,0.2);
      }

      /* ── Map Markers ──────────────────────────────────────────────── */
      .map-marker-pulse {
        animation: markerPulse 2s infinite;
      }
      @keyframes markerPulse {
        0%  { transform: scale(1);   box-shadow: 0 0 0 0    rgba(245,158,11,.7); }
        70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(245,158,11,0); }
        100%{ transform: scale(1);   box-shadow: 0 0 0 0    rgba(245,158,11,0); }
      }

      /* ── Accessibility ────────────────────────────────────────────── */
      @media (prefers-reduced-motion: reduce) {
        .pulse-blob, .badge-breathe, .cta-shimmer, .map-marker-pulse,
        .animate-fade-in-up, .animate-slide-in-right {
          animation: none !important;
        }
        .glass-card-hover:hover { transform: none; }
      }

      /* ── Selection Color ──────────────────────────────────────────── */
      ::selection {
        background: rgba(245, 158, 11, 0.2);
        color: #92400e;
      }
    `}</style>
);

export default GlobalStyles;
