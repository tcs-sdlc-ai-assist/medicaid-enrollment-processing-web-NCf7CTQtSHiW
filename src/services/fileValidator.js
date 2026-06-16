import { SUPPORTED_FILE_EXTENSIONS, MAX_FILE_SIZE_BYTES } from '../utils/constants';
import { validateEDI834 } from './edi834Parser';

/**
 * Allowed MIME types for EDI 834 and related file uploads.
 * @type {Array<string>}
 */
const ALLOWED_MIME_TYPES = Object.freeze([
  'text/plain',
  'application/octet-stream',
  'application/edi-x12',
  'application/xml',
  'text/xml',
  'application/json',
  'text/csv',
  '',
]);

/**
 * Extracts the file extension from a filename string.
 * @param {string} filename - The filename to extract the extension from.
 * @returns {string} The lowercase file extension including the dot, or empty string if none.
 */
function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return '';
  }

  return filename.substring(lastDot).toLowerCase();
}

/**
 * Generates a simple hash string from content for duplicate detection.
 * Uses a basic string hashing approach since crypto.subtle is async and
 * we want a synchronous comparison. This is a mock/demo implementation.
 * @param {string} content - The content string to hash.
 * @returns {string} A hash string representing the content.
 */
function generateContentHash(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to a positive hex string and include length for better uniqueness
  const positiveHash = Math.abs(hash).toString(16);
  const lengthPart = content.length.toString(16);

  return `${positiveHash}-${lengthPart}`;
}

/**
 * Validates a file's extension against the list of supported extensions.
 * @param {string} filename - The filename to validate.
 * @returns {{ valid: boolean, error: string|null }} The validation result.
 */
