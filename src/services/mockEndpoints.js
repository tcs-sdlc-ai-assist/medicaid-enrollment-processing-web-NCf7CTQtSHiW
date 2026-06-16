import { v4 as uuidv4 } from 'uuid';
import { delay } from '../utils/helpers';
import { MOCK_API_DELAY_MS } from '../utils/constants';
import { processFile } from './processingPipeline';
import { useFileStore } from '../stores/fileStore';
import { useMemberStore } from '../stores/memberStore';
import { useEnrollmentStore } from '../stores/enrollmentStore';
import { useAuditStore } from '../stores/auditStore';
import { useIntegrationStore } from '../stores/integrationStore';

/**
 * Simulated HTTP status codes for mock responses.
 * @type {object}
 */
const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
});

/**
 * Creates a standardized mock API response object.
 * @param {string} status - The response status ('success' or 'error').
 * @param {number} statusCode - The HTTP status code.
 * @param {string} message - A descriptive message.
 * @param {object|null} [data] - Optional response data payload.
 * @param {string|null} [errorCode] - Optional error code for error responses.
 * @returns {{ status: string, statusCode: number, message: string, data: object|null, errorCode: string|null, timestamp: string }}
 */
function createResponse(status, statusCode, message, data = null, errorCode = null) {
  return {
    status,
    statusCode,
    message: message || '',
    data: data || null,
    errorCode: errorCode || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validates the file data payload for upload endpoints.
 * @param {object} fileData - The file data to validate.
 * @returns {{ valid: boolean, errors: Array<string> }}
 */
function validateUploadPayload(fileData) {
  const errors = [];

  if (!fileData || typeof fileData !== 'object') {
    errors.push('Request body is required.');
    return { valid: false, errors };
  }

  const filename = fileData.filename || fileData.name || '';
  const fileContent = fileData.fileContent || fileData.rawContent || '';

  if (!filename || typeof filename !== 'string' || filename.trim().length === 0) {
    errors.push('Filename is required.');
  }

  if (!fileContent || typeof fileContent !== 'string' || fileContent.trim().length === 0) {
    errors.push('File content is required.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Simulates a POST /mock-api/files/upload endpoint.
 * Validates the file data, then processes it through the full pipeline.
 *
 * @param {object} fileData - The file data to upload. Expected properties:
 *   - {string} filename - The filename.
 *   - {string} fileContent - The raw file content string.
 *   - {string} [userId] - Optional user ID performing the upload.
 *   - {string} [userName] - Optional user name performing the upload.
 * @returns {Promise<object>} A structured mock API response.
 */
export async function mockApiUpload(fileData) {
  await delay(MOCK_API_DELAY_MS / 2);

  const validation = validateUploadPayload(fileData);

  if (!validation.valid) {
    return createResponse(
      'error',
      HTTP_STATUS.BAD_REQUEST,
      `File upload validation failed: ${validation.errors.join('; ')}`,
      null,
      'INVALID_PAYLOAD'
    );
  }

  const filename = fileData.filename || fileData.name || '';
  const fileContent = fileData.fileContent || fileData.rawContent || '';
  const userId = fileData.userId || '';
  const userName = fileData.userName || '';

  const file = {
    name: filename,
    size: new Blob([fileContent]).size,
    type: 'text/plain',
    rawContent: fileContent,
  };

  try {
    const pipelineResult = await processFile(file, {
      uploadSource: 'api',
      userId,
      userName,
      skipIntegration: false,
    });

    if (pipelineResult.success) {
      return createResponse(
        'success',
        HTTP_STATUS.CREATED,
        'File uploaded and processing started.',
        {
          fileId: pipelineResult.fileId,
          memberCount: pipelineResult.members.length,
          enrollmentCount: pipelineResult.enrollments.length,
          integrationCount: pipelineResult.integrationResults.length,
          stages: pipelineResult.stages,
        }
      );
    }

    return createResponse(
      'error',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      `File processing failed: ${pipelineResult.errors.join('; ')}`,
      {
        fileId: pipelineResult.fileId,
        errors: pipelineResult.errors,
        stages: pipelineResult.stages,
      },
      'PROCESSING_FAILED'
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error during API upload.';
    return createResponse(
      'error',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      errorMessage,
      null,
      'INTERNAL_ERROR'
    );
  }
}

/**
 * Simulates a POST /mock-sftp/files/upload endpoint.
 * Validates the file data, then processes it through the full pipeline with 'sftp' upload source.
 *
 * @param {object} fileData - The file data to upload. Expected properties:
 *   - {string} filename - The filename.
 *   - {string} fileContent - The raw file content string.
 *   - {string} [userId] - Optional user ID performing the upload.
 *   - {string} [userName] - Optional user name performing the upload.
 * @returns {Promise<object>} A structured mock API response.
 */
export async function mockSftpUpload(fileData) {
  // SFTP has slightly longer simulated latency
  await delay(MOCK_API_DELAY_MS);

  const validation = validateUploadPayload(fileData);

  if (!validation.valid) {
    return createResponse(
      'error',
      HTTP_STATUS.BAD_REQUEST,
      `SFTP upload validation failed: ${validation.errors.join('; ')}`,
      null,
      'INVALID_PAYLOAD'
    );
  }

  const filename = fileData.filename || fileData.name || '';
  const fileContent = fileData.fileContent || fileData.rawContent || '';
  const userId = fileData.userId || '';
  const userName = fileData.userName || '';

  const file = {
    name: filename,
    size: new Blob([fileContent]).size,
    type: 'application/octet-stream',
    rawContent: fileContent,
  };

  try {
    const pipelineResult = await processFile(file, {
      uploadSource: 'sftp',
      userId,
      userName,
      skipIntegration: false,
    });

    if (pipelineResult.success) {
      return createResponse(
        'success',
        HTTP_STATUS.CREATED,
        'File received via SFTP and processing started.',
        {
          fileId: pipelineResult.fileId,
          memberCount: pipelineResult.members.length,
          enrollmentCount: pipelineResult.enrollments.length,
          integrationCount: pipelineResult.integrationResults.length,
          stages: pipelineResult.stages,
        }
      );
    }

    return createResponse(
      'error',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      `SFTP file processing failed: ${pipelineResult.errors.join('; ')}`,
      {
        fileId: pipelineResult.fileId,
        errors: pipelineResult.errors,
        stages: pipelineResult.stages,
      },
      'PROCESSING_FAILED'
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error during SFTP upload.';
    return createResponse(
      'error',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      errorMessage,
      null,
      'INTERNAL_ERROR'
    );
  }
}

/**
 * Simulates a GET /dashboard/status endpoint.
 * Returns aggregated file, member, enrollment, and integration statistics.
 *
 * @returns {Promise<object>} A structured mock API response containing dashboard status data.
 */
export async function mockGetDashboardStatus() {
  await delay(MOCK_API_DELAY_MS / 2);

  try {
    const fileStats = useFileStore.getState().getFileStats();
    const files = useFileStore.getState().getFiles();
    const memberCount = useMemberStore.getState().getMemberCount();
    const enrollmentStats = useEnrollmentStore.getState().getEnrollmentStats();
    const integrationStats = useIntegrationStore.getState().getIntegrationStats();

    const recentFiles = files.slice(0, 10).map((file) => ({
      fileId: file.id,
      filename: file.name,
      status: file.status,
      uploadSource: file.uploadSource,
      errors: file.validationErrors || [],
      processedAt: file.processedAt || null,
      timestamp: file.timestamp,
      memberCount: Array.isArray(file.members) ? file.members.length : 0,
    }));

    return createResponse(
      'success',
      HTTP_STATUS.OK,
      'Dashboard status retrieved successfully.',
      {
        files: recentFiles,
        fileStats,
        memberStats: {
          total: memberCount,
          eligible: useMemberStore.getState().getMemberCount('Eligible'),
          ineligible: useMemberStore.getState().getMemberCount('Ineligible'),
          pending: useMemberStore.getState().getMemberCount('Pending'),
        },
        enrollmentStats,
        integrationStats,
        retrievedAt: new Date().toISOString(),
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error retrieving dashboard status.';
    return createResponse(
      'error',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      errorMessage,
      null,
      'INTERNAL_ERROR'
    );
  }
}

/**
 * Simulates a GET /audit/logs endpoint.
 * Returns filtered audit logs and error logs.
 *
 * @param {object} [filters] - Optional filter criteria.
 * @param {string} [filters.action] - Filter by action type.
 * @param {string} [filters.entityId] - Filter by entity ID.
 * @param {string} [filters.userId] - Filter by user ID.
 * @param {string} [filters.startDate] - Filter logs on or after this ISO date.
 * @param {string} [filters.endDate] - Filter logs on or before this ISO date.
 * @param {string} [filters.errorType] - Filter error logs by error type.
 * @param {string} [filters.fileId] - Filter by file ID.
 * @param {string} [filters.memberId] - Filter by member ID.
 * @returns {Promise<object>} A structured mock API response containing audit and error logs.
 */
export async function mockGetAuditLogs(filters) {
  await delay(MOCK_API_DELAY_MS / 2);

  try {
    const auditStore = useAuditStore.getState();
    const auditLogs = auditStore.getLogs(filters);
    const errorLogs = auditStore.getErrorLogs(filters);

    return createResponse(
      'success',
      HTTP_STATUS.OK,
      'Audit logs retrieved successfully.',
      {
        logs: auditLogs,
        errorLogs,
        totalAuditLogs: auditLogs.length,
        totalErrorLogs: errorLogs.length,
        filters: filters || null,
        retrievedAt: new Date().toISOString(),
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error retrieving audit logs.';
    return createResponse(
      'error',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      errorMessage,
      null,
      'INTERNAL_ERROR'
    );
  }
}

/**
 * Simulates a GET /enrollments endpoint.
 * Returns filtered enrollment records.
 *
 * @param {object} [filters] - Optional filter criteria.
 * @param {string} [filters.memberId] - Filter by member ID.
 * @param {string} [filters.planId] - Filter by plan ID.
 * @param {string} [filters.status] - Filter by enrollment status.
 * @param {string} [filters.startDate] - Filter enrollments on or after this ISO date.
 * @param {string} [filters.endDate] - Filter enrollments on or before this ISO date.
 * @returns {Promise<object>} A structured mock API response containing enrollment records.
 */
export async function mockGetEnrollments(filters) {
  await delay(MOCK_API_DELAY_MS / 2);

  try {
    const enrollmentStore = useEnrollmentStore.getState();
    const enrollments = enrollmentStore.getEnrollments(filters);
    const stats = enrollmentStore.getEnrollmentStats();

    return createResponse(
      'success',
      HTTP_STATUS.OK,
      'Enrollments retrieved successfully.',
      {
        enrollments,
        totalCount: enrollments.length,
        stats,
        filters: filters || null,
        retrievedAt: new Date().toISOString(),
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error retrieving enrollments.';
    return createResponse(
      'error',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      errorMessage,
      null,
      'INTERNAL_ERROR'
    );
  }
}

/**
 * Simulates a GET /members/search endpoint.
 * Returns members matching the provided search criteria.
 *
 * @param {object} [criteria] - Optional search criteria as key-value pairs.
 * @param {string} [criteria.firstName] - Filter by first name (partial, case-insensitive).
 * @param {string} [criteria.lastName] - Filter by last name (partial, case-insensitive).
 * @param {string} [criteria.memberId] - Filter by member ID.
 * @param {string} [criteria.status] - Filter by eligibility status.
 * @param {string} [criteria.eligibilityStatus] - Filter by eligibility status (alias).
 * @returns {Promise<object>} A structured mock API response containing matching members.
 */
export async function mockGetMembers(criteria) {
  await delay(MOCK_API_DELAY_MS / 2);

  try {
    const memberStore = useMemberStore.getState();
    const members = memberStore.searchMembers(criteria);

    const memberResults = members.map((member) => ({
      memberId: member.memberId,
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      status: member.status || member.eligibilityStatus,
      eligibilityStatus: member.eligibilityStatus || member.status,
      demographics: member.demographics || {},
      coverage: member.coverage || '',
      enrollmentHistory: Array.isArray(member.enrollmentHistory)
        ? member.enrollmentHistory
        : Array.isArray(member.history)
          ? member.history
          : [],
      createdAt: member.createdAt || '',
      updatedAt: member.updatedAt || '',
    }));

    return createResponse(
      'success',
      HTTP_STATUS.OK,
      `Found ${memberResults.length} member(s).`,
      {
        members: memberResults,
        totalCount: memberResults.length,
        criteria: criteria || null,
        retrievedAt: new Date().toISOString(),
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error searching members.';
    return createResponse(
      'error',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      errorMessage,
      null,
      'INTERNAL_ERROR'
    );
  }
}

export { HTTP_STATUS, createResponse, validateUploadPayload };