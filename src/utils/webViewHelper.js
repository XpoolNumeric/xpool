/**
 * WebView Helper Utility
 * Detects and handles WebView-specific issues for mobile apps
 */

/**
 * Detect if the app is running in a WebView environment
 * @returns {boolean} True if running in WebView
 */
export const isWebView = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // Common WebView indicators
  const webViewPatterns = [
    /wv/i, // Android WebView
    /WebView/i,
    /; wv\)/i,
    /Version\/[\d.]+.*Safari/i, // iOS WebView pattern
  ];

  // Check if running in standalone mode (PWA or wrapped app)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone
    || document.referrer.includes('android-app://');

  const isWebViewUA = webViewPatterns.some(pattern => pattern.test(userAgent));

  return isWebViewUA || isStandalone;
};

/**
 * Check if the device has network connectivity
 * @returns {boolean} True if online
 */
export const isOnline = () => {
  return navigator.onLine;
};

/**
 * Check if localStorage is accessible and working
 * @returns {boolean} True if localStorage is available
 */
export const isLocalStorageAvailable = () => {
  try {
    const testKey = '__xpool_storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.warn('localStorage is not available:', e);
    return false;
  }
};

/**
 * Check if sessionStorage is accessible and working
 * @returns {boolean} True if sessionStorage is available
 */
export const isSessionStorageAvailable = () => {
  try {
    const testKey = '__xpool_session_test__';
    sessionStorage.setItem(testKey, 'test');
    sessionStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.warn('sessionStorage is not available:', e);
    return false;
  }
};

/**
 * Get environment information for debugging
 * @returns {object} Environment details
 */
export const getEnvironmentInfo = () => {
  return {
    isWebView: isWebView(),
    isOnline: isOnline(),
    hasLocalStorage: isLocalStorageAvailable(),
    hasSessionStorage: isSessionStorageAvailable(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor,
  };
};

/**
 * Log environment information to console
 */
export const logEnvironmentInfo = () => {
  const info = getEnvironmentInfo();
  console.log('=== Xpool Environment Info ===');
  console.log('Running in WebView:', info.isWebView);
  console.log('Network Status:', info.isOnline ? 'Online' : 'Offline');
  console.log('LocalStorage Available:', info.hasLocalStorage);
  console.log('SessionStorage Available:', info.hasSessionStorage);
  console.log('User Agent:', info.userAgent);
  console.log('Platform:', info.platform);
  console.log('==============================');
};

/**
 * Create a fallback storage mechanism for environments where localStorage is not available
 */
class MemoryStorage {
  constructor() {
    this.storage = new Map();
  }

  getItem(key) {
    return this.storage.get(key) || null;
  }

  setItem(key, value) {
    this.storage.set(key, value);
  }

  removeItem(key) {
    this.storage.delete(key);
  }

  clear() {
    this.storage.clear();
  }
}

/**
 * Logging Storage Adapter
 * Wraps localStorage to log all access for debugging
 */
class LoggingStorage {
  constructor(storage) {
    this.storage = storage;
  }

  getItem(key) {
    console.log(`[Storage] Reading key: ${key}`);
    try {
      const val = this.storage.getItem(key);
      console.log(`[Storage] Read success: ${key} (${val ? 'found' : 'null'})`);
      return val;
    } catch (e) {
      console.error(`[Storage] Read ERROR: ${key}`, e);
      return null;
    }
  }

  setItem(key, value) {
    console.log(`[Storage] Writing key: ${key}`);
    try {
      this.storage.setItem(key, value);
      console.log(`[Storage] Write success: ${key}`);
    } catch (e) {
      console.error(`[Storage] Write ERROR: ${key}`, e);
    }
  }

  removeItem(key) {
    console.log(`[Storage] Removing key: ${key}`);
    try {
      this.storage.removeItem(key);
      console.log(`[Storage] Remove success: ${key}`);
    } catch (e) {
      console.error(`[Storage] Remove ERROR: ${key}`, e);
    }
  }
}

/**
 * Get a storage adapter that works in the current environment
 * @returns {Storage|MemoryStorage|LoggingStorage} Storage adapter
 */
export const getStorageAdapter = () => {
  if (isLocalStorageAvailable()) {
    return window.localStorage;
  }
  
  // Minimal memory fallback if totally missing (unlikely in real browsers)
  return {
    _storage: new Map(),
    getItem(key) { return this._storage.get(key) || null; },
    setItem(key, value) { this._storage.set(key, value); },
    removeItem(key) { this._storage.delete(key); },
    clear() { this._storage.clear(); }
  };
};

/**
 * Wait for network connectivity
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} Resolves to true if online, false if timeout
 */
export const waitForNetwork = (timeout = 5000) => {
  return new Promise((resolve) => {
    if (isOnline()) {
      resolve(true);
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isOnline()) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 500);
  });
};

/**
 * Safely get session with timeout
 * @param {object} supabase - Supabase client instance
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<{data: object|null, error: object|null}>} Session data or error
 */
export const getSafeSession = async (supabase, timeoutMs = 5000) => {
  console.log(`[SafeSession] Requesting session with ${timeoutMs}ms timeout...`);

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Session check timed out after ${timeoutMs}ms`)), timeoutMs)
  );

  try {
    const { data, error } = await Promise.race([
      supabase.auth.getSession(),
      timeoutPromise
    ]);

    console.log('[SafeSession] Result:', error ? 'Error' : (data?.session ? 'Found Session' : 'No Session'));
    return { data, error };
  } catch (e) {
    console.error('[SafeSession] Failed:', e.message);
    return { data: null, error: e };
  }
};

/**
 * Universal Lock Adapter
 * Acts as both a function and an object to satisfy Supabase's internal checks.
 * This fixes the "this.lock is not a function" error by handling:
 * 1. this.lock(name, cb)
 * 2. this.lock.acquire(name, cb)
 */
const UniversalLockAdapter = (name, ...args) => {
  console.log(`[AuthLock] Bypassing lock (function call) for: ${name}`);
  // Find the callback from arguments - robust way to handle signature variations
  // Signature can be (name, cb) or (name, options, cb) or just (cb)
  const callback = args.reverse().find(arg => typeof arg === 'function');
  const cb = typeof name === 'function' ? name : callback;

  return cb ? cb() : Promise.resolve();
};

// Start attaching methods to make it an object too
UniversalLockAdapter.acquire = async (name, callback) => {
  console.log(`[AuthLock] Bypassing lock (acquire method) for: ${name}`);
  return await callback();
};

UniversalLockAdapter.request = async (name, callback) => {
  console.log(`[AuthLock] Bypassing lock (request method) for: ${name}`);
  return await callback();
};

/**
 * Get a lock adapter that resolves Supabase lock issues
 * This completely bypasses the locking mechanism to prevent deadlocks
 */
export const getLockAdapter = () => {
  // Return a function that immediately executes the callback
  // This satisfies both function and object patterns
  const lockAdapter = (name, ...args) => {
    console.log(`[AuthLock] Bypassing lock: ${name}`);
    // Find the callback function
    const callback = args.find(arg => typeof arg === 'function');
    return callback ? callback() : Promise.resolve();
  };

  // Add method signatures
  lockAdapter.acquire = async (name, callback) => {
    console.log(`[AuthLock] Bypassing lock.acquire: ${name}`);
    return await callback();
  };

  lockAdapter.release = () => {
    console.log('[AuthLock] Lock release bypassed');
    return Promise.resolve();
  };

  return lockAdapter;
};