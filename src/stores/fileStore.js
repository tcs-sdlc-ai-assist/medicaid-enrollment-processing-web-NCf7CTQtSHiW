import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { FILE_STATUS, STORAGE_KEYS } from '../utils/constants';
import { loadState, saveState } from '../utils/localStorage';

const FILES_KEY = STORAGE_KEYS.FILES;

/**
 * Loads persisted files from localStorage.
 * @returns {Array<object>} The stored files or empty array.
 */
function loadFiles() {
  const data = loadState(FILES_KEY);
  return Array.isArray(data) ? data : [];
}

/**
 * Persists files to localStorage.
 * @param {Array<object>} files - The files to persist.
 */
function persistFiles(files) {
  saveState(FILES_KEY, files);
}

/**
 * Normalizes a file object to ensure all required fields are present.
 * @param {object} file - The raw file data.
 * @returns {object} The normalized file object.
 */
function normalizeFile(file) {
  return {
    id: file.id || uuidv4(),
    name: file.name || file.filename || '',
    uploadSource: file.uploadSource || 'web',
    status: file.status || FILE_STATUS.UPLOADED,
    error: file.error || null,
    timestamp: file.timestamp || new Date().toISOString(),
    members: Array.isArray(file.members) ? [...file.members] : [],
    rawContent: file.rawContent || file.fileContent || '',
    validationErrors: Array.isArray(file.validationErrors) ? [...file.validationErrors] : [],
    processedAt: file.processedAt || null,
    createdAt: file.createdAt || file.timestamp || new Date().toISOString(),
    updatedAt: file.updatedAt || new Date().toISOString(),
  };
}

/**
 * Filters an array of file entries based on the provided filter criteria.
 * @param {Array<object>} files - The files to filter.
 * @param {object} [filters] - Optional filter criteria.
 * @param {string} [filters.status] - Filter by file status.
 * @param {string} [filters.uploadSource] - Filter by upload source.
 * @param {string} [filters.name] - Filter by file name (partial, case-insensitive).
 * @param {string} [filters.startDate] - Filter files on or after this ISO date.
 * @param {string} [filters.endDate] - Filter files on or before this ISO date.
 * @returns {Array<object>} The filtered files.
 */
function applyFilters(files, filters) {
  if (!filters || typeof filters !== 'object') {
    return files;
  }

  let filtered = [...files];

  if (filters.status) {
    filtered = filtered.filter((file) => file.status === filters.status);
  }

  if (filters.uploadSource) {
    filtered = filtered.filter((file) => file.uploadSource === filters.uploadSource);
  }

  if (filters.name) {
    const searchName = filters.name.toLowerCase();
    filtered = filtered.filter(
      (file) => file.name && file.name.toLowerCase().includes(searchName)
    );
  }

  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    if (!isNaN(start)) {
      filtered = filtered.filter(
        (file) => new Date(file.timestamp).getTime() >= start
      );
    }
  }

  if (filters.endDate) {
    const end = new Date(filters.endDate).getTime();
    if (!isNaN(end)) {
      filtered = filtered.filter(
        (file) => new Date(file.timestamp).getTime() <= end
      );
    }
  }

  return filtered;
}

