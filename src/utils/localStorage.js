import { STORAGE_KEYS } from './constants';

const STORAGE_PREFIX = import.meta.env.VITE_STORAGE_PREFIX || 'medicaid_';

/**
 * Loads and deserializes state from localStorage for the given key.
 * @param {string} key - The storage key (from STORAGE_KEYS or a plain key).
 * @returns {*} The parsed value, or null if not found or on error.
 */
export function loadState(key) {
  try {
    const prefixedKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
    const serialized = localStorage.getItem(prefixedKey);
    if (serialized === null) {
      return null;
    }
    return JSON.parse(serialized);
  } catch (_err) {
    console.error(`loadState: Failed to load key "${key}":`, _err);
    return null;
  }
}

/**
 * Serializes and saves state to localStorage for the given key.
 * Handles storage quota exceeded errors gracefully.
 * @param {string} key - The storage key (from STORAGE_KEYS or a plain key).
 * @param {*} data - The data to serialize and store.
 * @returns {boolean} True if the operation succeeded, false otherwise.
 */
export function saveState(key, data) {
  try {
    const prefixedKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
    const serialized = JSON.stringify(data);
    localStorage.setItem(prefixedKey, serialized);
    return true;
  } catch (_err) {
    if (_err instanceof DOMException && (
      _err.name === 'QuotaExceededError' ||
      _err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )) {
      console.error(`saveState: Storage quota exceeded when saving key "${key}".`);
    } else {
      console.error(`saveState: Failed to save key "${key}":`, _err);
    }
    return false;
  }
}

/**
 * Removes a single item from localStorage by key.
 * @param {string} key - The storage key (from STORAGE_KEYS or a plain key).
 * @returns {boolean} True if the operation succeeded, false otherwise.
 */
export function removeState(key) {
  try {
    const prefixedKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(prefixedKey);
    return true;
  } catch (_err) {
    console.error(`removeState: Failed to remove key "${key}":`, _err);
    return false;
  }
}

/**
 * Clears all localStorage entries that belong to this application
 * (i.e., keys that start with the configured storage prefix).
 * @returns {boolean} True if the operation succeeded, false otherwise.
 */
export function clearAllState() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (_err) {
    console.error('clearAllState: Failed to clear application state:', _err);
    return false;
  }
}

/**
 * Returns information about the current storage usage for this application's keys.
 * Provides the number of keys, total size in bytes, and a breakdown per key.
 * @returns {{ keyCount: number, totalBytes: number, keys: Array<{ key: string, bytes: number }>, quotaEstimate: number }} Storage usage details.
 */
export function getStorageUsage() {
  try {
    const keys = [];
    let totalBytes = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const value = localStorage.getItem(key);
        const bytes = value ? new Blob([value]).size : 0;
        totalBytes += bytes;
        keys.push({ key, bytes });
      }
    }

    // Estimate total quota (~5MB for most browsers)
    const quotaEstimate = 5 * 1024 * 1024;

    return {
      keyCount: keys.length,
      totalBytes,
      keys,
      quotaEstimate,
    };
  } catch (_err) {
    console.error('getStorageUsage: Failed to calculate storage usage:', _err);
    return {
      keyCount: 0,
      totalBytes: 0,
      keys: [],
      quotaEstimate: 5 * 1024 * 1024,
    };
  }
}

export { STORAGE_KEYS };