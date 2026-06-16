import { v4 as uuidv4 } from 'uuid';
import { FILE_STATUS, MEMBER_STATUS, MOCK_API_DELAY_MS } from '../utils/constants';
import { delay } from '../utils/helpers';
import { validateFile, validateEDI834Format, detectDuplicate } from './fileValidator';
import { parseEDI834 } from './edi834Parser';
import { useFileStore } from '../stores/fileStore';
import { useMemberStore } from '../stores/memberStore';
import { useEligibilityStore } from '../stores/eligibilityStore';
import { useEnrollmentStore } from '../stores/enrollmentStore';
import { useIntegrationStore } from '../stores/integrationStore';
import { useAuditStore } from '../stores/auditStore';

/**
 * Pipeline stage names for status tracking.
 * @type {object}
 */
const PIPELINE_STAGES = Object.freeze({
  UPLOAD: 'Upload',
  VALIDATE: 'Validate',
  PARSE: 'Parse',
  ELIGIBILITY: 'Eligibility',
  CATEGORIZE: 'Categorize',
  ENROLLMENT: 'Enrollment',
  INTEGRATION: 'Integration',
  COMPLETE: 'Complete',
});

/**
 * Creates a pipeline status update object.
 * @param {string} fileId - The file ID being processed.
 * @param {string} stage - The current pipeline stage.
 * @param {string} status - The status of the stage ('started', 'completed', 'failed').
 * @param {string|null} [message] - Optional message describing the status.
 * @param {object|null} [details] - Optional additional details.
 * @returns {object} The pipeline status update object.
 */
function createStatusUpdate(fileId, stage, status, message = null, details = null) {
  return {
    fileId,
    stage,
    status,
    message: message || '',
    details: details || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Processes a single file through the upload stage.
 * Validates the file metadata and checks for duplicates.
 *
 * @param {object} file - The file object to process. Expected properties:
 *   - {string} name - The filename.
 *   - {number} size - The file size in bytes.
 *   - {string} [type] - The MIME type.
 *   - {string} rawContent - The raw file content string.
 * @param {string} uploadSource - The upload source ('web', 'api', 'sftp').
 * @param {string} userId - The ID of the user performing the upload.
 * @param {Function} [onStatusUpdate] - Optional callback for status updates.
 * @returns {Promise<object>} The created file record, or throws on failure.
 */
async function processUploadStage(file, uploadSource, userId, onStatusUpdate) {
  const fileId = uuidv4();

  if (onStatusUpdate) {
    onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.UPLOAD, 'started', 'Starting file upload.'));
  }

  await delay(MOCK_API_DELAY_MS / 2);

  // Validate file metadata
  const fileValidation = validateFile(file);
  if (!fileValidation.valid) {
    const errorMessage = `File validation failed: ${fileValidation.errors.join('; ')}`;

    useAuditStore.getState().logError('ValidationError', errorMessage, fileId, null);
    useAuditStore.getState().logAction('File Upload Failed', fileId, userId, {
      errors: fileValidation.errors,
      fileName: file.name || '',
    });

    if (onStatusUpdate) {
      onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.UPLOAD, 'failed', errorMessage));
    }

    throw new Error(errorMessage);
  }

  // Check for duplicates
  const existingFiles = useFileStore.getState().getFiles();
  const duplicateResult = detectDuplicate(file, existingFiles);

  if (duplicateResult.isDuplicate) {
    const errorMessage = `Duplicate file detected: ${duplicateResult.reason}`;

    useAuditStore.getState().logError('DuplicateFileError', errorMessage, fileId, null);
    useAuditStore.getState().logAction('File Upload Failed - Duplicate', fileId, userId, {
      duplicateFileId: duplicateResult.duplicateFileId,
      reason: duplicateResult.reason,
    });

    if (onStatusUpdate) {
      onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.UPLOAD, 'failed', errorMessage));
    }

    throw new Error(errorMessage);
  }

  // Add file to store
  const fileRecord = useFileStore.getState().addFile({
    id: fileId,
    name: file.name || '',
    uploadSource: uploadSource || 'web',
    status: FILE_STATUS.UPLOADED,
    rawContent: file.rawContent || '',
    timestamp: new Date().toISOString(),
  });

  useAuditStore.getState().logAction('File Uploaded', fileId, userId, {
    fileName: file.name || '',
    fileSize: file.size || 0,
    uploadSource: uploadSource || 'web',
  });

  if (onStatusUpdate) {
    onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.UPLOAD, 'completed', 'File uploaded successfully.'));
  }

  return fileRecord;
}