export const useFileStore = create((set, get) => ({
  files: loadFiles(),

  /**
   * Adds a new file to the store.
   * If a file with the same id already exists, it will not be added.
   * @param {object} file - The file data to add.
   * @returns {object|null} The created file record, or null if invalid or duplicate.
   */
  addFile: (file) => {
    if (!file || typeof file !== 'object') {
      return null;
    }

    const normalized = normalizeFile(file);

    let added = null;

    set((state) => {
      // Check for duplicate by id
      const exists = state.files.some((f) => f.id === normalized.id);

      if (exists) {
        return state;
      }

      added = normalized;
      const updatedFiles = [normalized, ...state.files];
      persistFiles(updatedFiles);
      return { files: updatedFiles };
    });

    return added;
  },

  /**
   * Updates the status (and optionally error) of an existing file by id.
   * @param {string} id - The file id to update.
   * @param {string} status - The new status value.
   * @param {string|null} [error] - Optional error message.
   * @returns {object|null} The updated file record, or null if not found.
   */
  updateFileStatus: (id, status, error = null) => {
    if (!id || !status) {
      return null;
    }

    const validStatuses = Object.values(FILE_STATUS);
    if (!validStatuses.includes(status)) {
      return null;
    }

    let updatedFile = null;

    set((state) => {
      const fileIndex = state.files.findIndex((f) => f.id === id);

      if (fileIndex === -1) {
        return state;
      }

      const existing = state.files[fileIndex];
      const now = new Date().toISOString();

      updatedFile = {
        ...existing,
        status,
        error: error || null,
        updatedAt: now,
      };

      // Set processedAt when status is Completed or Failed
      if (status === FILE_STATUS.COMPLETED || status === FILE_STATUS.FAILED) {
        updatedFile.processedAt = now;
      }

      const updatedFiles = [...state.files];
      updatedFiles[fileIndex] = updatedFile;
      persistFiles(updatedFiles);
      return { files: updatedFiles };
    });

    return updatedFile;
  },

  /**
   * Updates an existing file by id with arbitrary fields.
   * @param {string} id - The file id to update.
   * @param {object} updates - The fields to update.
   * @returns {object|null} The updated file record, or null if not found.
   */
  updateFile: (id, updates) => {
    if (!id || !updates || typeof updates !== 'object') {
      return null;
    }

    let updatedFile = null;

    set((state) => {
      const fileIndex = state.files.findIndex((f) => f.id === id);

      if (fileIndex === -1) {
        return state;
      }

      const existing = state.files[fileIndex];
      const now = new Date().toISOString();

      updatedFile = {
        ...existing,
        ...updates,
        id: existing.id, // Prevent id override
        updatedAt: now,
      };

      // If members are being updated, replace them
      if (Array.isArray(updates.members)) {
        updatedFile.members = [...updates.members];
      }

      // If validationErrors are being updated, replace them
      if (Array.isArray(updates.validationErrors)) {
        updatedFile.validationErrors = [...updates.validationErrors];
      }

      const updatedFiles = [...state.files];
      updatedFiles[fileIndex] = updatedFile;
      persistFiles(updatedFiles);
      return { files: updatedFiles };
    });

    return updatedFile;
  },

  /**
   * Retrieves a file by id.
   * @param {string} id - The file id to look up.
   * @returns {object|null} The file record, or null if not found.
   */
  getFile: (id) => {
    if (!id) {
      return null;
    }

    const { files } = get();
    const file = files.find((f) => f.id === id);
    return file || null;
  },

  /**
   * Retrieves files, optionally filtered by the provided criteria.
   * @param {object} [filters] - Optional filter criteria.
   * @param {string} [filters.status] - Filter by file status.
   * @param {string} [filters.uploadSource] - Filter by upload source.
   * @param {string} [filters.name] - Filter by file name (partial, case-insensitive).
   * @param {string} [filters.startDate] - Filter files on or after this ISO date.
   * @param {string} [filters.endDate] - Filter files on or before this ISO date.
   * @returns {Array<object>} The filtered files.
   */
  getFiles: (filters) => {
    const { files } = get();
    return applyFilters(files, filters);
  },

  /**
   * Retries a failed file by resetting its status to Uploaded and clearing errors.
   * Only files with a Failed status can be retried.
   * @param {string} id - The file id to retry.
   * @returns {object|null} The updated file record, or null if not found or not in Failed status.
   */
  retryFile: (id) => {
    if (!id) {
      return null;
    }

    let updatedFile = null;

    set((state) => {
      const fileIndex = state.files.findIndex((f) => f.id === id);

      if (fileIndex === -1) {
        return state;
      }

      const existing = state.files[fileIndex];

      // Only allow retry on failed files
      if (existing.status !== FILE_STATUS.FAILED) {
        return state;
      }

      const now = new Date().toISOString();

      updatedFile = {
        ...existing,
        status: FILE_STATUS.UPLOADED,
        error: null,
        validationErrors: [],
        processedAt: null,
        updatedAt: now,
      };

      const updatedFiles = [...state.files];
      updatedFiles[fileIndex] = updatedFile;
      persistFiles(updatedFiles);
      return { files: updatedFiles };
    });

    return updatedFile;
  },

  /**
   * Removes a file by id.
   * @param {string} id - The file id to remove.
   * @returns {boolean} True if the file was found and removed.
   */
  removeFile: (id) => {
    if (!id) {
      return false;
    }

    let found = false;

    set((state) => {
      const fileIndex = state.files.findIndex((f) => f.id === id);

      if (fileIndex === -1) {
        return state;
      }

      found = true;
      const updatedFiles = state.files.filter((f) => f.id !== id);
      persistFiles(updatedFiles);
      return { files: updatedFiles };
    });

    return found;
  },

  /**
   * Clears all files from state and localStorage.
   */
  clearFiles: () => {
    set({ files: [] });
    persistFiles([]);
  },

  /**
   * Returns the total count of files, optionally filtered by status.
   * @param {string} [status] - Optional status to filter by.
   * @returns {number} The count of matching files.
   */
  getFileCount: (status) => {
    const { files } = get();

    if (!status) {
      return files.length;
    }

    return files.filter((f) => f.status === status).length;
  },

  /**
   * Returns summary statistics about files in the store.
   * @returns {{ total: number, uploaded: number, validating: number, parsing: number, processing: number, completed: number, failed: number }} File statistics.
   */
  getFileStats: () => {
    const { files } = get();

    return {
      total: files.length,
      uploaded: files.filter((f) => f.status === FILE_STATUS.UPLOADED).length,
      validating: files.filter((f) => f.status === FILE_STATUS.VALIDATING).length,
      parsing: files.filter((f) => f.status === FILE_STATUS.PARSING).length,
      processing: files.filter((f) => f.status === FILE_STATUS.PROCESSING).length,
      completed: files.filter((f) => f.status === FILE_STATUS.COMPLETED).length,
      failed: files.filter((f) => f.status === FILE_STATUS.FAILED).length,
    };
  },
}));

