import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { STORAGE_KEYS } from '../utils/constants';
import { loadState, saveState } from '../utils/localStorage';
import { mockEncrypt } from '../utils/encryption';
import { delay } from '../utils/helpers';

const INTEGRATION_LOGS_KEY = STORAGE_KEYS.SETTINGS.replace('settings', 'integration_logs');
const INTEGRATION_CONFIG_KEY = STORAGE_KEYS.SETTINGS.replace('settings', 'integration_config');

/**
 * Default integration configuration.
 * @type {object}
 */
const DEFAULT_CONFIG = {
  endpoints: [
    {
      id: 'medicaid-state-system',
      name: 'State Medicaid System',
      url: '/mock-integration/state-medicaid',
      enabled: true,
    },
    {
      id: 'cms-federal',
      name: 'CMS Federal Hub',
      url: '/mock-integration/cms-federal',
      enabled: true,
    },
    {
      id: 'ehr-system',
      name: 'EHR System',
      url: '/mock-integration/ehr',
      enabled: false,
    },
  ],
  retryPolicy: {
    maxRetries: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  },
};

/**
 * Possible integration transmission statuses.
 * @type {object}
 */
const TRANSMISSION_STATUS = Object.freeze({
  PENDING: 'Pending',
  IN_PROGRESS: 'InProgress',
  SUCCESS: 'Success',
  FAILED: 'Failed',
});

/**
 * Loads persisted integration logs from localStorage.
 * @returns {Array<object>} The stored integration logs or empty array.
 */
function loadIntegrationLogs() {
  const data = loadState(INTEGRATION_LOGS_KEY);
  return Array.isArray(data) ? data : [];
}

/**
 * Loads persisted integration config from localStorage.
 * @returns {object} The stored integration config or default config.
 */