/**
 * Processes the validation stage for a file.
 * Validates the EDI 834 format of the file content.
 *
 * @param {string} fileId - The file ID to validate.
 * @param {string} rawContent - The raw file content string.
 * @param {string} userId - The ID of the user.
 * @param {Function} [onStatusUpdate] - Optional callback for status updates.
 * @returns {Promise<object>} The validation result.
 */
async function processValidationStage(fileId, rawContent, userId, onStatusUpdate) {
  if (onStatusUpdate) {
    onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.VALIDATE, 'started', 'Validating EDI 834 format.'));
  }

  useFileStore.getState().updateFileStatus(fileId, FILE_STATUS.VALIDATING);

  await delay(MOCK_API_DELAY_MS);

  const validationResult = validateEDI834Format(rawContent);

  if (!validationResult.valid) {
    const errorMessage = `EDI 834 format validation failed: ${validationResult.errors.join('; ')}`;

    useFileStore.getState().updateFileStatus(fileId, FILE_STATUS.FAILED, errorMessage);
    useFileStore.getState().updateFile(fileId, {
      validationErrors: validationResult.errors,
    });

    useAuditStore.getState().logError('ValidationError', errorMessage, fileId, null);
    useAuditStore.getState().logAction('File Validation Failed', fileId, userId, {
      errors: validationResult.errors,
      segmentCount: validationResult.segmentCount,
    });

    if (onStatusUpdate) {
      onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.VALIDATE, 'failed', errorMessage, {
        errors: validationResult.errors,
      }));
    }

    throw new Error(errorMessage);
  }

  useAuditStore.getState().logAction('File Validated', fileId, userId, {
    segmentCount: validationResult.segmentCount,
  });

  if (onStatusUpdate) {
    onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.VALIDATE, 'completed', 'EDI 834 format validation passed.', {
      segmentCount: validationResult.segmentCount,
    }));
  }

  return validationResult;
}

/**
 * Processes the parsing stage for a file.
 * Parses the EDI 834 content and extracts member data.
 *
 * @param {string} fileId - The file ID to parse.
 * @param {string} rawContent - The raw file content string.
 * @param {string} userId - The ID of the user.
 * @param {Function} [onStatusUpdate] - Optional callback for status updates.
 * @returns {Promise<object>} The parsing result containing extracted members.
 */
async function processParsingStage(fileId, rawContent, userId, onStatusUpdate) {
  if (onStatusUpdate) {
    onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.PARSE, 'started', 'Parsing EDI 834 content.'));
  }

  useFileStore.getState().updateFileStatus(fileId, FILE_STATUS.PARSING);

  await delay(MOCK_API_DELAY_MS);

  const parseResult = parseEDI834(rawContent);

  if (!parseResult.success) {
    const errorMessage = `EDI 834 parsing failed: ${parseResult.errors.join('; ')}`;

    useFileStore.getState().updateFileStatus(fileId, FILE_STATUS.FAILED, errorMessage);

    useAuditStore.getState().logError('ParsingError', errorMessage, fileId, null);
    useAuditStore.getState().logAction('File Parsing Failed', fileId, userId, {
      errors: parseResult.errors,
    });

    if (onStatusUpdate) {
      onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.PARSE, 'failed', errorMessage, {
        errors: parseResult.errors,
      }));
    }

    throw new Error(errorMessage);
  }

  if (parseResult.members.length === 0) {
    const errorMessage = 'No members found in the EDI 834 file.';

    useFileStore.getState().updateFileStatus(fileId, FILE_STATUS.FAILED, errorMessage);

    useAuditStore.getState().logError('ParsingError', errorMessage, fileId, null);
    useAuditStore.getState().logAction('File Parsing Failed - No Members', fileId, userId);

    if (onStatusUpdate) {
      onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.PARSE, 'failed', errorMessage));
    }

    throw new Error(errorMessage);
  }

  useAuditStore.getState().logAction('File Parsed', fileId, userId, {
    memberCount: parseResult.members.length,
    totalSegments: parseResult.metadata.totalSegments,
  });

  if (onStatusUpdate) {
    onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.PARSE, 'completed', `Parsed ${parseResult.members.length} member(s).`, {
      memberCount: parseResult.members.length,
      totalSegments: parseResult.metadata.totalSegments,
    }));
  }

  return parseResult;
}

