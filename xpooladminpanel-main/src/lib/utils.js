import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx for conditional class names.
 * Shared utility — import from here instead of redefining in every file.
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

/**
 * Format currency in INR.
 */
export function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount || 0);
}

/**
 * Safely get localStorage value with fallback.
 */
export function getLocal(key, fallback = '') {
    try {
        return localStorage.getItem(key) || fallback;
    } catch {
        return fallback;
    }
}

/**
 * Truncate a string to maxLen characters.
 */
export function truncate(str, maxLen = 24) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
}

/**
 * Format a date string to a readable format.
 */
export function formatDate(dateStr, options = {}) {
    if (!dateStr) return '—';
    const defaults = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-IN', { ...defaults, ...options });
}

/**
 * Format a date to relative time (e.g. "2 hours ago").
 */
export function formatRelativeTime(dateStr) {
    if (!dateStr) return '—';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
}

/**
 * Debounce a function call.
 */
export function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Get initials from a full name (e.g. "John Doe" → "JD").
 */
export function getInitials(name, maxChars = 2) {
    if (!name) return '?';
    return name
        .split(' ')
        .filter(Boolean)
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .substring(0, maxChars);
}
