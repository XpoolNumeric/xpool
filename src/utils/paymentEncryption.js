/**
 * Payment Encryption Helper Functions
 * Handles encryption/decryption of sensitive payment data
 */

const ENCRYPTION_KEY = import.meta.env.VITE_PAYMENT_ENCRYPTION_KEY || 'default_key_change_in_production_32';

/**
 * Encrypt card number using Web Crypto API
 * @param {string} cardNumber - Full card number
 * @returns {Promise<string>} Encrypted card number (base64)
 */
export const encryptCardNumber = async (cardNumber) => {
    try {
        // Remove spaces and dashes
        const cleanCardNumber = cardNumber.replace(/[\s-]/g, '');

        // Convert key to CryptoKey
        const encoder = new TextEncoder();
        const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );

        // Generate IV
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Encrypt
        const encryptedData = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            cryptoKey,
            encoder.encode(cleanCardNumber)
        );

        // Combine IV and encrypted data
        const combined = new Uint8Array(iv.length + encryptedData.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encryptedData), iv.length);

        // Convert to base64
        return btoa(String.fromCharCode(...combined));
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt card number');
    }
};

/**
 * Decrypt card number
 * @param {string} encryptedData - Encrypted card number (base64)
 * @returns {Promise<string>} Decrypted card number
 */
export const decryptCardNumber = async (encryptedData) => {
    try {
        // Convert from base64
        const combined = new Uint8Array(
            atob(encryptedData)
                .split('')
                .map(char => char.charCodeAt(0))
        );

        // Extract IV and encrypted data
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        // Convert key to CryptoKey
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );

        // Decrypt
        const decryptedData = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            cryptoKey,
            data
        );

        return decoder.decode(decryptedData);
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt card number');
    }
};

/**
 * Mask card number for display
 * @param {string} cardNumber - Full card number
 * @returns {string} Masked card number (e.g., "**** **** **** 1234")
 */
export const maskCardNumber = (cardNumber) => {
    if (!cardNumber) return '';

    const cleaned = cardNumber.replace(/[\s-]/g, '');
    const lastFour = cleaned.slice(-4);

    return `**** **** **** ${lastFour}`;
};

/**
 * Get last four digits of card
 * @param {string} cardNumber - Full card number
 * @returns {string} Last 4 digits
 */
export const getLastFourDigits = (cardNumber) => {
    if (!cardNumber) return '';
    return cardNumber.replace(/[\s-]/g, '').slice(-4);
};

/**
 * Validate card number using Luhn algorithm
 * @param {string} cardNumber - Card number to validate
 * @returns {boolean} True if valid
 */
export const validateCardNumber = (cardNumber) => {
    if (!cardNumber) return false;

    const cleaned = cardNumber.replace(/[\s-]/g, '');

    // Check if only digits
    if (!/^\d+$/.test(cleaned)) return false;

    // Check length (13-19 digits)
    if (cleaned.length < 13 || cleaned.length > 19) return false;

    // Luhn algorithm
    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
        let digit = parseInt(cleaned[i]);

        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        isEven = !isEven;
    }

    return sum % 10 === 0;
};

/**
 * Validate IFSC code
 * @param {string} ifscCode - IFSC code to validate
 * @returns {boolean} True if valid
 */
export const validateIFSC = (ifscCode) => {
    if (!ifscCode) return false;

    // IFSC format: 4 letters + 0 + 6 alphanumeric
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifscCode.toUpperCase());
};

/**
 * Validate UPI ID
 * @param {string} upiId - UPI ID to validate
 * @returns {boolean} True if valid
 */
export const validateUPI = (upiId) => {
    if (!upiId) return false;

    // UPI format: username@provider
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;
    return upiRegex.test(upiId);
};

/**
 * Detect card network from card number
 * @param {string} cardNumber - Card number
 * @returns {string} Card network (Visa, Mastercard, RuPay, etc.)
 */
export const detectCardNetwork = (cardNumber) => {
    if (!cardNumber) return 'Unknown';

    const cleaned = cardNumber.replace(/[\s-]/g, '');

    // Visa: starts with 4
    if (/^4/.test(cleaned)) return 'Visa';

    // Mastercard: starts with 51-55 or 2221-2720
    if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return 'Mastercard';

    // RuPay: starts with 60, 65, 81, 82, 508, 353
    if (/^(60|65|81|82|508|353)/.test(cleaned)) return 'RuPay';

    // American Express: starts with 34 or 37
    if (/^3[47]/.test(cleaned)) return 'American Express';

    // Discover: starts with 6011, 622126-622925, 644-649, 65
    if (/^(6011|65|64[4-9]|622)/.test(cleaned)) return 'Discover';

    return 'Unknown';
};

/**
 * Format card number with spaces
 * @param {string} cardNumber - Card number
 * @returns {string} Formatted card number
 */
export const formatCardNumber = (cardNumber) => {
    if (!cardNumber) return '';

    const cleaned = cardNumber.replace(/[\s-]/g, '');
    const groups = cleaned.match(/.{1,4}/g) || [];

    return groups.join(' ');
};

/**
 * Validate card expiry
 * @param {number} month - Expiry month (1-12)
 * @param {number} year - Expiry year (full year, e.g., 2025)
 * @returns {boolean} True if not expired
 */
export const validateCardExpiry = (month, year) => {
    if (!month || !year) return false;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (year < currentYear) return false;
    if (year === currentYear && month < currentMonth) return false;

    return true;
};

/**
 * Validate account number (basic validation)
 * @param {string} accountNumber - Bank account number
 * @returns {boolean} True if valid format
 */
export const validateAccountNumber = (accountNumber) => {
    if (!accountNumber) return false;

    // Account number should be 9-18 digits
    const cleaned = accountNumber.replace(/[\s-]/g, '');
    return /^\d{9,18}$/.test(cleaned);
};