/**
 * Processes the eligibility determination stage for extracted members.
 * Applies eligibility rules to each member and categorizes them.
 *
 * @param {string} fileId - The file ID being processed.
 * @param {Array<object>} members - The extracted member records.
 * @param {string} userId - The ID of the user.
 * @param {Function} [onStatusUpdate] - Optional callback for status updates.
 * @returns {Promise<Array<object>>} The members with eligibility status applied.
 */
async function processEligibilityStage(fileId, members, userId, onStatusUpdate) {
  if (onStatusUpdate) {
    onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.ELIGIBILITY, 'started', `Determining eligibility for ${members.length} member(s).`));
  }

  useFileStore.getState().updateFileStatus(fileId, FILE_STATUS.PROCESSING);

  await delay(MOCK_API_DELAY_MS / 2);

  const processedMembers = [];
  const eligibilityStore = useEligibilityStore.getState();

  for (const member of members) {
    try {
      // Determine state code from member address if available
      const stateCode = (member.demographics &&
        member.demographics.address &&
        member.demographics.address.state) || '';

      const eligibilityStatus = eligibilityStore.determineEligibility(member, stateCode);

      const processedMember = {
        ...member,
        eligibilityStatus,
        status: eligibilityStatus,
      };

      processedMembers.push(processedMember);

      useAuditStore.getState().logAction('Eligibility Determined', member.memberId || member.id, userId, {
        fileId,
        eligibilityStatus,
        stateCode: stateCode || 'N/A',
        firstName: member.firstName || '',
        lastName: member.lastName || '',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown eligibility error.';

      useAuditStore.getState().logError('EligibilityError', errorMessage, fileId, member.memberId || member.id);

      // Default to Pending on error
      const processedMember = {
        ...member,
        eligibilityStatus: MEMBER_STATUS.PENDING,
        status: MEMBER_STATUS.PENDING,
      };

      processedMembers.push(processedMember);
    }
  }

  const eligible = processedMembers.filter((m) => m.eligibilityStatus === MEMBER_STATUS.ELIGIBLE).length;
  const ineligible = processedMembers.filter((m) => m.eligibilityStatus === MEMBER_STATUS.INELIGIBLE).length;
  const pending = processedMembers.filter((m) => m.eligibilityStatus === MEMBER_STATUS.PENDING).length;

  if (onStatusUpdate) {
    onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.ELIGIBILITY, 'completed', `Eligibility determined: ${eligible} eligible, ${ineligible} ineligible, ${pending} pending.`, {
      eligible,
      ineligible,
      pending,
    }));
  }

  return processedMembers;
}

/**
 * Processes the member categorization stage.
 * Adds or updates members in the member store and categorizes them.
 *
 * @param {string} fileId - The file ID being processed.
 * @param {Array<object>} members - The members with eligibility status.
 * @param {string} userId - The ID of the user.
 * @param {Function} [onStatusUpdate] - Optional callback for status updates.
 * @returns {Promise<Array<object>>} The stored member records.
 */
