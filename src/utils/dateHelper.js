/**
 * Date Helper Functions
 * Handles date comparisons and trip day detection
 */

/**
 * Check if a trip is scheduled for today
 * @param {string} travelDate - Travel date (YYYY-MM-DD format)
 * @returns {boolean} True if trip is today
 */
export const isTripToday = (travelDate) => {
    if (!travelDate) return false;

    const tripDate = new Date(travelDate);
    const today = new Date();

    return (
        tripDate.getDate() === today.getDate() &&
        tripDate.getMonth() === today.getMonth() &&
        tripDate.getFullYear() === today.getFullYear()
    );
};

/**
 * Check if a trip is in the future
 * @param {string} travelDate - Travel date (YYYY-MM-DD format)
 * @returns {boolean} True if trip is upcoming
 */
export const isTripUpcoming = (travelDate) => {
    if (!travelDate) return false;

    const tripDate = new Date(travelDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    tripDate.setHours(0, 0, 0, 0);

    return tripDate > today;
};

/**
 * Check if a trip is in the past
 * @param {string} travelDate - Travel date (YYYY-MM-DD format)
 * @returns {boolean} True if trip is in the past
 */
export const isTripPast = (travelDate) => {
    if (!travelDate) return false;

    const tripDate = new Date(travelDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    tripDate.setHours(0, 0, 0, 0);

    return tripDate < today;
};

/**
 * Get trip day reminder message
 * @param {string} travelDate - Travel date (YYYY-MM-DD format)
 * @param {string} travelTime - Travel time (HH:MM format)
 * @returns {string} Reminder message
 */
export const getTripDayReminder = (travelDate, travelTime) => {
    const tripDate = new Date(travelDate);
    const [hours, minutes] = travelTime.split(':');

    const formattedDate = tripDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const formattedTime = `${displayHour}:${minutes} ${ampm}`;

    return `Your trip is scheduled for ${formattedDate} at ${formattedTime}. Please be ready!`;
};

/**
 * Calculate days until trip
 * @param {string} travelDate - Travel date (YYYY-MM-DD format)
 * @returns {number} Number of days until trip (negative if past)
 */
export const daysUntilTrip = (travelDate) => {
    if (!travelDate) return 0;

    const tripDate = new Date(travelDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    tripDate.setHours(0, 0, 0, 0);

    const diffTime = tripDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
};

/**
 * Get human-readable time until trip
 * @param {string} travelDate - Travel date (YYYY-MM-DD format)
 * @returns {string} Human-readable time until trip
 */
export const getTimeUntilTrip = (travelDate) => {
    const days = daysUntilTrip(travelDate);

    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days === -1) return 'Yesterday';
    if (days < 0) return `${Math.abs(days)} days ago`;
    if (days <= 7) return `In ${days} days`;
    if (days <= 30) return `In ${Math.ceil(days / 7)} weeks`;
    return `In ${Math.ceil(days / 30)} months`;
};

/**
 * Format date for display
 * @param {string} dateStr - Date string
 * @param {string} format - Format type ('short', 'long', 'medium')
 * @returns {string} Formatted date
 */
export const formatDate = (dateStr, format = 'medium') => {
    if (!dateStr) return '';

    const date = new Date(dateStr);

    const formats = {
        short: {
            day: 'numeric',
            month: 'short',
        },
        medium: {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        },
        long: {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        },
    };

    return date.toLocaleDateString('en-IN', formats[format] || formats.medium);
};

/**
 * Format time for display
 * @param {string} timeStr - Time string (HH:MM format)
 * @returns {string} Formatted time (12-hour format)
 */
export const formatTime = (timeStr) => {
    if (!timeStr) return '';

    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minutes} ${ampm}`;
};

/**
 * Schedule a notification for trip reminder
 * @param {string} travelDate - Travel date (YYYY-MM-DD format)
 * @param {string} travelTime - Travel time (HH:MM format)
 * @param {Function} callback - Callback function to execute
 * @returns {number|null} Timeout ID or null if trip is past
 */
export const scheduleNotification = (travelDate, travelTime, callback) => {
    const tripDate = new Date(travelDate);
    const [hours, minutes] = travelTime.split(':');
    tripDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const now = new Date();
    const timeUntilTrip = tripDate - now;

    // Don't schedule if trip is in the past
    if (timeUntilTrip < 0) {
        return null;
    }

    // Schedule notification 1 hour before trip
    const notificationTime = timeUntilTrip - (60 * 60 * 1000);

    if (notificationTime > 0) {
        return setTimeout(callback, notificationTime);
    }

    return null;
};

/**
 * Check if trip should show "Start Journey" button
 * @param {string} travelDate - Travel date (YYYY-MM-DD format)
 * @param {string} travelTime - Travel time (HH:MM format)
 * @returns {boolean} True if journey can be started
 */
export const canStartJourney = (travelDate, travelTime) => {
    if (!isTripToday(travelDate)) {
        return false;
    }

    // Allow starting journey 30 minutes before scheduled time
    const tripDate = new Date(travelDate);
    const [hours, minutes] = travelTime.split(':');
    tripDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const now = new Date();
    const thirtyMinutesBefore = new Date(tripDate.getTime() - (30 * 60 * 1000));

    return now >= thirtyMinutesBefore;
};

/**
 * Get current date in YYYY-MM-DD format
 * @returns {string} Current date
 */
export const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Get current time in HH:MM format
 * @returns {string} Current time
 */
export const getCurrentTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};
