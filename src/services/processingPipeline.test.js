import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateSampleEDI834 } from './edi834Parser';
import { useFileStore } from '../stores/fileStore';
import { useMemberStore } from '../stores/memberStore';
import { useEligibilityStore } from '../stores/eligibilityStore';
import { useEnrollmentStore } from '../stores/enrollmentStore';
import { useIntegrationStore } from '../stores/integrationStore';
import { useAuditStore } from '../stores/auditStore';
import { FILE_STATUS, MEMBER_STATUS } from '../utils/constants';

// We need to mock the delay to speed up tests
vi.mock('../utils/helpers', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    delay: vi.fn(() => Promise.resolve()),
  };
});

// Import after mocking
const { processFile, retryFileProcessing, clearPipelineData, getPipelineStats, PIPELINE_STAGES } = await import('./processingPipeline');

describe('processingPipeline', () => {
  beforeEach(() => {
    // Reset all stores before each test
    useFileStore.setState({ files: [] });
    useMemberStore.setState({ members: [] });
    useEligibilityStore.getState().resetToDefaults();
    useEnrollmentStore.setState({ enrollments: [] });
    useIntegrationStore.setState({
      integrationLogs: [],
      integrationConfig: {
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
          delayMs: 100,
          backoffMultiplier: 2,
        },
      },
    });
    useAuditStore.setState({ auditLogs: [], errorLogs: [] });
  });

  describe('processFile', () => {
    describe('end-to-end processing of valid EDI file', () => {
      it('processes a valid single-member EDI 834 file through all stages successfully', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'test_enrollment.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-1',
          userName: 'Test User',
          skipIntegration: true,
        });

        expect(result.success).toBe(true);
        expect(result.fileId).toBeDefined();
        expect(typeof result.fileId).toBe('string');
        expect(result.fileId.length).toBeGreaterThan(0);
        expect(result.errors).toHaveLength(0);
        expect(result.members.length).toBeGreaterThan(0);
        expect(result.enrollments.length).toBeGreaterThan(0);
        expect(result.startedAt).toBeDefined();
        expect(result.completedAt).toBeDefined();
      });

      it('processes a multi-member EDI 834 file and creates members and enrollments', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 3 });
        const file = {
          name: 'multi_member.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-2',
          userName: 'Test User 2',
          skipIntegration: true,
        });

        expect(result.success).toBe(true);
        expect(result.members).toHaveLength(3);
        expect(result.enrollments).toHaveLength(3);

        // Verify members are stored in the member store
        const { members } = useMemberStore.getState();
        expect(members).toHaveLength(3);

        // Verify enrollments are stored in the enrollment store
        const { enrollments } = useEnrollmentStore.getState();
        expect(enrollments).toHaveLength(3);
      });

      it('updates file status to Completed after successful processing', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'status_test.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-3',
          skipIntegration: true,
        });

        expect(result.success).toBe(true);

        const storedFile = useFileStore.getState().getFile(result.fileId);
        expect(storedFile).toBeDefined();
        expect(storedFile.status).toBe(FILE_STATUS.COMPLETED);
      });

      it('records all pipeline stages as completed', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'stages_test.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-4',
          skipIntegration: true,
        });

        expect(result.success).toBe(true);
        expect(result.stages.length).toBeGreaterThanOrEqual(6);

        const stageNames = result.stages.map((s) => s.stage);
        expect(stageNames).toContain(PIPELINE_STAGES.UPLOAD);
        expect(stageNames).toContain(PIPELINE_STAGES.VALIDATE);
        expect(stageNames).toContain(PIPELINE_STAGES.PARSE);
        expect(stageNames).toContain(PIPELINE_STAGES.ELIGIBILITY);
        expect(stageNames).toContain(PIPELINE_STAGES.CATEGORIZE);
        expect(stageNames).toContain(PIPELINE_STAGES.ENROLLMENT);

        result.stages.forEach((stage) => {
          expect(stage.status).toBe('completed');
        });
      });

      it('creates audit log entries during processing', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'audit_test.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-5',
          skipIntegration: true,
        });

        const { auditLogs } = useAuditStore.getState();
        expect(auditLogs.length).toBeGreaterThan(0);

        const actions = auditLogs.map((log) => log.action);
        expect(actions).toContain('File Uploaded');
        expect(actions).toContain('File Validated');
        expect(actions).toContain('File Parsed');
        expect(actions).toContain('File Processing Completed');
      });

      it('processes with integration stage when skipIntegration is false', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'integration_test.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-6',
          userName: 'Test User 6',
          skipIntegration: false,
        });

        expect(result.success).toBe(true);

        const stageNames = result.stages.map((s) => s.stage);
        expect(stageNames).toContain(PIPELINE_STAGES.INTEGRATION);

        // Integration results may or may not be present depending on eligibility
        expect(Array.isArray(result.integrationResults)).toBe(true);
      });

      it('stores file members summary in the file record after processing', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 2 });
        const file = {
          name: 'file_members_test.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-7',
          skipIntegration: true,
        });

        expect(result.success).toBe(true);

        const storedFile = useFileStore.getState().getFile(result.fileId);
        expect(storedFile).toBeDefined();
        expect(Array.isArray(storedFile.members)).toBe(true);
        expect(storedFile.members).toHaveLength(2);

        storedFile.members.forEach((m) => {
          expect(m.id).toBeDefined();
          expect(m.memberId).toBeDefined();
          expect(m.firstName).toBeDefined();
          expect(m.lastName).toBeDefined();
          expect(m.eligibilityStatus).toBeDefined();
        });
      });

      it('handles different upload sources correctly', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });

        for (const source of ['web', 'api', 'sftp']) {
          // Reset stores
          useFileStore.setState({ files: [] });
          useMemberStore.setState({ members: [] });
          useEnrollmentStore.setState({ enrollments: [] });

          const file = {
            name: `${source}_upload.edi`,
            size: new Blob([ediContent]).size,
            type: 'text/plain',
            rawContent: ediContent,
          };

          const result = await processFile(file, {
            uploadSource: source,
            userId: 'test-user-8',
            skipIntegration: true,
          });

          expect(result.success).toBe(true);

          const storedFile = useFileStore.getState().getFile(result.fileId);
          expect(storedFile.uploadSource).toBe(source);
        }
      });
    });

    describe('status updates callback', () => {
      it('emits status updates for each pipeline stage', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'status_updates.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const statusUpdates = [];
        const onStatusUpdate = (update) => {
          statusUpdates.push(update);
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-9',
          skipIntegration: true,
          onStatusUpdate,
        });

        expect(result.success).toBe(true);
        expect(statusUpdates.length).toBeGreaterThan(0);

        // Check that we get both started and completed updates for stages
        const startedUpdates = statusUpdates.filter((u) => u.status === 'started');
        const completedUpdates = statusUpdates.filter((u) => u.status === 'completed');

        expect(startedUpdates.length).toBeGreaterThan(0);
        expect(completedUpdates.length).toBeGreaterThan(0);

        // Verify each update has required fields
        statusUpdates.forEach((update) => {
          expect(update.fileId).toBeDefined();
          expect(update.stage).toBeDefined();
          expect(update.status).toBeDefined();
          expect(update.timestamp).toBeDefined();
        });
      });

      it('emits upload stage started and completed updates', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'upload_status.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const statusUpdates = [];
        const onStatusUpdate = (update) => {
          statusUpdates.push(update);
        };

        await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-10',
          skipIntegration: true,
          onStatusUpdate,
        });

        const uploadStarted = statusUpdates.find(
          (u) => u.stage === PIPELINE_STAGES.UPLOAD && u.status === 'started'
        );
        const uploadCompleted = statusUpdates.find(
          (u) => u.stage === PIPELINE_STAGES.UPLOAD && u.status === 'completed'
        );

        expect(uploadStarted).toBeDefined();
        expect(uploadCompleted).toBeDefined();
      });

      it('emits validate stage started and completed updates', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'validate_status.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const statusUpdates = [];
        const onStatusUpdate = (update) => {
          statusUpdates.push(update);
        };

        await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-11',
          skipIntegration: true,
          onStatusUpdate,
        });

        const validateStarted = statusUpdates.find(
          (u) => u.stage === PIPELINE_STAGES.VALIDATE && u.status === 'started'
        );
        const validateCompleted = statusUpdates.find(
          (u) => u.stage === PIPELINE_STAGES.VALIDATE && u.status === 'completed'
        );

        expect(validateStarted).toBeDefined();
        expect(validateCompleted).toBeDefined();
      });

      it('emits parse stage started and completed updates with member count', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 2 });
        const file = {
          name: 'parse_status.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const statusUpdates = [];
        const onStatusUpdate = (update) => {
          statusUpdates.push(update);
        };

        await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-12',
          skipIntegration: true,
          onStatusUpdate,
        });

        const parseCompleted = statusUpdates.find(
          (u) => u.stage === PIPELINE_STAGES.PARSE && u.status === 'completed'
        );

        expect(parseCompleted).toBeDefined();
        expect(parseCompleted.details).toBeDefined();
        expect(parseCompleted.details.memberCount).toBe(2);
      });

      it('emits eligibility stage completed update with eligibility breakdown', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'eligibility_status.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const statusUpdates = [];
        const onStatusUpdate = (update) => {
          statusUpdates.push(update);
        };

        await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-13',
          skipIntegration: true,
          onStatusUpdate,
        });

        const eligibilityCompleted = statusUpdates.find(
          (u) => u.stage === PIPELINE_STAGES.ELIGIBILITY && u.status === 'completed'
        );

        expect(eligibilityCompleted).toBeDefined();
        expect(eligibilityCompleted.details).toBeDefined();
        expect(typeof eligibilityCompleted.details.eligible).toBe('number');
        expect(typeof eligibilityCompleted.details.ineligible).toBe('number');
        expect(typeof eligibilityCompleted.details.pending).toBe('number');
      });

      it('emits complete stage update at the end of successful processing', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'complete_status.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const statusUpdates = [];
        const onStatusUpdate = (update) => {
          statusUpdates.push(update);
        };

        await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-14',
          skipIntegration: true,
          onStatusUpdate,
        });

        const completeUpdate = statusUpdates.find(
          (u) => u.stage === PIPELINE_STAGES.COMPLETE && u.status === 'completed'
        );

        expect(completeUpdate).toBeDefined();
        expect(completeUpdate.message).toBeDefined();
        expect(completeUpdate.message.length).toBeGreaterThan(0);
      });

      it('does not throw when onStatusUpdate is not provided', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'no_callback.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-15',
          skipIntegration: true,
        });

        expect(result.success).toBe(true);
      });
    });

    describe('failure handling at upload stage', () => {
      it('fails when file has unsupported extension', async () => {
        const file = {
          name: 'bad_file.pdf',
          size: 1024,
          type: 'application/pdf',
          rawContent: 'some content',
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-16',
          skipIntegration: true,
        });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('validation failed');
      });

      it('fails when file size is zero', async () => {
        const file = {
          name: 'empty.edi',
          size: 0,
          type: 'text/plain',
          rawContent: '',
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-17',
          skipIntegration: true,
        });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('fails when a duplicate file is detected', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'duplicate_test.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        // Process the file first time
        const firstResult = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-18',
          skipIntegration: true,
        });

        expect(firstResult.success).toBe(true);

        // Try to process the same file again
        const secondResult = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-18',
          skipIntegration: true,
        });

        expect(secondResult.success).toBe(false);
        expect(secondResult.errors.length).toBeGreaterThan(0);
        const hasDuplicateError = secondResult.errors.some((e) => e.toLowerCase().includes('duplicate'));
        expect(hasDuplicateError).toBe(true);
      });

      it('logs error to audit store on upload failure', async () => {
        const file = {
          name: 'bad_file.pdf',
          size: 1024,
          type: 'application/pdf',
          rawContent: 'some content',
        };

        await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-19',
          skipIntegration: true,
        });

        const { errorLogs } = useAuditStore.getState();
        expect(errorLogs.length).toBeGreaterThan(0);
      });

      it('emits failed status update on upload failure', async () => {
        const file = {
          name: 'bad_file.pdf',
          size: 1024,
          type: 'application/pdf',
          rawContent: 'some content',
        };

        const statusUpdates = [];
        const onStatusUpdate = (update) => {
          statusUpdates.push(update);
        };

        await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-20',
          skipIntegration: true,
          onStatusUpdate,
        });

        const failedUpdate = statusUpdates.find((u) => u.status === 'failed');
        expect(failedUpdate).toBeDefined();
        expect(failedUpdate.stage).toBe(PIPELINE_STAGES.UPLOAD);
      });
    });

    describe('failure handling at validation stage', () => {
      it('fails when EDI content is invalid (not EDI 834 format)', async () => {
        const invalidContent = 'This is not an EDI file at all. Just random text content.';
        const file = {
          name: 'invalid_edi.edi',
          size: new Blob([invalidContent]).size,
          type: 'text/plain',
          rawContent: invalidContent,
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-21',
          skipIntegration: true,
        });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('marks file as Failed when validation fails', async () => {
        const invalidContent = 'This is not an EDI file at all.';
        const file = {
          name: 'validation_fail.edi',
          size: new Blob([invalidContent]).size,
          type: 'text/plain',
          rawContent: invalidContent,
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-22',
          skipIntegration: true,
        });

        expect(result.success).toBe(false);

        if (result.fileId) {
          const storedFile = useFileStore.getState().getFile(result.fileId);
          if (storedFile) {
            expect(storedFile.status).toBe(FILE_STATUS.FAILED);
          }
        }
      });

      it('logs validation error to audit store', async () => {
        const invalidContent = 'Not valid EDI content here.';
        const file = {
          name: 'validation_error.edi',
          size: new Blob([invalidContent]).size,
          type: 'text/plain',
          rawContent: invalidContent,
        };

        await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-23',
          skipIntegration: true,
        });

        const { errorLogs } = useAuditStore.getState();
        const validationErrors = errorLogs.filter((e) => e.errorType === 'ValidationError');
        expect(validationErrors.length).toBeGreaterThan(0);
      });

      it('emits failed status update on validation failure', async () => {
        const invalidContent = 'Not valid EDI content.';
        const file = {
          name: 'validation_status_fail.edi',
          size: new Blob([invalidContent]).size,
          type: 'text/plain',
          rawContent: invalidContent,
        };

        const statusUpdates = [];
        const onStatusUpdate = (update) => {
          statusUpdates.push(update);
        };

        await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-24',
          skipIntegration: true,
          onStatusUpdate,
        });

        const failedUpdate = statusUpdates.find(
          (u) => u.status === 'failed' && u.stage === PIPELINE_STAGES.VALIDATE
        );
        expect(failedUpdate).toBeDefined();
      });
    });

    describe('failure handling at parsing stage', () => {
      it('fails when EDI content has valid envelope but no member data', async () => {
        const contentNoMembers = [
          'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:',
          'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1',
          'ST*834*0001',
          'BGN*00*12345*20240101*1200****2',
          'SE*3*0001',
          'GE*1*1',
          'IEA*1*000000001',
        ].join('~') + '~';

        const file = {
          name: 'no_members.edi',
          size: new Blob([contentNoMembers]).size,
          type: 'text/plain',
          rawContent: contentNoMembers,
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-25',
          skipIntegration: true,
        });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('eligibility determination during processing', () => {
      it('determines eligibility for each member based on configured rules', async () => {
        // Set up rules that will make members eligible
        useEligibilityStore.getState().setRules([
          {
            id: 'test-age-rule',
            state: '*',
            criteria: { field: 'age', operator: '>=', value: 0 },
            effectiveDate: '2024-01-01',
            version: 1,
            createdBy: 'system',
          },
        ]);

        const ediContent = generateSampleEDI834({ memberCount: 2 });
        const file = {
          name: 'eligibility_test.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-26',
          skipIntegration: true,
        });

        expect(result.success).toBe(true);
        expect(result.members.length).toBeGreaterThan(0);

        // Each member should have an eligibility status set
        const { members } = useMemberStore.getState();
        members.forEach((member) => {
          expect(member.eligibilityStatus).toBeDefined();
          expect([MEMBER_STATUS.ELIGIBLE, MEMBER_STATUS.INELIGIBLE, MEMBER_STATUS.PENDING]).toContain(
            member.eligibilityStatus
          );
        });
      });

      it('logs eligibility determination actions to audit store', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'eligibility_audit.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-27',
          skipIntegration: true,
        });

        const { auditLogs } = useAuditStore.getState();
        const eligibilityLogs = auditLogs.filter((log) => log.action === 'Eligibility Determined');
        expect(eligibilityLogs.length).toBeGreaterThan(0);
      });
    });

    describe('enrollment creation during processing', () => {
      it('creates enrollment records for all processed members', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 3 });
        const file = {
          name: 'enrollment_creation.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const result = await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-28',
          skipIntegration: true,
        });

        expect(result.success).toBe(true);
        expect(result.enrollments).toHaveLength(3);

        const { enrollments } = useEnrollmentStore.getState();
        expect(enrollments).toHaveLength(3);

        enrollments.forEach((enrollment) => {
          expect(enrollment.id).toBeDefined();
          expect(enrollment.memberId).toBeDefined();
          expect(enrollment.status).toBeDefined();
        });
      });

      it('logs enrollment creation actions to audit store', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'enrollment_audit.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        await processFile(file, {
          uploadSource: 'web',
          userId: 'test-user-29',
          skipIntegration: true,
        });

        const { auditLogs } = useAuditStore.getState();
        const enrollmentLogs = auditLogs.filter((log) => log.action === 'Enrollment Created');
        expect(enrollmentLogs.length).toBeGreaterThan(0);
      });
    });

    describe('default options handling', () => {
      it('uses default options when none are provided', async () => {
        const ediContent = generateSampleEDI834({ memberCount: 1 });
        const file = {
          name: 'defaults_test.edi',
          size: new Blob([ediContent]).size,
          type: 'text/plain',
          rawContent: ediContent,
        };

        const result = await processFile(file);

        expect(result.success).toBe(true);
        expect(result.fileId).toBeDefined();

        const storedFile = useFileStore.getState().getFile(result.fileId);
        expect(storedFile.uploadSource).toBe('web');
      });
    });
  });

  describe('retryFileProcessing', () => {
    it('retries a failed file and processes it successfully', async () => {
      // First, create a file that will fail validation
      const invalidContent = 'Not valid EDI content at all.';
      const file = {
        name: 'retry_test.edi',
        size: new Blob([invalidContent]).size,
        type: 'text/plain',
        rawContent: invalidContent,
      };

      const firstResult = await processFile(file, {
        uploadSource: 'web',
        userId: 'test-user-30',
        skipIntegration: true,
      });

      expect(firstResult.success).toBe(false);
      const fileId = firstResult.fileId;

      if (fileId) {
        // Now update the file with valid content and retry
        const validContent = generateSampleEDI834({ memberCount: 1 });
        useFileStore.getState().updateFile(fileId, {
          rawContent: validContent,
          status: FILE_STATUS.FAILED,
        });

        const retryResult = await retryFileProcessing(fileId, {
          userId: 'test-user-30',
          skipIntegration: true,
        });

        expect(retryResult.success).toBe(true);
        expect(retryResult.fileId).toBe(fileId);
        expect(retryResult.members.length).toBeGreaterThan(0);
        expect(retryResult.enrollments.length).toBeGreaterThan(0);

        const storedFile = useFileStore.getState().getFile(fileId);
        expect(storedFile.status).toBe(FILE_STATUS.COMPLETED);
      }
    });

    it('returns error when no file ID is provided', async () => {
      const result = await retryFileProcessing('', {
        userId: 'test-user-31',
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('No file ID');
    });

    it('returns error when file ID is not found', async () => {
      const result = await retryFileProcessing('non-existent-file-id', {
        userId: 'test-user-32',
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not found');
    });

    it('returns error when file is not in Failed status', async () => {
      const ediContent = generateSampleEDI834({ memberCount: 1 });
      const file = {
        name: 'not_failed.edi',
        size: new Blob([ediContent]).size,
        type: 'text/plain',
        rawContent: ediContent,
      };

      const processResult = await processFile(file, {
        uploadSource: 'web',
        userId: 'test-user-33',
        skipIntegration: true,
      });

      expect(processResult.success).toBe(true);

      const retryResult = await retryFileProcessing(processResult.fileId, {
        userId: 'test-user-33',
      });

      expect(retryResult.success).toBe(false);
      expect(retryResult.errors.length).toBeGreaterThan(0);
      expect(retryResult.errors[0]).toContain('not in a failed state');
    });

    it('logs retry initiation to audit store', async () => {
      const invalidContent = 'Invalid EDI content for retry audit test.';
      const file = {
        name: 'retry_audit.edi',
        size: new Blob([invalidContent]).size,
        type: 'text/plain',
        rawContent: invalidContent,
      };

      const firstResult = await processFile(file, {
        uploadSource: 'web',
        userId: 'test-user-34',
        skipIntegration: true,
      });

      const fileId = firstResult.fileId;

      if (fileId) {
        const validContent = generateSampleEDI834({ memberCount: 1 });
        useFileStore.getState().updateFile(fileId, {
          rawContent: validContent,
          status: FILE_STATUS.FAILED,
        });

        await retryFileProcessing(fileId, {
          userId: 'test-user-34',
          skipIntegration: true,
        });

        const { auditLogs } = useAuditStore.getState();
        const retryLogs = auditLogs.filter((log) => log.action === 'File Retry Initiated');
        expect(retryLogs.length).toBeGreaterThan(0);
      }
    });
  });

  describe('clearPipelineData', () => {
    it('clears all pipeline data from stores', async () => {
      const ediContent = generateSampleEDI834({ memberCount: 2 });
      const file = {
        name: 'clear_test.edi',
        size: new Blob([ediContent]).size,
        type: 'text/plain',
        rawContent: ediContent,
      };

      await processFile(file, {
        uploadSource: 'web',
        userId: 'test-user-35',
        skipIntegration: true,
      });

      // Verify data exists
      expect(useFileStore.getState().files.length).toBeGreaterThan(0);
      expect(useMemberStore.getState().members.length).toBeGreaterThan(0);
      expect(useEnrollmentStore.getState().enrollments.length).toBeGreaterThan(0);

      // Clear pipeline data
      clearPipelineData('test-user-35');

      // Verify data is cleared
      expect(useFileStore.getState().files).toHaveLength(0);
      expect(useMemberStore.getState().members).toHaveLength(0);
      expect(useEnrollmentStore.getState().enrollments).toHaveLength(0);
      expect(useIntegrationStore.getState().integrationLogs).toHaveLength(0);
    });

    it('logs the clear action to audit store', () => {
      clearPipelineData('test-user-36');

      const { auditLogs } = useAuditStore.getState();
      const clearLogs = auditLogs.filter((log) => log.action === 'Pipeline Data Cleared');
      expect(clearLogs.length).toBeGreaterThan(0);
    });

    it('works with empty userId', () => {
      clearPipelineData();

      const { auditLogs } = useAuditStore.getState();
      const clearLogs = auditLogs.filter((log) => log.action === 'Pipeline Data Cleared');
      expect(clearLogs.length).toBeGreaterThan(0);
    });
  });

  describe('getPipelineStats', () => {
    it('returns correct statistics when stores are empty', () => {
      const stats = getPipelineStats();

      expect(stats).toBeDefined();
      expect(stats.files).toBeDefined();
      expect(stats.members).toBeDefined();
      expect(stats.enrollments).toBeDefined();
      expect(stats.integrations).toBeDefined();

      expect(stats.files.total).toBe(0);
      expect(stats.members.total).toBe(0);
      expect(stats.enrollments.total).toBe(0);
      expect(stats.integrations.total).toBe(0);
    });

    it('returns correct statistics after processing files', async () => {
      const ediContent = generateSampleEDI834({ memberCount: 2 });
      const file = {
        name: 'stats_test.edi',
        size: new Blob([ediContent]).size,
        type: 'text/plain',
        rawContent: ediContent,
      };

      await processFile(file, {
        uploadSource: 'web',
        userId: 'test-user-37',
        skipIntegration: true,
      });

      const stats = getPipelineStats();

      expect(stats.files.total).toBe(1);
      expect(stats.files.completed).toBe(1);
      expect(stats.members.total).toBe(2);
      expect(stats.enrollments.total).toBe(2);
    });

    it('returns member eligibility breakdown', async () => {
      const ediContent = generateSampleEDI834({ memberCount: 3 });
      const file = {
        name: 'eligibility_stats.edi',
        size: new Blob([ediContent]).size,
        type: 'text/plain',
        rawContent: ediContent,
      };

      await processFile(file, {
        uploadSource: 'web',
        userId: 'test-user-38',
        skipIntegration: true,
      });

      const stats = getPipelineStats();

      expect(stats.members.total).toBe(3);
      const totalBreakdown = stats.members.eligible + stats.members.ineligible + stats.members.pending;
      expect(totalBreakdown).toBe(3);
    });
  });

  describe('PIPELINE_STAGES', () => {
    it('exports all expected pipeline stage constants', () => {
      expect(PIPELINE_STAGES).toBeDefined();
      expect(PIPELINE_STAGES.UPLOAD).toBe('Upload');
      expect(PIPELINE_STAGES.VALIDATE).toBe('Validate');
      expect(PIPELINE_STAGES.PARSE).toBe('Parse');
      expect(PIPELINE_STAGES.ELIGIBILITY).toBe('Eligibility');
      expect(PIPELINE_STAGES.CATEGORIZE).toBe('Categorize');
      expect(PIPELINE_STAGES.ENROLLMENT).toBe('Enrollment');
      expect(PIPELINE_STAGES.INTEGRATION).toBe('Integration');
      expect(PIPELINE_STAGES.COMPLETE).toBe('Complete');
    });

    it('PIPELINE_STAGES is frozen', () => {
      expect(Object.isFrozen(PIPELINE_STAGES)).toBe(true);
    });
  });

  describe('member categorization during processing', () => {
    it('categorizes members and records history entries', async () => {
      const ediContent = generateSampleEDI834({ memberCount: 1 });
      const file = {
        name: 'categorize_test.edi',
        size: new Blob([ediContent]).size,
        type: 'text/plain',
        rawContent: ediContent,
      };

      await processFile(file, {
        uploadSource: 'web',
        userId: 'test-user-39',
        skipIntegration: true,
      });

      const { members } = useMemberStore.getState();
      expect(members).toHaveLength(1);

      const member = members[0];
      expect(member.eligibilityStatus).toBeDefined();
      expect(member.status).toBeDefined();
      expect(member.eligibilityStatus).toBe(member.status);

      // Member should have history entries
      const history = member.enrollmentHistory || member.history || [];
      expect(history.length).toBeGreaterThan(0);
    });

    it('logs member added actions to audit store', async () => {
      const ediContent = generateSampleEDI834({ memberCount: 2 });
      const file = {
        name: 'member_added_audit.edi',
        size: new Blob([ediContent]).size,
        type: 'text/plain',
        rawContent: ediContent,
      };

      await processFile(file, {
        uploadSource: 'web',
        userId: 'test-user-40',
        skipIntegration: true,
      });

      const { auditLogs } = useAuditStore.getState();
      const memberAddedLogs = auditLogs.filter((log) => log.action === 'Member Added');
      expect(memberAddedLogs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('error handling edge cases', () => {
    it('handles null file input gracefully', async () => {
      const result = await processFile(null, {
        uploadSource: 'web',
        userId: 'test-user-41',
        skipIntegration: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles undefined file input gracefully', async () => {
      const result = await processFile(undefined, {
        uploadSource: 'web',
        userId: 'test-user-42',
        skipIntegration: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles file with missing rawContent', async () => {
      const file = {
        name: 'no_content.edi',
        size: 1024,
        type: 'text/plain',
      };

      const result = await processFile(file, {
        uploadSource: 'web',
        userId: 'test-user-43',
        skipIntegration: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('populates completedAt timestamp on both success and failure', async () => {
      // Success case
      const ediContent = generateSampleEDI834({ memberCount: 1 });
      const validFile = {
        name: 'timestamp_success.edi',
        size: new Blob([ediContent]).size,
        type: 'text/plain',
        rawContent: ediContent,
      };

      const successResult = await processFile(validFile, {
        uploadSource: 'web',
        userId: 'test-user-44',
        skipIntegration: true,
      });

      expect(successResult.completedAt).toBeDefined();
      expect(typeof successResult.completedAt).toBe('string');

      // Failure case
      const invalidFile = {
        name: 'timestamp_fail.pdf',
        size: 1024,
        type: 'application/pdf',
        rawContent: 'invalid',
      };

      const failResult = await processFile(invalidFile, {
        uploadSource: 'web',
        userId: 'test-user-44',
        skipIntegration: true,
      });

      expect(failResult.completedAt).toBeDefined();
      expect(typeof failResult.completedAt).toBe('string');
    });

    it('populates startedAt timestamp', async () => {
      const ediContent = generateSampleEDI834({ memberCount: 1 });
      const file = {
        name: 'started_at_test.edi',
        size: new Blob([ediContent]).size,
        type: 'text/plain',
        rawContent: ediContent,
      };

      const result = await processFile(file, {
        uploadSource: 'web',
        userId: 'test-user-45',
        skipIntegration: true,
      });

      expect(result.startedAt).toBeDefined();
      expect(typeof result.startedAt).toBe('string');
    });
  });
});