function loadIntegrationConfig() {
  const data = loadState(INTEGRATION_CONFIG_KEY);
  if (data && typeof data === 'object' && Array.isArray(data.endpoints)) {
    return data;
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Persists integration logs to localStorage.
 * @param {Array<object>} logs - The integration logs to persist.
 */
function persistIntegrationLogs(logs) {
  saveState(INTEGRATION_LOGS_KEY, logs);
}

/**
 * Persists integration config to localStorage.
 * @param {object} config - The integration config to persist.
 */
function persistIntegrationConfig(config) {
  saveState(INTEGRATION_CONFIG_KEY, config);
}

/**
 * Filters an array of integration log entries based on the provided filter criteria.
 * @param {Array<object>} logs - The logs to filter.
 * @param {object} [filters] - Optional filter criteria.
 * @param {string} [filters.memberId] - Filter by member ID.
 * @param {string} [filters.status] - Filter by transmission status.
 * @param {string} [filters.destination] - Filter by destination endpoint ID.
 * @param {string} [filters.startDate] - Filter logs on or after this ISO date.
 * @param {string} [filters.endDate] - Filter logs on or before this ISO date.
 * @returns {Array<object>} The filtered logs.
 */
function applyFilters(logs, filters) {
  if (!filters || typeof filters !== 'object') {
    return logs;
  }

  let filtered = [...logs];

  if (filters.memberId) {
    filtered = filtered.filter((log) => log.memberId === filters.memberId);
  }

  if (filters.status) {
    filtered = filtered.filter((log) => log.status === filters.status);
  }

  if (filters.destination) {
    filtered = filtered.filter((log) => log.destination === filters.destination);
  }

  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    if (!isNaN(start)) {
      filtered = filtered.filter((log) => new Date(log.timestamp).getTime() >= start);
    }
  }

  if (filters.endDate) {
    const end = new Date(filters.endDate).getTime();
    if (!isNaN(end)) {
      filtered = filtered.filter((log) => new Date(log.timestamp).getTime() <= end);
    }
  }

  return filtered;
}

/**
 * Simulates a network transmission with random success/failure.
 * Applies mock encryption to the payload before "transmitting".
 * @param {object} payload - The data to transmit.
 * @param {object} endpoint - The destination endpoint configuration.
 * @param {number} delayMs - The simulated network delay in milliseconds.
 * @returns {Promise<object>} The simulated response.
 */
async function simulateTransmission(payload, endpoint, delayMs) {
  await delay(delayMs);

  // Mock encrypt the payload
  const encryptedPayload = mockEncrypt(payload);

  // Simulate ~80% success rate
  const isSuccess = Math.random() < 0.8;

  if (isSuccess) {
    return {
      success: true,
      statusCode: 200,
      message: `Data successfully transmitted to ${endpoint.name}.`,
      encryptedPayload: encryptedPayload.encrypted,
      algorithm: encryptedPayload.algorithm,
      respondedAt: new Date().toISOString(),
    };
  }

  // Simulate various failure scenarios
  const failureScenarios = [
    { statusCode: 500, message: `Internal server error at ${endpoint.name}.` },
    { statusCode: 503, message: `${endpoint.name} is temporarily unavailable.` },
    { statusCode: 408, message: `Request to ${endpoint.name} timed out.` },
    { statusCode: 422, message: `${endpoint.name} rejected the payload: validation error.` },
  ];

  const failure = failureScenarios[Math.floor(Math.random() * failureScenarios.length)];

  return {
    success: false,
    statusCode: failure.statusCode,
    message: failure.message,
    encryptedPayload: encryptedPayload.encrypted,
    algorithm: encryptedPayload.algorithm,
    respondedAt: new Date().toISOString(),
  };
}

export const useIntegrationStore = create((set, get) => ({
  integrationLogs: loadIntegrationLogs(),
  integrationConfig: loadIntegrationConfig(),

  /**
   * Transmits enrollment data to all enabled downstream endpoints.
   * Simulates network delay, encryption, and success/failure responses.
   * @param {object} memberData - The member/enrollment data to transmit.
   * @param {object} [user] - The user performing the transmission.
   * @param {string} [user.id] - The user ID.
   * @param {string} [user.name] - The user name.
   * @returns {Promise<Array<object>>} An array of integration log entries for each endpoint.
   */
  transmitEnrollmentData: async (memberData, user) => {
    if (!memberData || typeof memberData !== 'object') {
      return [];
    }

    const { integrationConfig } = get();
    const enabledEndpoints = (integrationConfig.endpoints || []).filter((ep) => ep.enabled);

    if (enabledEndpoints.length === 0) {
      return [];
    }

    const userId = (user && user.id) || '';
    const userName = (user && user.name) || '';
    const memberId = memberData.memberId || memberData.id || '';
    const delayMs = (integrationConfig.retryPolicy && integrationConfig.retryPolicy.delayMs) || 1000;

    const results = [];

    for (const endpoint of enabledEndpoints) {
      const logId = uuidv4();
      const now = new Date().toISOString();

      // Create initial pending log entry
      const pendingEntry = {
        id: logId,
        timestamp: now,
        memberId,
        status: TRANSMISSION_STATUS.IN_PROGRESS,
        destination: endpoint.id,
        destinationName: endpoint.name,
        destinationUrl: endpoint.url,
        userId,
        userName,
        response: null,
        retryCount: 0,
        payload: {
          memberId: memberData.memberId || memberData.id || '',
          firstName: memberData.firstName || '',
          lastName: memberData.lastName || '',
          status: memberData.eligibilityStatus || memberData.status || '',
          coverage: memberData.coverage || '',
          demographics: memberData.demographics || {},
        },
      };

      set((state) => {
        const updatedLogs = [pendingEntry, ...state.integrationLogs];
        persistIntegrationLogs(updatedLogs);
        return { integrationLogs: updatedLogs };
      });

      try {
        const response = await simulateTransmission(pendingEntry.payload, endpoint, delayMs);

        const completedEntry = {
          ...pendingEntry,
          status: response.success ? TRANSMISSION_STATUS.SUCCESS : TRANSMISSION_STATUS.FAILED,
          response,
          completedAt: new Date().toISOString(),
        };

        set((state) => {
          const updatedLogs = state.integrationLogs.map((log) =>
            log.id === logId ? completedEntry : log
          );
          persistIntegrationLogs(updatedLogs);
          return { integrationLogs: updatedLogs };
        });

        results.push(completedEntry);
      } catch (_err) {
        const failedEntry = {
          ...pendingEntry,
          status: TRANSMISSION_STATUS.FAILED,
          response: {
            success: false,
            statusCode: 0,
            message: 'Unexpected error during transmission.',
            respondedAt: new Date().toISOString(),
          },
          completedAt: new Date().toISOString(),
        };

        set((state) => {
          const updatedLogs = state.integrationLogs.map((log) =>
            log.id === logId ? failedEntry : log
          );
          persistIntegrationLogs(updatedLogs);
          return { integrationLogs: updatedLogs };
        });

        results.push(failedEntry);
      }
    }

    return results;
  },

  /**
   * Retrieves integration logs, optionally filtered by the provided criteria.
   * @param {object} [filters] - Optional filter criteria.
   * @param {string} [filters.memberId] - Filter by member ID.
   * @param {string} [filters.status] - Filter by transmission status.
   * @param {string} [filters.destination] - Filter by destination endpoint ID.
   * @param {string} [filters.startDate] - Filter logs on or after this ISO date.
   * @param {string} [filters.endDate] - Filter logs on or before this ISO date.
   * @returns {Array<object>} The filtered integration logs.
   */
  getIntegrationLogs: (filters) => {
    const { integrationLogs } = get();
    return applyFilters(integrationLogs, filters);
  },

  /**
   * Retries a failed transmission by its log ID.
   * Only logs with a Failed status can be retried.
   * Respects the retry policy's maxRetries limit.
   * @param {string} logId - The integration log ID to retry.
   * @returns {Promise<object|null>} The updated log entry, or null if not retryable.
   */
  retryTransmission: async (logId) => {
    if (!logId) {
      return null;
    }

    const { integrationLogs, integrationConfig } = get();
    const logEntry = integrationLogs.find((log) => log.id === logId);

    if (!logEntry) {
      return null;
    }

    if (logEntry.status !== TRANSMISSION_STATUS.FAILED) {
      return null;
    }

    const maxRetries = (integrationConfig.retryPolicy && integrationConfig.retryPolicy.maxRetries) || 3;

    if ((logEntry.retryCount || 0) >= maxRetries) {
      return null;
    }

    const baseDelay = (integrationConfig.retryPolicy && integrationConfig.retryPolicy.delayMs) || 1000;
    const backoffMultiplier = (integrationConfig.retryPolicy && integrationConfig.retryPolicy.backoffMultiplier) || 2;
    const retryCount = (logEntry.retryCount || 0) + 1;
    const retryDelay = baseDelay * Math.pow(backoffMultiplier, retryCount - 1);

    const endpoint = {
      id: logEntry.destination,
      name: logEntry.destinationName || logEntry.destination,
      url: logEntry.destinationUrl || '',
    };

    // Update status to in-progress
    const inProgressEntry = {
      ...logEntry,
      status: TRANSMISSION_STATUS.IN_PROGRESS,
      retryCount,
      response: null,
    };

    set((state) => {
      const updatedLogs = state.integrationLogs.map((log) =>
        log.id === logId ? inProgressEntry : log
      );
      persistIntegrationLogs(updatedLogs);
      return { integrationLogs: updatedLogs };
    });

    try {
      const response = await simulateTransmission(logEntry.payload || {}, endpoint, retryDelay);

      const completedEntry = {
        ...inProgressEntry,
        status: response.success ? TRANSMISSION_STATUS.SUCCESS : TRANSMISSION_STATUS.FAILED,
        response,
        completedAt: new Date().toISOString(),
      };

      set((state) => {
        const updatedLogs = state.integrationLogs.map((log) =>
          log.id === logId ? completedEntry : log
        );
        persistIntegrationLogs(updatedLogs);
        return { integrationLogs: updatedLogs };
      });

      return completedEntry;
    } catch (_err) {
      const failedEntry = {
        ...inProgressEntry,
        status: TRANSMISSION_STATUS.FAILED,
        response: {
          success: false,
          statusCode: 0,
          message: 'Unexpected error during retry transmission.',
          respondedAt: new Date().toISOString(),
        },
        completedAt: new Date().toISOString(),
      };

      set((state) => {
        const updatedLogs = state.integrationLogs.map((log) =>
          log.id === logId ? failedEntry : log
        );
        persistIntegrationLogs(updatedLogs);
        return { integrationLogs: updatedLogs };
      });

      return failedEntry;
    }
  },

  /**
   * Updates the integration configuration (endpoints and retry policy).
   * @param {object} config - The new configuration to apply.
   * @param {Array<object>} [config.endpoints] - The endpoint configurations.
   * @param {object} [config.retryPolicy] - The retry policy configuration.
   * @returns {object} The updated integration configuration.
   */
  configureIntegration: (config) => {
    if (!config || typeof config !== 'object') {
      return get().integrationConfig;
    }

    const { integrationConfig } = get();

    const updatedConfig = {
      ...integrationConfig,
    };

    if (Array.isArray(config.endpoints)) {
      updatedConfig.endpoints = config.endpoints.map((ep) => ({
        id: ep.id || uuidv4(),
        name: ep.name || '',
        url: ep.url || '',
        enabled: typeof ep.enabled === 'boolean' ? ep.enabled : true,
      }));
    }

    if (config.retryPolicy && typeof config.retryPolicy === 'object') {
      updatedConfig.retryPolicy = {
        maxRetries: typeof config.retryPolicy.maxRetries === 'number'
          ? config.retryPolicy.maxRetries
          : (integrationConfig.retryPolicy && integrationConfig.retryPolicy.maxRetries) || 3,
        delayMs: typeof config.retryPolicy.delayMs === 'number'
          ? config.retryPolicy.delayMs
          : (integrationConfig.retryPolicy && integrationConfig.retryPolicy.delayMs) || 1000,
        backoffMultiplier: typeof config.retryPolicy.backoffMultiplier === 'number'
          ? config.retryPolicy.backoffMultiplier
          : (integrationConfig.retryPolicy && integrationConfig.retryPolicy.backoffMultiplier) || 2,
      };
    }

    set({ integrationConfig: updatedConfig });
    persistIntegrationConfig(updatedConfig);

    return updatedConfig;
  },

  /**
   * Clears all integration logs from state and localStorage.
   */
  clearIntegrationLogs: () => {
    set({ integrationLogs: [] });
    persistIntegrationLogs([]);
  },

  /**
   * Resets integration configuration to defaults.
   */
  resetIntegrationConfig: () => {
    const defaults = { ...DEFAULT_CONFIG };
    set({ integrationConfig: defaults });
    persistIntegrationConfig(defaults);
  },

  /**
   * Returns summary statistics about integration transmissions.
   * @returns {{ total: number, success: number, failed: number, inProgress: number, pending: number }} Integration statistics.
   */
  getIntegrationStats: () => {
    const { integrationLogs } = get();

    return {
      total: integrationLogs.length,
      success: integrationLogs.filter((log) => log.status === TRANSMISSION_STATUS.SUCCESS).length,
      failed: integrationLogs.filter((log) => log.status === TRANSMISSION_STATUS.FAILED).length,
      inProgress: integrationLogs.filter((log) => log.status === TRANSMISSION_STATUS.IN_PROGRESS).length,
      pending: integrationLogs.filter((log) => log.status === TRANSMISSION_STATUS.PENDING).length,
    };
  },
}));

/**
 * Standalone transmitEnrollmentData function for use outside of React components.
 * @param {object} memberData - The member/enrollment data to transmit.
 * @param {object} [user] - The user performing the transmission.
 * @returns {Promise<Array<object>>} An array of integration log entries.
 */
export function transmitEnrollmentData(memberData, user) {
  return useIntegrationStore.getState().transmitEnrollmentData(memberData, user);
}

/**
 * Standalone getIntegrationLogs function for use outside of React components.
 * @param {object} [filters] - Optional filter criteria.
 * @returns {Array<object>} The filtered integration logs.
 */
export function getIntegrationLogs(filters) {
  return useIntegrationStore.getState().getIntegrationLogs(filters);
}

/**
 * Standalone retryTransmission function for use outside of React components.
 * @param {string} logId - The integration log ID to retry.
 * @returns {Promise<object|null>} The updated log entry, or null if not retryable.
 */
export function retryTransmission(logId) {
  return useIntegrationStore.getState().retryTransmission(logId);
}

/**
 * Standalone configureIntegration function for use outside of React components.
 * @param {object} config - The new configuration to apply.
 * @returns {object} The updated integration configuration.
 */
export function configureIntegration(config) {
  return useIntegrationStore.getState().configureIntegration(config);
}

export { TRANSMISSION_STATUS, DEFAULT_CONFIG };