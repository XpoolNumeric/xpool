import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Set status bar to DARK icons (black battery/signal/time icons)
 * Use on white/light backgrounds (passenger screens, auth screens)
 */
export const setStatusBarDark = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        // Style.Light sets dark icons/text (appropriate for light backgrounds)
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#00000000' });
    } catch (e) {
        console.warn('[StatusBar] Dark icons (light background) style failed:', e);
    }
};

/**
 * Set status bar to LIGHT icons (white battery/signal/time icons)
 * Use on dark/orange backgrounds (driver home, driver wallet, etc.)
 */
export const setStatusBarLight = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        // Style.Dark sets light/white icons/text (appropriate for dark backgrounds)
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#00000000' });
    } catch (e) {
        console.warn('[StatusBar] Light icons (dark background) style failed:', e);
    }
};