/**
 * Standalone addFile function for use outside of React components.
 * @param {object} file - The file data to add.
 * @returns {object|null} The created file record, or null if invalid or duplicate.
 */
export function addFile(file) {
  return useFileStore.getState().addFile(file);
}

/**
 * Standalone updateFileStatus function for use outside of React components.
 * @param {string} id - The file id to update.
 * @param {string} status - The new status value.
 * @param {string|null} [error] - Optional error message.
 * @returns {object|null} The updated file record, or null if not found.
 */
export function updateFileStatus(id, status, error) {
  return useFileStore.getState().updateFileStatus(id, status, error);
}

/**
 * Standalone getFile function for use outside of React components.
 * @param {string} id - The file id to look up.
 * @returns {object|null} The file record, or null if not found.
 */
export function getFile(id) {
  return useFileStore.getState().getFile(id);
}

/**
 * Standalone getFiles function for use outside of React components.
 * @param {object} [filters] - Optional filter criteria.
 * @returns {Array<object>} The filtered files.
 */
export function getFiles(filters) {
  return useFileStore.getState().getFiles(filters);
}

/**
 * Standalone retryFile function for use outside of React components.
 * @param {string} id - The file id to retry.
 * @returns {object|null} The updated file record, or null if not retryable.
 */
export function retryFile(id) {
  return useFileStore.getState().retryFile(id);
}

/**
 * Standalone removeFile function for use outside of React components.
 * @param {string} id - The file id to remove.
 * @returns {boolean} True if the file was found and removed.
 */
export function removeFile(id) {
  return useFileStore.getState().removeFile(id);
}