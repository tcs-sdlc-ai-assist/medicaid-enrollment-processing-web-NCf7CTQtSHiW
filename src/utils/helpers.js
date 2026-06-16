import { v4 as uuidv4 } from 'uuid';

const STORAGE_PREFIX = import.meta.env.VITE_STORAGE_PREFIX || 'medicaid_';

/**
 * Generates a unique identifier using UUID v4.
 * @returns {string} A unique UUID string.
 */
export function generateId() {
  return uuidv4();
}

/**
 * Formats a date value into a locale-friendly date string (MM/DD/YYYY).
 * @param {string | number | Date} date - The date to format.
 * @returns {string} The formatted date string, or empty string if invalid.
 */
export function formatDate(date) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return '';
    }
    return d.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  } catch (_err) {
    return '';
  }
}

/**
 * Formats a date value into a full timestamp string with date and time.
 * @param {string | number | Date} date - The date to format.
 * @returns {string} The formatted timestamp string, or empty string if invalid.
 */
export function formatTimestamp(date) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return '';
    }
    return d.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch (_err) {
    return '';
  }
}

/**
 * Returns a promise that resolves after the specified number of milliseconds.
 * Useful for simulating async API delays.
 * @param {number} ms - The number of milliseconds to delay.
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Truncates text to a specified maximum length and appends an ellipsis if truncated.
 * @param {string} text - The text to truncate.
 * @param {number} [maxLength=100] - The maximum length before truncation.
 * @returns {string} The truncated text.
 */
export function truncateText(text, maxLength = 100) {
  if (typeof text !== 'string') {
    return '';
  }
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}

/**
 * Creates a deep clone of the provided value using structuredClone.
 * Falls back to JSON parse/stringify if structuredClone is unavailable.
 * @param {*} value - The value to deep clone.
 * @returns {*} A deep clone of the value.
 */
export function deepClone(value) {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  } catch (_err) {
    console.error('Failed to deep clone value:', _err);
    return value;
  }
}

/**
 * Creates a debounced version of the provided function that delays invocation
 * until after the specified wait time has elapsed since the last call.
 * @param {Function} fn - The function to debounce.
 * @param {number} [waitMs=300] - The debounce delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounce(fn, waitMs = 300) {
  let timeoutId = null;

  const debounced = (...args) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, waitMs);
  };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Retrieves an item from localStorage by key, parsing it from JSON.
 * Automatically prepends the storage prefix if not already present.
 * @param {string} key - The storage key.
 * @returns {*} The parsed value, or null if not found or on error.
 */
export function getStorageItem(key) {
  try {
    const prefixedKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
    const item = localStorage.getItem(prefixedKey);
    if (item === null) {
      return null;
    }
    return JSON.parse(item);
  } catch (_err) {
    console.error(`Failed to get storage item "${key}":`, _err);
    return null;
  }
}

/**
 * Stores a value in localStorage under the given key, serializing it as JSON.
 * Automatically prepends the storage prefix if not already present.
 * @param {string} key - The storage key.
 * @param {*} value - The value to store.
 * @returns {boolean} True if the operation succeeded, false otherwise.
 */
export function setStorageItem(key, value) {
  try {
    const prefixedKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
    localStorage.setItem(prefixedKey, JSON.stringify(value));
    return true;
  } catch (_err) {
    console.error(`Failed to set storage item "${key}":`, _err);
    return false;
  }
}

/**
 * Removes an item from localStorage by key.
 * Automatically prepends the storage prefix if not already present.
 * @param {string} key - The storage key.
 * @returns {boolean} True if the operation succeeded, false otherwise.
 */
export function removeStorageItem(key) {
  try {
    const prefixedKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(prefixedKey);
    return true;
  } catch (_err) {
    console.error(`Failed to remove storage item "${key}":`, _err);
    return false;
  }
}