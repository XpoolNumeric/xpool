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
    }).format(amount);
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