async function processCategorizationStage(fileId, members, userId, onStatusUpdate) {
  if (onStatusUpdate) {
    onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.CATEGORIZE, 'started', `Categorizing ${members.length} member(s).`));
  }

  await delay(MOCK_API_DELAY_MS / 2);

  const memberStore = useMemberStore.getState();
  const storedMembers = [];

  for (const member of members) {
    try {
      // Check if member already exists
      const existingMember = memberStore.getMember(member.memberId || member.id);

      if (existingMember) {
        // Update existing member
        const updated = memberStore.updateMember(existingMember.id, {
          firstName: member.firstName || existingMember.firstName,
          lastName: member.lastName || existingMember.lastName,
          demographics: member.demographics || existingMember.demographics,
          coverage: member.coverage || existingMember.coverage,
          eligibilityStatus: member.eligibilityStatus,
          status: member.eligibilityStatus,
        });

        if (updated) {
          memberStore.categorizeMember(updated.id, member.eligibilityStatus);
          storedMembers.push(updated);

          useAuditStore.getState().logAction('Member Updated', updated.id, userId, {
            fileId,
            memberId: updated.memberId,
            eligibilityStatus: member.eligibilityStatus,
          });
        }
      } else {
        // Add new member
        const added = memberStore.addMember(member);

        if (added) {
          memberStore.categorizeMember(added.id, member.eligibilityStatus);
          storedMembers.push(added);

          useAuditStore.getState().logAction('Member Added', added.id, userId, {
            fileId,
            memberId: added.memberId,
            firstName: added.firstName,
            lastName: added.lastName,
            eligibilityStatus: member.eligibilityStatus,
          });
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown categorization error.';
      useAuditStore.getState().logError('CategorizationError', errorMessage, fileId, member.memberId || member.id);
    }
  }

  if (onStatusUpdate) {
    onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.CATEGORIZE, 'completed', `Categorized ${storedMembers.length} member(s).`, {
      categorizedCount: storedMembers.length,
    }));
  }

  return storedMembers;
}

/**
 * Processes the enrollment creation stage.
 * Creates enrollment records for eligible members.
 *
 * @param {string} fileId - The file ID being processed.
 * @param {Array<object>} members - The categorized member records.
 * @param {string} userId - The ID of the user.
 * @param {Function} [onStatusUpdate] - Optional callback for status updates.
 * @returns {Promise<Array<object>>} The created enrollment records.
 */
async function processEnrollmentStage(fileId, members, userId, onStatusUpdate) {
  if (onStatusUpdate) {
    onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.ENROLLMENT, 'started', `Creating enrollment records for ${members.length} member(s).`));
  }

  await delay(MOCK_API_DELAY_MS / 2);

  const enrollmentStore = useEnrollmentStore.getState();
  const enrollments = [];

  for (const member of members) {
    try {
      const enrollmentData = {
        memberId: member.memberId || member.id,
        planId: member.coverage || 'MEDICAID_DEFAULT',
        status: member.eligibilityStatus || MEMBER_STATUS.PENDING,
        effectiveDate: member.effectiveDate || null,
        terminationDate: member.terminationDate || null,
        coverage: member.coverage || '',
        demographics: member.demographics || {},
      };

      const enrollment = enrollmentStore.createEnrollment(enrollmentData);

      if (enrollment) {
        enrollments.push(enrollment);

        useAuditStore.getState().logAction('Enrollment Created', enrollment.id, userId, {
          fileId,
          memberId: enrollmentData.memberId,
          status: enrollmentData.status,
          planId: enrollmentData.planId,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown enrollment error.';
      useAuditStore.getState().logError('EnrollmentError', errorMessage, fileId, member.memberId || member.id);
    }
  }

  if (onStatusUpdate) {
    onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.ENROLLMENT, 'completed', `Created ${enrollments.length} enrollment record(s).`, {
      enrollmentCount: enrollments.length,
    }));
  }

  return enrollments;
}

/**
 * Processes the integration stage.
 * Transmits eligible member data to downstream systems.
 *
 * @param {string} fileId - The file ID being processed.
 * @param {Array<object>} members - The member records to transmit.
 * @param {string} userId - The ID of the user.
 * @param {string} [userName] - The name of the user.
 * @param {Function} [onStatusUpdate] - Optional callback for status updates.
 * @returns {Promise<Array<object>>} The integration log entries.
 */
async function processIntegrationStage(fileId, members, userId, userName, onStatusUpdate) {
  const eligibleMembers = members.filter(
    (m) => m.eligibilityStatus === MEMBER_STATUS.ELIGIBLE || m.status === MEMBER_STATUS.ELIGIBLE
  );

  if (eligibleMembers.length === 0) {
    if (onStatusUpdate) {
      onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.INTEGRATION, 'completed', 'No eligible members to transmit.'));
    }
    return [];
  }

  if (onStatusUpdate) {
    onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.INTEGRATION, 'started', `Transmitting ${eligibleMembers.length} eligible member(s) to downstream systems.`));
  }

  const integrationStore = useIntegrationStore.getState();
  const user = { id: userId, name: userName || '' };
  const allResults = [];

  for (const member of eligibleMembers) {
    try {
      const results = await integrationStore.transmitEnrollmentData(member, user);
      allResults.push(...results);

      useAuditStore.getState().logAction('Member Data Transmitted', member.memberId || member.id, userId, {
        fileId,
        transmissionCount: results.length,
        successCount: results.filter((r) => r.status === 'Success').length,
        failedCount: results.filter((r) => r.status === 'Failed').length,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown integration error.';
      useAuditStore.getState().logError('IntegrationError', errorMessage, fileId, member.memberId || member.id);
    }
  }

  const successCount = allResults.filter((r) => r.status === 'Success').length;
  const failedCount = allResults.filter((r) => r.status === 'Failed').length;

  if (onStatusUpdate) {
    onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.INTEGRATION, 'completed', `Integration complete: ${successCount} successful, ${failedCount} failed.`, {
      totalTransmissions: allResults.length,
      successCount,
      failedCount,
    }));
  }

  return allResults;
}

