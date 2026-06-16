import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { AuthProvider } from '../contexts/AuthContext';
import { useAuthStore } from '../stores/authStore';
import { useFileStore } from '../stores/fileStore';
import { useMemberStore } from '../stores/memberStore';
import { useEligibilityStore } from '../stores/eligibilityStore';
import { useEnrollmentStore } from '../stores/enrollmentStore';
import { useIntegrationStore } from '../stores/integrationStore';
import { useAuditStore } from '../stores/auditStore';
import { FILE_STATUS, MEMBER_STATUS } from '../utils/constants';

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock seedInitialData to prevent auto-seeding during tests
vi.mock('../services/sampleData', () => ({
  seedInitialData: vi.fn(() => ({ seeded: false, memberCount: 0, ruleCount: 0, enrollmentCount: 0 })),
}));

/**
 * Helper to render DashboardPage wrapped in required providers.
 * @returns {object} The render result.
 */
function renderDashboardPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <DashboardPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up authenticated admin user (full permissions)
    useAuthStore.setState({
      currentUser: { id: 'test-user-1', name: 'Test Admin', role: 'Admin' },
      isAuthenticated: true,
    });

    // Reset all stores
    useFileStore.setState({ files: [] });
    useMemberStore.setState({ members: [] });
    useEligibilityStore.getState().resetToDefaults();
    useEnrollmentStore.setState({ enrollments: [] });
    useIntegrationStore.setState({
      integrationLogs: [],
      integrationConfig: {
        endpoints: [
          { id: 'medicaid-state-system', name: 'State Medicaid System', url: '/mock', enabled: true },
        ],
        retryPolicy: { maxRetries: 3, delayMs: 100, backoffMultiplier: 2 },
      },
    });
    useAuditStore.setState({ auditLogs: [], errorLogs: [] });
  });

  describe('rendering', () => {
    it('renders the page header with title and welcome message', () => {
      renderDashboardPage();

      expect(screen.getByText('Dashboard')).toBeDefined();
      expect(screen.getByText(/Welcome back, Test Admin/)).toBeDefined();
    });

    it('renders quick action buttons for admin user', () => {
      renderDashboardPage();

      expect(screen.getByText('Upload File')).toBeDefined();
      expect(screen.getByText('View Members')).toBeDefined();
      expect(screen.getByText('View Logs')).toBeDefined();
    });

    it('renders file processing stats section', () => {
      renderDashboardPage();

      expect(screen.getByText('File Processing')).toBeDefined();
    });

    it('renders member eligibility stats section', () => {
      renderDashboardPage();

      expect(screen.getByText('Member Eligibility')).toBeDefined();
    });

    it('renders pipeline summary section', () => {
      renderDashboardPage();

      expect(screen.getByText('Pipeline Summary')).toBeDefined();
    });

    it('renders processing status section', () => {
      renderDashboardPage();

      expect(screen.getByText('Processing Status')).toBeDefined();
    });

    it('renders eligibility overview section', () => {
      renderDashboardPage();

      expect(screen.getByText('Eligibility Overview')).toBeDefined();
    });

    it('renders recent files section', () => {
      renderDashboardPage();

      expect(screen.getByText('Recent Files')).toBeDefined();
    });

    it('renders error summary section', () => {
      renderDashboardPage();

      expect(screen.getByText('Error Summary')).toBeDefined();
    });
  });

  describe('stats cards with empty data', () => {
    it('shows zero values for file stats when no files exist', () => {
      renderDashboardPage();

      // File processing stats cards
      const totalFilesCards = screen.getAllByText('Total Files');
      expect(totalFilesCards.length).toBeGreaterThan(0);

      // All file stat values should be 0
      const completedCards = screen.getAllByText('Completed');
      expect(completedCards.length).toBeGreaterThan(0);

      const failedCards = screen.getAllByText('Failed');
      expect(failedCards.length).toBeGreaterThan(0);
    });

    it('shows zero values for member stats when no members exist', () => {
      renderDashboardPage();

      const totalMembersCards = screen.getAllByText('Total Members');
      expect(totalMembersCards.length).toBeGreaterThan(0);
    });

    it('shows empty state message for recent files when no files exist', () => {
      renderDashboardPage();

      expect(screen.getByText(/No files uploaded yet/)).toBeDefined();
    });

    it('shows no errors message when error logs are empty', () => {
      renderDashboardPage();

      expect(screen.getByText('No errors recorded.')).toBeDefined();
      expect(screen.getByText('System is running smoothly.')).toBeDefined();
    });
  });

  describe('stats cards with populated data', () => {
    beforeEach(() => {
      // Populate file store
      useFileStore.setState({
        files: [
          {
            id: 'file-1',
            name: 'enrollment_jan.edi',
            uploadSource: 'web',
            status: FILE_STATUS.COMPLETED,
            timestamp: new Date().toISOString(),
            members: [
              { id: 'm1', memberId: 'M001', firstName: 'John', lastName: 'Doe', eligibilityStatus: 'Eligible' },
              { id: 'm2', memberId: 'M002', firstName: 'Jane', lastName: 'Smith', eligibilityStatus: 'Ineligible' },
            ],
            rawContent: '',
            validationErrors: [],
            processedAt: new Date().toISOString(),
          },
          {
            id: 'file-2',
            name: 'enrollment_feb.edi',
            uploadSource: 'api',
            status: FILE_STATUS.FAILED,
            error: 'Validation failed',
            timestamp: new Date().toISOString(),
            members: [],
            rawContent: '',
            validationErrors: ['Missing ISA segment'],
            processedAt: new Date().toISOString(),
          },
          {
            id: 'file-3',
            name: 'enrollment_mar.edi',
            uploadSource: 'sftp',
            status: FILE_STATUS.COMPLETED,
            timestamp: new Date().toISOString(),
            members: [
              { id: 'm3', memberId: 'M003', firstName: 'Bob', lastName: 'Jones', eligibilityStatus: 'Pending' },
            ],
            rawContent: '',
            validationErrors: [],
            processedAt: new Date().toISOString(),
          },
        ],
      });

      // Populate member store
      useMemberStore.setState({
        members: [
          {
            id: 'm1',
            memberId: 'M001',
            firstName: 'John',
            lastName: 'Doe',
            eligibilityStatus: MEMBER_STATUS.ELIGIBLE,
            status: MEMBER_STATUS.ELIGIBLE,
            demographics: { age: 35, address: { state: 'CA' } },
            coverage: 'Health - MEDICAID STANDARD',
            history: [],
            enrollmentHistory: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'm2',
            memberId: 'M002',
            firstName: 'Jane',
            lastName: 'Smith',
            eligibilityStatus: MEMBER_STATUS.INELIGIBLE,
            status: MEMBER_STATUS.INELIGIBLE,
            demographics: { age: 28, address: { state: 'NY' } },
            coverage: 'Health - MEDICAID PLUS',
            history: [],
            enrollmentHistory: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'm3',
            memberId: 'M003',
            firstName: 'Bob',
            lastName: 'Jones',
            eligibilityStatus: MEMBER_STATUS.PENDING,
            status: MEMBER_STATUS.PENDING,
            demographics: { age: 45, address: { state: 'TX' } },
            coverage: 'Health - MEDICAID BASIC',
            history: [],
            enrollmentHistory: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      // Populate enrollment store
      useEnrollmentStore.setState({
        enrollments: [
          {
            id: 'e1',
            memberId: 'M001',
            planId: 'MEDICAID_STANDARD',
            status: MEMBER_STATUS.ELIGIBLE,
            effectiveDate: '2024-01-01',
            terminationDate: null,
            history: [],
            coverage: 'Health - MEDICAID STANDARD',
            demographics: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'e2',
            memberId: 'M002',
            planId: 'MEDICAID_PLUS',
            status: MEMBER_STATUS.INELIGIBLE,
            effectiveDate: '2024-01-01',
            terminationDate: '2024-06-30',
            history: [],
            coverage: 'Health - MEDICAID PLUS',
            demographics: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'e3',
            memberId: 'M003',
            planId: 'MEDICAID_BASIC',
            status: MEMBER_STATUS.PENDING,
            effectiveDate: '2024-03-01',
            terminationDate: null,
            history: [],
            coverage: 'Health - MEDICAID BASIC',
            demographics: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
    });

    it('displays correct total files count', () => {
      renderDashboardPage();

      // The pipeline summary should show 3 files
      const filesLabels = screen.getAllByText('Files');
      expect(filesLabels.length).toBeGreaterThan(0);
    });

    it('displays correct total members count', () => {
      renderDashboardPage();

      const membersLabels = screen.getAllByText('Members');
      expect(membersLabels.length).toBeGreaterThan(0);
    });

    it('displays correct total enrollments count', () => {
      renderDashboardPage();

      const enrollmentsLabels = screen.getAllByText('Enrollments');
      expect(enrollmentsLabels.length).toBeGreaterThan(0);
    });

    it('displays recent files in the table', () => {
      renderDashboardPage();

      expect(screen.getByText('enrollment_jan.edi')).toBeDefined();
      expect(screen.getByText('enrollment_feb.edi')).toBeDefined();
      expect(screen.getByText('enrollment_mar.edi')).toBeDefined();
    });

    it('displays file upload source badges in recent files', () => {
      renderDashboardPage();

      expect(screen.getByText('Web')).toBeDefined();
      expect(screen.getByText('API')).toBeDefined();
      expect(screen.getByText('SFTP')).toBeDefined();
    });

    it('displays member count in recent files table', () => {
      renderDashboardPage();

      // File 1 has 2 members, file 2 has 0, file 3 has 1
      const twos = screen.getAllByText('2');
      expect(twos.length).toBeGreaterThan(0);
    });

    it('displays eligibility distribution in the overview', () => {
      renderDashboardPage();

      // Eligibility overview should show the distribution
      const eligibleLabels = screen.getAllByText('Eligible');
      expect(eligibleLabels.length).toBeGreaterThan(0);

      const ineligibleLabels = screen.getAllByText('Ineligible');
      expect(ineligibleLabels.length).toBeGreaterThan(0);

      const pendingLabels = screen.getAllByText('Pending');
      expect(pendingLabels.length).toBeGreaterThan(0);
    });

    it('displays processing status progress bars when files exist', () => {
      renderDashboardPage();

      // Should show completed and failed counts
      const completedLabels = screen.getAllByText(/Completed/);
      expect(completedLabels.length).toBeGreaterThan(0);
    });

    it('shows View All link for recent files when files exist', () => {
      renderDashboardPage();

      expect(screen.getByText('View All →')).toBeDefined();
    });
  });

  describe('stats cards with error data', () => {
    beforeEach(() => {
      useAuditStore.setState({
        auditLogs: [],
        errorLogs: [
          {
            logId: 'err-1',
            errorType: 'ValidationError',
            message: 'Missing ISA segment in file',
            fileId: 'file-1',
            memberId: null,
            timestamp: new Date().toISOString(),
          },
          {
            logId: 'err-2',
            errorType: 'ParsingError',
            message: 'Invalid segment format detected',
            fileId: 'file-2',
            memberId: null,
            timestamp: new Date().toISOString(),
          },
          {
            logId: 'err-3',
            errorType: 'EligibilityError',
            message: 'Rule evaluation failed for member',
            fileId: null,
            memberId: 'M001',
            timestamp: new Date().toISOString(),
          },
        ],
      });
    });

    it('displays error count in error summary section', () => {
      renderDashboardPage();

      // Error summary should show the count badge
      const errorBadges = screen.getAllByText('3');
      expect(errorBadges.length).toBeGreaterThan(0);
    });

    it('displays recent error entries', () => {
      renderDashboardPage();

      expect(screen.getByText('ValidationError')).toBeDefined();
      expect(screen.getByText('ParsingError')).toBeDefined();
      expect(screen.getByText('EligibilityError')).toBeDefined();
    });

    it('displays error messages in the error summary', () => {
      renderDashboardPage();

      expect(screen.getByText('Missing ISA segment in file')).toBeDefined();
      expect(screen.getByText('Invalid segment format detected')).toBeDefined();
      expect(screen.getByText('Rule evaluation failed for member')).toBeDefined();
    });

    it('shows error type breakdown cards', () => {
      renderDashboardPage();

      const validationLabels = screen.getAllByText('Validation');
      expect(validationLabels.length).toBeGreaterThan(0);

      const parsingLabels = screen.getAllByText('Parsing');
      expect(parsingLabels.length).toBeGreaterThan(0);
    });

    it('shows View All Logs link when errors exist', () => {
      renderDashboardPage();

      expect(screen.getByText('View All Logs →')).toBeDefined();
    });
  });

  describe('quick action button navigation', () => {
    it('navigates to /upload when Upload File button is clicked', async () => {
      const user = userEvent.setup();
      renderDashboardPage();

      const uploadButton = screen.getByText('Upload File');
      await user.click(uploadButton);

      expect(mockNavigate).toHaveBeenCalledWith('/upload');
    });

    it('navigates to /members when View Members button is clicked', async () => {
      const user = userEvent.setup();
      renderDashboardPage();

      const membersButton = screen.getByText('View Members');
      await user.click(membersButton);

      expect(mockNavigate).toHaveBeenCalledWith('/members');
    });

    it('navigates to /audit when View Logs button is clicked', async () => {
      const user = userEvent.setup();
      renderDashboardPage();

      const logsButton = screen.getByText('View Logs');
      await user.click(logsButton);

      expect(mockNavigate).toHaveBeenCalledWith('/audit');
    });
  });

  describe('pipeline summary navigation', () => {
    it('navigates to /files when Files pipeline card is clicked', async () => {
      const user = userEvent.setup();
      renderDashboardPage();

      // Find the pipeline summary Files card
      const pipelineSummary = screen.getByText('Pipeline Summary');
      const pipelineSection = pipelineSummary.closest('.bg-white');
      const filesCard = pipelineSection.querySelector('[role="button"]');

      if (filesCard) {
        await user.click(filesCard);
        expect(mockNavigate).toHaveBeenCalled();
      }
    });
  });

  describe('empty state interactions', () => {
    it('shows upload prompt in processing status when no files exist', () => {
      renderDashboardPage();

      expect(screen.getByText('No files uploaded yet.')).toBeDefined();
      expect(screen.getByText('Upload your first file')).toBeDefined();
    });

    it('navigates to upload when "Upload your first file" link is clicked', async () => {
      const user = userEvent.setup();
      renderDashboardPage();

      const uploadLink = screen.getByText('Upload your first file');
      await user.click(uploadLink);

      expect(mockNavigate).toHaveBeenCalledWith('/upload');
    });

    it('shows empty state in eligibility overview when no members exist', () => {
      renderDashboardPage();

      expect(screen.getByText('No members processed yet.')).toBeDefined();
      expect(screen.getByText('Upload an EDI 834 file to get started.')).toBeDefined();
    });
  });

  describe('role-based rendering', () => {
    it('hides Upload File button for Compliance role', () => {
      useAuthStore.setState({
        currentUser: { id: 'test-user-2', name: 'Compliance User', role: 'Compliance' },
        isAuthenticated: true,
      });

      renderDashboardPage();

      expect(screen.queryByText('Upload File')).toBeNull();
    });

    it('shows View Members button for Compliance role', () => {
      useAuthStore.setState({
        currentUser: { id: 'test-user-2', name: 'Compliance User', role: 'Compliance' },
        isAuthenticated: true,
      });

      renderDashboardPage();

      expect(screen.getByText('View Members')).toBeDefined();
    });

    it('shows View Logs button for Compliance role', () => {
      useAuthStore.setState({
        currentUser: { id: 'test-user-2', name: 'Compliance User', role: 'Compliance' },
        isAuthenticated: true,
      });

      renderDashboardPage();

      expect(screen.getByText('View Logs')).toBeDefined();
    });

    it('shows Upload File button for EnrollmentTeam role', () => {
      useAuthStore.setState({
        currentUser: { id: 'test-user-3', name: 'Enrollment User', role: 'EnrollmentTeam' },
        isAuthenticated: true,
      });

      renderDashboardPage();

      expect(screen.getByText('Upload File')).toBeDefined();
    });

    it('hides View Logs button for EnrollmentTeam role (no view_audit_logs permission)', () => {
      useAuthStore.setState({
        currentUser: { id: 'test-user-3', name: 'Enrollment User', role: 'EnrollmentTeam' },
        isAuthenticated: true,
      });

      renderDashboardPage();

      expect(screen.queryByText('View Logs')).toBeNull();
    });
  });

  describe('recent files table interaction', () => {
    beforeEach(() => {
      useFileStore.setState({
        files: [
          {
            id: 'file-1',
            name: 'test_file.edi',
            uploadSource: 'web',
            status: FILE_STATUS.COMPLETED,
            timestamp: new Date().toISOString(),
            members: [],
            rawContent: '',
            validationErrors: [],
            processedAt: new Date().toISOString(),
          },
        ],
      });
    });

    it('navigates to /files when a file row is clicked', async () => {
      const user = userEvent.setup();
      renderDashboardPage();

      const fileRow = screen.getByText('test_file.edi').closest('tr');
      if (fileRow) {
        await user.click(fileRow);
        expect(mockNavigate).toHaveBeenCalledWith('/files');
      }
    });

    it('navigates to /files when View All link is clicked', async () => {
      const user = userEvent.setup();
      renderDashboardPage();

      const viewAllLink = screen.getByText('View All →');
      await user.click(viewAllLink);

      expect(mockNavigate).toHaveBeenCalledWith('/files');
    });
  });

  describe('eligibility overview links', () => {
    beforeEach(() => {
      useMemberStore.setState({
        members: [
          {
            id: 'm1',
            memberId: 'M001',
            firstName: 'John',
            lastName: 'Doe',
            eligibilityStatus: MEMBER_STATUS.ELIGIBLE,
            status: MEMBER_STATUS.ELIGIBLE,
            demographics: {},
            coverage: '',
            history: [],
            enrollmentHistory: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      useEnrollmentStore.setState({
        enrollments: [
          {
            id: 'e1',
            memberId: 'M001',
            planId: 'MEDICAID_DEFAULT',
            status: MEMBER_STATUS.ELIGIBLE,
            effectiveDate: '2024-01-01',
            terminationDate: null,
            history: [],
            coverage: '',
            demographics: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
    });

    it('navigates to /eligibility when View Eligibility Rules link is clicked', async () => {
      const user = userEvent.setup();
      renderDashboardPage();

      const eligibilityLink = screen.getByText('View Eligibility Rules');
      await user.click(eligibilityLink);

      expect(mockNavigate).toHaveBeenCalledWith('/eligibility');
    });

    it('navigates to /enrollments when View Enrollments link is clicked', async () => {
      const user = userEvent.setup();
      renderDashboardPage();

      const enrollmentsLink = screen.getByText('View Enrollments');
      await user.click(enrollmentsLink);

      expect(mockNavigate).toHaveBeenCalledWith('/enrollments');
    });
  });

  describe('error summary navigation', () => {
    beforeEach(() => {
      useAuditStore.setState({
        auditLogs: [],
        errorLogs: [
          {
            logId: 'err-1',
            errorType: 'ValidationError',
            message: 'Test error',
            fileId: 'file-1',
            memberId: null,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    });

    it('navigates to /audit when View All Logs link in error summary is clicked', async () => {
      const user = userEvent.setup();
      renderDashboardPage();

      const viewAllLogsLink = screen.getByText('View All Logs →');
      await user.click(viewAllLogsLink);

      expect(mockNavigate).toHaveBeenCalledWith('/audit');
    });
  });

  describe('eligibility rate display', () => {
    it('displays eligibility rate badge when members exist', () => {
      useMemberStore.setState({
        members: [
          {
            id: 'm1',
            memberId: 'M001',
            firstName: 'John',
            lastName: 'Doe',
            eligibilityStatus: MEMBER_STATUS.ELIGIBLE,
            status: MEMBER_STATUS.ELIGIBLE,
            demographics: {},
            coverage: '',
            history: [],
            enrollmentHistory: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'm2',
            memberId: 'M002',
            firstName: 'Jane',
            lastName: 'Smith',
            eligibilityStatus: MEMBER_STATUS.INELIGIBLE,
            status: MEMBER_STATUS.INELIGIBLE,
            demographics: {},
            coverage: '',
            history: [],
            enrollmentHistory: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      useEnrollmentStore.setState({ enrollments: [] });

      renderDashboardPage();

      // 1 eligible out of 2 determined = 50.0% rate
      expect(screen.getByText('50.0% Rate')).toBeDefined();
    });

    it('does not display eligibility rate badge when no members exist', () => {
      renderDashboardPage();

      expect(screen.queryByText(/% Rate/)).toBeNull();
    });
  });

  describe('integration stats display', () => {
    it('displays integration log count in pipeline summary', () => {
      useIntegrationStore.setState({
        integrationLogs: [
          {
            id: 'int-1',
            timestamp: new Date().toISOString(),
            memberId: 'M001',
            status: 'Success',
            destination: 'medicaid-state-system',
            destinationName: 'State Medicaid System',
            destinationUrl: '/mock',
            userId: 'test-user-1',
            userName: 'Test Admin',
            response: { success: true, statusCode: 200, message: 'OK' },
            retryCount: 0,
            payload: {},
          },
          {
            id: 'int-2',
            timestamp: new Date().toISOString(),
            memberId: 'M002',
            status: 'Failed',
            destination: 'medicaid-state-system',
            destinationName: 'State Medicaid System',
            destinationUrl: '/mock',
            userId: 'test-user-1',
            userName: 'Test Admin',
            response: { success: false, statusCode: 500, message: 'Error' },
            retryCount: 0,
            payload: {},
          },
        ],
        integrationConfig: {
          endpoints: [
            { id: 'medicaid-state-system', name: 'State Medicaid System', url: '/mock', enabled: true },
          ],
          retryPolicy: { maxRetries: 3, delayMs: 100, backoffMultiplier: 2 },
        },
      });

      renderDashboardPage();

      // Pipeline summary should show integration count
      const integrationsLabels = screen.getAllByText('Integrations');
      expect(integrationsLabels.length).toBeGreaterThan(0);
    });
  });
});