function validateFileExtension(filename) {
  if (!filename || typeof filename !== 'string') {
    return { valid: false, error: 'Filename is required.' };
  }

  const extension = getFileExtension(filename);

  if (!extension) {
    return { valid: false, error: 'File has no extension. Supported extensions: ' + SUPPORTED_FILE_EXTENSIONS.join(', ') };
  }

  if (!SUPPORTED_FILE_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Unsupported file extension "${extension}". Supported extensions: ${SUPPORTED_FILE_EXTENSIONS.join(', ')}`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates a file's size against the maximum allowed size.
 * @param {number} fileSize - The file size in bytes.
 * @returns {{ valid: boolean, error: string|null }} The validation result.
 */
function validateFileSize(fileSize) {
  if (fileSize === undefined || fileSize === null || typeof fileSize !== 'number') {
    return { valid: false, error: 'File size is required.' };
  }

  if (fileSize <= 0) {
    return { valid: false, error: 'File is empty (0 bytes).' };
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    const maxMB = MAX_FILE_SIZE_BYTES / (1024 * 1024);
    const fileMB = (fileSize / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${fileMB} MB) exceeds the maximum allowed size of ${maxMB} MB.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates a file's MIME type against the list of allowed MIME types.
 * @param {string} mimeType - The MIME type to validate.
 * @returns {{ valid: boolean, error: string|null }} The validation result.
 */
function validateMimeType(mimeType) {
  // Allow empty/undefined MIME types since some file inputs may not provide them
  if (!mimeType || typeof mimeType !== 'string') {
    return { valid: true, error: null };
  }

  const normalizedMime = mimeType.toLowerCase().trim();

  if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    return {
      valid: false,
      error: `Unsupported MIME type "${normalizedMime}". File may not be a valid EDI or text file.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates a file object by checking its extension, size, and MIME type.
 *
 * Accepts either a browser File object or a plain object with name, size,
 * and optional type properties.
 *
 * @param {File|object} file - The file to validate. Expected properties:
 *   - {string} name - The filename.
 *   - {number} size - The file size in bytes.
 *   - {string} [type] - The MIME type (optional).
 *   - {string} [rawContent] - The raw file content (optional, used for content-based checks).
 * @returns {{ valid: boolean, errors: Array<string> }} The validation result with an array of error messages.
 */
export function validateFile(file) {
  const result = {
    valid: true,
    errors: [],
  };

  if (!file || typeof file !== 'object') {
    result.valid = false;
    result.errors.push('No file provided for validation.');
    return result;
  }

  const filename = file.name || file.filename || '';
  const fileSize = typeof file.size === 'number' ? file.size : 0;
  const mimeType = file.type || '';

  // Validate file extension
  const extensionResult = validateFileExtension(filename);
  if (!extensionResult.valid) {
    result.valid = false;
    result.errors.push(extensionResult.error);
  }

  // Validate file size
  const sizeResult = validateFileSize(fileSize);
  if (!sizeResult.valid) {
    result.valid = false;
    result.errors.push(sizeResult.error);
  }

  // Validate MIME type
  const mimeResult = validateMimeType(mimeType);
  if (!mimeResult.valid) {
    result.valid = false;
    result.errors.push(mimeResult.error);
  }

  return result;
}

/**
 * Validates EDI 834 format by checking for required segments (ISA, GS, ST, SE, GE, IEA),
 * mandatory fields, and structural integrity.
 *
 * @param {string} content - The raw EDI 834 file content string.
 * @returns {{ valid: boolean, errors: Array<string>, segmentCount: number }} The validation result.
 */
export function validateEDI834Format(content) {
  const result = {
    valid: false,
    errors: [],
    segmentCount: 0,
  };

  if (!content || typeof content !== 'string') {
    result.errors.push('No content provided for EDI 834 format validation.');
    return result;
  }

  const trimmedContent = content.trim();

  if (trimmedContent.length === 0) {
    result.errors.push('Empty content provided for EDI 834 format validation.');
    return result;
  }

  // Check that content starts with ISA
  if (!trimmedContent.startsWith('ISA')) {
    result.errors.push('Content does not start with ISA segment. Not a valid EDI 834 file.');
  }

  // Check for required segment identifiers
  const requiredSegments = ['ISA', 'GS', 'ST', 'SE', 'GE', 'IEA'];
  const missingSegments = [];

  for (const segmentId of requiredSegments) {
    // Check for segment at start of content or after a separator
    const segmentPattern = new RegExp('(^|[~\\n\\r])\\s*' + segmentId + '[*|]', 'm');
    if (!segmentPattern.test(trimmedContent)) {
      // Also check for segment followed by element separator
      const altPattern = new RegExp('(^|[~\\n\\r])\\s*' + segmentId + '\\*');
      if (!altPattern.test(trimmedContent)) {
        missingSegments.push(segmentId);
      }
    }
  }

  if (missingSegments.length > 0) {
    result.errors.push(
      `Missing required segment(s): ${missingSegments.join(', ')}.`
    );
  }

  // Check for transaction set identifier code 834
  const stPattern = /ST\*(\d{3})/;
  const stMatch = trimmedContent.match(stPattern);
  if (stMatch) {
    if (stMatch[1] !== '834') {
      result.errors.push(
        `Invalid transaction set identifier code: expected 834, found ${stMatch[1]}.`
      );
    }
  }

  // Check ISA segment has minimum required elements (16 elements + segment ID)
  const isaPattern = /ISA([*][^~\n]*)/;
  const isaMatch = trimmedContent.match(isaPattern);
  if (isaMatch) {
    const elementSeparator = trimmedContent.charAt(3);
    const isaContent = 'ISA' + isaMatch[1];
    const isaTerminatorIndex = isaContent.indexOf('~');
    const isaSegment = isaTerminatorIndex > -1 ? isaContent.substring(0, isaTerminatorIndex) : isaContent;
    const isaElements = isaSegment.split(elementSeparator);

    if (isaElements.length < 17) {
      result.errors.push(
        `ISA segment has insufficient elements: expected 17, found ${isaElements.length}.`
      );
    }

    // Check ISA mandatory fields are not all empty
    const senderId = isaElements[6] ? isaElements[6].trim() : '';
    const receiverId = isaElements[8] ? isaElements[8].trim() : '';

    if (!senderId) {
      result.errors.push('ISA segment is missing Sender ID (ISA06).');
    }

    if (!receiverId) {
      result.errors.push('ISA segment is missing Receiver ID (ISA08).');
    }
  }

  // Check GS segment has minimum required elements
  const gsPattern = /GS([*][^~\n]*)/;
  const gsMatch = trimmedContent.match(gsPattern);
  if (gsMatch) {
    const elementSeparator = trimmedContent.charAt(3);
    const gsContent = 'GS' + gsMatch[1];
    const gsTerminatorIndex = gsContent.indexOf('~');
    const gsSegment = gsTerminatorIndex > -1 ? gsContent.substring(0, gsTerminatorIndex) : gsContent;
    const gsElements = gsSegment.split(elementSeparator);

    if (gsElements.length < 9) {
      result.errors.push(
        `GS segment has insufficient elements: expected at least 9, found ${gsElements.length}.`
      );
    }

    // Check functional identifier code
    const functionalIdCode = gsElements[1] ? gsElements[1].trim() : '';
    if (functionalIdCode && functionalIdCode !== 'HP' && functionalIdCode !== 'BE') {
      result.errors.push(
        `GS functional identifier code "${functionalIdCode}" may not be valid for EDI 834. Expected "HP" or "BE".`
      );
    }
  }

  // Use the existing validateEDI834 function for deeper structural validation
  const ediValidation = validateEDI834(trimmedContent);
  result.segmentCount = ediValidation.segmentCount || 0;

  // Merge errors from the EDI validator, avoiding duplicates
  if (ediValidation.errors && ediValidation.errors.length > 0) {
    for (const error of ediValidation.errors) {
      if (!result.errors.includes(error)) {
        result.errors.push(error);
      }
    }
  }

  result.valid = result.errors.length === 0;

  return result;
}

/**
 * Detects whether a file is a duplicate of any existing files by comparing
 * content hashes and metadata (filename, size).
 *
 * @param {object} file - The file to check for duplicates. Expected properties:
 *   - {string} name - The filename.
 *   - {number} [size] - The file size in bytes.
 *   - {string} [rawContent] - The raw file content for hash comparison.
 *   - {string} [fileContent] - Alternative property for raw file content.
 * @param {Array<object>} existingFiles - An array of existing file records to compare against.
 *   Each record may have: name, size, rawContent, fileContent, contentHash.
 * @returns {{ isDuplicate: boolean, duplicateFileId: string|null, reason: string|null }} The duplicate detection result.
 */
export function detectDuplicate(file, existingFiles) {
  const result = {
    isDuplicate: false,
    duplicateFileId: null,
    reason: null,
  };

  if (!file || typeof file !== 'object') {
    return result;
  }

  if (!Array.isArray(existingFiles) || existingFiles.length === 0) {
    return result;
  }

  const fileContent = file.rawContent || file.fileContent || '';
  const fileName = file.name || file.filename || '';
  const fileSize = typeof file.size === 'number' ? file.size : 0;

  // Content hash comparison (primary method)
  if (fileContent && typeof fileContent === 'string' && fileContent.length > 0) {
    const fileHash = generateContentHash(fileContent);

    for (const existing of existingFiles) {
      const existingContent = existing.rawContent || existing.fileContent || '';

      if (existingContent && typeof existingContent === 'string' && existingContent.length > 0) {
        const existingHash = existing.contentHash || generateContentHash(existingContent);

        if (fileHash === existingHash) {
          result.isDuplicate = true;
          result.duplicateFileId = existing.id || existing.fileId || null;
          result.reason = `File content matches existing file "${existing.name || existing.filename || 'unknown'}" (ID: ${result.duplicateFileId || 'unknown'}).`;
          return result;
        }
      }
    }
  }

  // Metadata comparison (secondary method - filename + size)
  if (fileName && fileSize > 0) {
    for (const existing of existingFiles) {
      const existingName = existing.name || existing.filename || '';
      const existingSize = typeof existing.size === 'number' ? existing.size : 0;

      if (
        existingName &&
        existingSize > 0 &&
        fileName.toLowerCase() === existingName.toLowerCase() &&
        fileSize === existingSize
      ) {
        result.isDuplicate = true;
        result.duplicateFileId = existing.id || existing.fileId || null;
        result.reason = `File "${fileName}" with size ${fileSize} bytes matches existing file (ID: ${result.duplicateFileId || 'unknown'}).`;
        return result;
      }
    }
  }

  return result;
}

export {
  getFileExtension,
  generateContentHash,
  validateFileExtension,
  validateFileSize,
  validateMimeType,
  ALLOWED_MIME_TYPES,
};