/**
 * Orchestrates the end-to-end file processing pipeline.
 * Processes a file through all stages: upload → validate → parse → eligibility →
 * categorize → enrollment → integration.
 *
 * @param {object} file - The file object to process. Expected properties:
 *   - {string} name - The filename.
 *   - {number} size - The file size in bytes.
 *   - {string} [type] - The MIME type.
 *   - {string} rawContent - The raw file content string.
 * @param {object} [options] - Optional processing options.
 * @param {string} [options.uploadSource='web'] - The upload source ('web', 'api', 'sftp').
 * @param {string} [options.userId=''] - The ID of the user performing the processing.
 * @param {string} [options.userName=''] - The name of the user.
 * @param {boolean} [options.skipIntegration=false] - Whether to skip the integration stage.
 * @param {Function} [options.onStatusUpdate] - Optional callback invoked at each stage with status updates.
 * @returns {Promise<object>} The pipeline result containing file record, members, enrollments, and integration results.
 */
export async function processFile(file, options = {}) {
  const uploadSource = options.uploadSource || 'web';
  const userId = options.userId || '';
  const userName = options.userName || '';
  const skipIntegration = options.skipIntegration || false;
  const onStatusUpdate = typeof options.onStatusUpdate === 'function' ? options.onStatusUpdate : null;

  const pipelineResult = {
    success: false,
    fileId: null,
    fileRecord: null,
    members: [],
    enrollments: [],
    integrationResults: [],
    stages: [],
    errors: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };

  try {
    // Stage 1: Upload
    const fileRecord = await processUploadStage(file, uploadSource, userId, onStatusUpdate);
    pipelineResult.fileId = fileRecord.id;
    pipelineResult.fileRecord = fileRecord;
    pipelineResult.stages.push({ stage: PIPELINE_STAGES.UPLOAD, status: 'completed' });

    const rawContent = file.rawContent || '';

    // Stage 2: Validate
    await processValidationStage(fileRecord.id, rawContent, userId, onStatusUpdate);
    pipelineResult.stages.push({ stage: PIPELINE_STAGES.VALIDATE, status: 'completed' });

    // Stage 3: Parse
    const parseResult = await processParsingStage(fileRecord.id, rawContent, userId, onStatusUpdate);
    pipelineResult.stages.push({ stage: PIPELINE_STAGES.PARSE, status: 'completed' });

    // Stage 4: Eligibility
    const processedMembers = await processEligibilityStage(fileRecord.id, parseResult.members, userId, onStatusUpdate);
    pipelineResult.stages.push({ stage: PIPELINE_STAGES.ELIGIBILITY, status: 'completed' });

    // Stage 5: Categorize
    const storedMembers = await processCategorizationStage(fileRecord.id, processedMembers, userId, onStatusUpdate);
    pipelineResult.members = storedMembers;
    pipelineResult.stages.push({ stage: PIPELINE_STAGES.CATEGORIZE, status: 'completed' });

    // Stage 6: Enrollment
    const enrollments = await processEnrollmentStage(fileRecord.id, processedMembers, userId, onStatusUpdate);
    pipelineResult.enrollments = enrollments;
    pipelineResult.stages.push({ stage: PIPELINE_STAGES.ENROLLMENT, status: 'completed' });

    // Stage 7: Integration (optional)
    if (!skipIntegration) {
      const integrationResults = await processIntegrationStage(fileRecord.id, processedMembers, userId, userName, onStatusUpdate);
      pipelineResult.integrationResults = integrationResults;
      pipelineResult.stages.push({ stage: PIPELINE_STAGES.INTEGRATION, status: 'completed' });
    }

    // Update file status to completed
    useFileStore.getState().updateFileStatus(fileRecord.id, FILE_STATUS.COMPLETED);
    useFileStore.getState().updateFile(fileRecord.id, {
      members: processedMembers.map((m) => ({
        id: m.id,
        memberId: m.memberId,
        firstName: m.firstName,
        lastName: m.lastName,
        eligibilityStatus: m.eligibilityStatus,
      })),
    });

    useAuditStore.getState().logAction('File Processing Completed', fileRecord.id, userId, {
      memberCount: processedMembers.length,
      enrollmentCount: enrollments.length,
      integrationCount: pipelineResult.integrationResults.length,
    });

    pipelineResult.success = true;
    pipelineResult.completedAt = new Date().toISOString();

    if (onStatusUpdate) {
      onStatusUpdate(createStatusUpdate(fileRecord.id, PIPELINE_STAGES.COMPLETE, 'completed', 'File processing pipeline completed successfully.', {
        memberCount: processedMembers.length,
        enrollmentCount: enrollments.length,
      }));
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown pipeline error.';
    pipelineResult.errors.push(errorMessage);
    pipelineResult.completedAt = new Date().toISOString();

    // If we have a fileId, ensure the file is marked as failed
    if (pipelineResult.fileId) {
      const currentFile = useFileStore.getState().getFile(pipelineResult.fileId);
      if (currentFile && currentFile.status !== FILE_STATUS.FAILED) {
        useFileStore.getState().updateFileStatus(pipelineResult.fileId, FILE_STATUS.FAILED, errorMessage);
      }
    }
  }

  return pipelineResult;
}

/**
 * Retries processing a previously failed file.
 * Resets the file status and re-runs the full pipeline.
 *
 * @param {string} fileId - The file ID to retry.
 * @param {object} [options] - Optional processing options.
 * @param {string} [options.userId=''] - The ID of the user performing the retry.
 * @param {string} [options.userName=''] - The name of the user.
 * @param {boolean} [options.skipIntegration=false] - Whether to skip the integration stage.
 * @param {Function} [options.onStatusUpdate] - Optional callback for status updates.
 * @returns {Promise<object>} The pipeline result from reprocessing.
 */
export async function retryFileProcessing(fileId, options = {}) {
  const userId = options.userId || '';
  const onStatusUpdate = typeof options.onStatusUpdate === 'function' ? options.onStatusUpdate : null;

  if (!fileId) {
    return {
      success: false,
      fileId: null,
      fileRecord: null,
      members: [],
      enrollments: [],
      integrationResults: [],
      stages: [],
      errors: ['No file ID provided for retry.'],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  const fileStore = useFileStore.getState();
  const existingFile = fileStore.getFile(fileId);

  if (!existingFile) {
    return {
      success: false,
      fileId,
      fileRecord: null,
      members: [],
      enrollments: [],
      integrationResults: [],
      stages: [],
      errors: [`File with ID "${fileId}" not found.`],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  if (existingFile.status !== FILE_STATUS.FAILED) {
    return {
      success: false,
      fileId,
      fileRecord: existingFile,
      members: [],
      enrollments: [],
      integrationResults: [],
      stages: [],
      errors: [`File is not in a failed state. Current status: ${existingFile.status}.`],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  // Reset file status
  fileStore.retryFile(fileId);

  useAuditStore.getState().logAction('File Retry Initiated', fileId, userId, {
    previousStatus: existingFile.status,
    previousError: existingFile.error,
  });

  // Re-run the pipeline from validation stage onward
  const rawContent = existingFile.rawContent || '';

  const pipelineResult = {
    success: false,
    fileId,
    fileRecord: existingFile,
    members: [],
    enrollments: [],
    integrationResults: [],
    stages: [],
    errors: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };

  try {
    // Stage 2: Validate
    await processValidationStage(fileId, rawContent, userId, onStatusUpdate);
    pipelineResult.stages.push({ stage: PIPELINE_STAGES.VALIDATE, status: 'completed' });

    // Stage 3: Parse
    const parseResult = await processParsingStage(fileId, rawContent, userId, onStatusUpdate);
    pipelineResult.stages.push({ stage: PIPELINE_STAGES.PARSE, status: 'completed' });

    // Stage 4: Eligibility
    const processedMembers = await processEligibilityStage(fileId, parseResult.members, userId, onStatusUpdate);
    pipelineResult.stages.push({ stage: PIPELINE_STAGES.ELIGIBILITY, status: 'completed' });

    // Stage 5: Categorize
    const storedMembers = await processCategorizationStage(fileId, processedMembers, userId, onStatusUpdate);
    pipelineResult.members = storedMembers;
    pipelineResult.stages.push({ stage: PIPELINE_STAGES.CATEGORIZE, status: 'completed' });

    // Stage 6: Enrollment
    const enrollments = await processEnrollmentStage(fileId, processedMembers, userId, onStatusUpdate);
    pipelineResult.enrollments = enrollments;
    pipelineResult.stages.push({ stage: PIPELINE_STAGES.ENROLLMENT, status: 'completed' });

    // Stage 7: Integration (optional)
    if (!options.skipIntegration) {
      const integrationResults = await processIntegrationStage(fileId, processedMembers, userId, options.userName || '', onStatusUpdate);
      pipelineResult.integrationResults = integrationResults;
      pipelineResult.stages.push({ stage: PIPELINE_STAGES.INTEGRATION, status: 'completed' });
    }

    // Update file status to completed
    useFileStore.getState().updateFileStatus(fileId, FILE_STATUS.COMPLETED);
    useFileStore.getState().updateFile(fileId, {
      members: processedMembers.map((m) => ({
        id: m.id,
        memberId: m.memberId,
        firstName: m.firstName,
        lastName: m.lastName,
        eligibilityStatus: m.eligibilityStatus,
      })),
    });

    useAuditStore.getState().logAction('File Retry Completed', fileId, userId, {
      memberCount: processedMembers.length,
      enrollmentCount: enrollments.length,
    });

    pipelineResult.success = true;
    pipelineResult.completedAt = new Date().toISOString();

    if (onStatusUpdate) {
      onStatusUpdate(createStatusUpdate(fileId, PIPELINE_STAGES.COMPLETE, 'completed', 'File retry processing completed successfully.'));
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown pipeline error during retry.';
    pipelineResult.errors.push(errorMessage);
    pipelineResult.completedAt = new Date().toISOString();

    const currentFile = useFileStore.getState().getFile(fileId);
    if (currentFile && currentFile.status !== FILE_STATUS.FAILED) {
      useFileStore.getState().updateFileStatus(fileId, FILE_STATUS.FAILED, errorMessage);
    }
  }

  return pipelineResult;
}

/**
 * Returns the current processing statistics across all stores.
 *
 * @returns {object} An object containing file, member, enrollment, and integration statistics.
 */
export function getPipelineStats() {
  const fileStats = useFileStore.getState().getFileStats();
  const memberCount = useMemberStore.getState().getMemberCount();
  const eligibleCount = useMemberStore.getState().getMemberCount(MEMBER_STATUS.ELIGIBLE);
  const ineligibleCount = useMemberStore.getState().getMemberCount(MEMBER_STATUS.INELIGIBLE);
  const pendingCount = useMemberStore.getState().getMemberCount(MEMBER_STATUS.PENDING);
  const enrollmentStats = useEnrollmentStore.getState().getEnrollmentStats();
  const integrationStats = useIntegrationStore.getState().getIntegrationStats();

  return {
    files: fileStats,
    members: {
      total: memberCount,
      eligible: eligibleCount,
      ineligible: ineligibleCount,
      pending: pendingCount,
    },
    enrollments: enrollmentStats,
    integrations: integrationStats,
  };
}

/**
 * Clears all pipeline data across all stores.
 * Useful for resetting the application state.
 *
 * @param {string} [userId=''] - The ID of the user performing the clear.
 */
export function clearPipelineData(userId = '') {
  useFileStore.getState().clearFiles();
  useMemberStore.getState().clearMembers();
  useEnrollmentStore.getState().clearEnrollments();
  useIntegrationStore.getState().clearIntegrationLogs();

  useAuditStore.getState().logAction('Pipeline Data Cleared', '', userId, {
    clearedAt: new Date().toISOString(),
  });
}

export { PIPELINE_STAGES };