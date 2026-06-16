/**
 * Mock encryption module for demonstration purposes.
 * Simulates data-at-rest and data-in-transit encryption using base64 encoding/decoding.
 * NOT suitable for production use — this is a mock implementation only.
 */

/**
 * Encodes a string to base64.
 * @param {string} str - The string to encode.
 * @returns {string} The base64-encoded string.
 */
function toBase64(str) {
  try {
    return window.btoa(unescape(encodeURIComponent(str)));
  } catch (_err) {
    console.error('Failed to encode to base64:', _err);
    return '';
  }
}

/**
 * Decodes a base64 string back to its original value.
 * @param {string} str - The base64-encoded string.
 * @returns {string} The decoded string.
 */
function fromBase64(str) {
  try {
    return decodeURIComponent(escape(window.atob(str)));
  } catch (_err) {
    console.error('Failed to decode from base64:', _err);
    return '';
  }
}

/**
 * Mock encrypts the provided data by serializing it to JSON and encoding it as base64.
 * Simulates data-at-rest and data-in-transit encryption for demonstration purposes.
 * @param {*} data - The data to encrypt. Can be any JSON-serializable value.
 * @returns {{ encrypted: string, algorithm: string, timestamp: string }} The mock-encrypted payload.
 */
export function mockEncrypt(data) {
  try {
    const serialized = JSON.stringify(data);
    const encoded = toBase64(serialized);
    return {
      encrypted: encoded,
      algorithm: 'mock-base64-v1',
      timestamp: new Date().toISOString(),
    };
  } catch (_err) {
    console.error('mockEncrypt failed:', _err);
    return {
      encrypted: '',
      algorithm: 'mock-base64-v1',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Mock decrypts the provided data by decoding from base64 and parsing the JSON payload.
 * Expects input in the format returned by mockEncrypt, or a raw base64 string.
 * @param {string | { encrypted: string }} data - The mock-encrypted data to decrypt.
 * @returns {*} The decrypted and parsed data, or null if decryption fails.
 */
export function mockDecrypt(data) {
  try {
    let encoded;
    if (typeof data === 'object' && data !== null && typeof data.encrypted === 'string') {
      encoded = data.encrypted;
    } else if (typeof data === 'string') {
      encoded = data;
    } else {
      console.error('mockDecrypt: invalid input type');
      return null;
    }

    if (encoded === '') {
      return null;
    }

    const decoded = fromBase64(encoded);
    if (decoded === '') {
      return null;
    }

    return JSON.parse(decoded);
  } catch (_err) {
    console.error('mockDecrypt failed:', _err);
    return null;
  }
}

/**
 * Returns simulated encryption metadata describing the current mock encryption status.
 * Useful for compliance dashboards and status displays.
 * @returns {{ enabled: boolean, algorithm: string, keyLength: number, dataAtRest: boolean, dataInTransit: boolean, lastRotated: string, status: string }}
 */
export function encryptionStatus() {
  return {
    enabled: true,
    algorithm: 'mock-base64-v1',
    keyLength: 256,
    dataAtRest: true,
    dataInTransit: true,
    lastRotated: new Date().toISOString(),
    status: 'active',
  };
}