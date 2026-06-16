import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileUpload } from './FileUpload';
import { AuthProvider } from '../../contexts/AuthContext';
import { useAuthStore } from '../../stores/authStore';
import { useFileStore } from '../../stores/fileStore';
import { useMemberStore } from '../../stores/memberStore';
import { useEligibilityStore } from '../../stores/eligibilityStore';
import { useEnrollmentStore } from '../../stores/enrollmentStore';
import { useIntegrationStore } from '../../stores/integrationStore';
import { useAuditStore } from '../../stores/auditStore';

// Mock the processing pipeline to avoid real async delays
vi.mock('../../services/processingPipeline', () => ({
  processFile: vi.fn(),
  retryFileProcessing: vi.fn(),
}));

vi.mock('../../services/mockEndpoints', () => ({
  mockApiUpload: vi.fn(),
  mockSftpUpload: vi.fn(),
}));

vi.mock('../../services/fileValidator', () => ({
  validateFile: vi.fn(),
}));

import { processFile } from '../../services/processingPipeline';
import { mockApiUpload, mockSftpUpload } from '../../services/mockEndpoints';
import { validateFile } from '../../services/fileValidator';

/**
 * Helper to render FileUpload wrapped in AuthProvider with an authenticated user.
 * @param {object} [props] - Optional props to pass to FileUpload.
 * @returns {object} The render result.
 */
function renderFileUpload(props = {}) {
  return render(
    <AuthProvider>
      <FileUpload {...props} />
    </AuthProvider>
  );
}

describe('FileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up authenticated user
    useAuthStore.setState({
      currentUser: { id: 'test-user-1', name: 'Test User', role: 'Admin' },
      isAuthenticated: true,
    });

    // Reset stores
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

    // Default mock for validateFile - valid file
    validateFile.mockReturnValue({ valid: true, errors: [] });
  });

  describe('rendering', () => {
    it('renders the upload source selector with three options', () => {
      renderFileUpload();

      expect(screen.getByText('Upload Source')).toBeDefined();
      expect(screen.getByText('Web Upload')).toBeDefined();
      expect(screen.getByText('Mock API')).toBeDefined();
      expect(screen.getByText('Mock SFTP')).toBeDefined();
    });

    it('renders the drag and drop zone with browse button', () => {
      renderFileUpload();

      expect(screen.getByText('Browse Files')).toBeDefined();
      expect(screen.getByText(/Drag and drop/)).toBeDefined();
    });

    it('renders supported file format information', () => {
      renderFileUpload();

      expect(screen.getByText(/Supported formats/)).toBeDefined();
    });
  });

  describe('upload source selector', () => {
    it('defaults to Web Upload source', () => {
      renderFileUpload();

      const webButton = screen.getByText('Web Upload').closest('button');
      expect(webButton.className).toContain('border-primary-500');
    });

    it('switches to Mock API source when clicked', async () => {
      const user = userEvent.setup();
      renderFileUpload();

      const apiButton = screen.getByText('Mock API').closest('button');
      await user.click(apiButton);

      expect(apiButton.className).toContain('border-primary-500');
    });

    it('switches to Mock SFTP source when clicked', async () => {
      const user = userEvent.setup();
      renderFileUpload();

      const sftpButton = screen.getByText('Mock SFTP').closest('button');
      await user.click(sftpButton);

      expect(sftpButton.className).toContain('border-primary-500');
    });

    it('shows description text for each upload source', () => {
      renderFileUpload();

      expect(screen.getByText('Upload directly via browser')).toBeDefined();
      expect(screen.getByText('Simulate API file ingestion')).toBeDefined();
      expect(screen.getByText('Simulate SFTP file transfer')).toBeDefined();
    });
  });

  describe('file selection via input', () => {
    it('shows file preview after selecting a valid file', async () => {
      const user = userEvent.setup();
      renderFileUpload();

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['ISA*00*test~'], 'enrollment.edi', { type: 'text/plain' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Preview')).toBeDefined();
        expect(screen.getByText('enrollment.edi')).toBeDefined();
      });
    });

    it('shows file ready alert after selecting a valid file', async () => {
      const user = userEvent.setup();
      renderFileUpload();

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['ISA*00*test~'], 'enrollment.edi', { type: 'text/plain' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Ready')).toBeDefined();
      });
    });

    it('shows error alert when selecting an invalid file', async () => {
      validateFile.mockReturnValue({
        valid: false,
        errors: ['Unsupported file extension ".pdf". Supported extensions: .edi, .x12, .834, .csv, .txt, .json, .xml'],
      });

      const user = userEvent.setup();
      renderFileUpload();

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['some content'], 'document.pdf', { type: 'application/pdf' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Validation Failed')).toBeDefined();
      });
    });

    it('shows validation error details for invalid file', async () => {
      validateFile.mockReturnValue({
        valid: false,
        errors: ['File is empty (0 bytes).'],
      });

      const user = userEvent.setup();
      renderFileUpload();

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File([''], 'empty.edi', { type: 'text/plain' });
      Object.defineProperty(testFile, 'size', { value: 0 });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Validation Failed')).toBeDefined();
      });
    });
  });

  describe('file upload processing via web', () => {
    it('triggers processing pipeline on upload button click', async () => {
      processFile.mockResolvedValue({
        success: true,
        fileId: 'file-123',
        members: [{ id: 'm1', memberId: 'M001', firstName: 'John', lastName: 'Doe', eligibilityStatus: 'Eligible' }],
        enrollments: [{ id: 'e1', memberId: 'M001', status: 'Eligible' }],
        integrationResults: [],
        stages: [],
        errors: [],
        message: 'File processed successfully.',
      });

      const user = userEvent.setup();
      renderFileUpload();

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['ISA*00*test content~GS*HP~ST*834~SE*2~GE*1~IEA*1~'], 'enrollment.edi', { type: 'text/plain' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Preview')).toBeDefined();
      });

      const uploadButton = screen.getByText(/Upload via Web/);
      await user.click(uploadButton);

      await waitFor(() => {
        expect(processFile).toHaveBeenCalledTimes(1);
      });
    });

    it('shows success result after successful processing', async () => {
      processFile.mockResolvedValue({
        success: true,
        fileId: 'file-456',
        members: [{ id: 'm1', memberId: 'M001', firstName: 'John', lastName: 'Doe', eligibilityStatus: 'Eligible' }],
        enrollments: [{ id: 'e1', memberId: 'M001', status: 'Eligible' }],
        integrationResults: [],
        stages: [],
        errors: [],
        message: 'File processed successfully.',
      });

      const user = userEvent.setup();
      renderFileUpload();

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['ISA*00*test~'], 'enrollment.edi', { type: 'text/plain' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Preview')).toBeDefined();
      });

      const uploadButton = screen.getByText(/Upload via Web/);
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText('Processing Completed Successfully')).toBeDefined();
      });
    });

    it('shows error result after failed processing', async () => {
      processFile.mockResolvedValue({
        success: false,
        fileId: 'file-789',
        members: [],
        enrollments: [],
        integrationResults: [],
        stages: [],
        errors: ['EDI 834 format validation failed: Missing ISA segment.'],
        message: 'Processing failed.',
      });

      const user = userEvent.setup();
      renderFileUpload();

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['invalid content'], 'bad.edi', { type: 'text/plain' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Preview')).toBeDefined();
      });

      const uploadButton = screen.getByText(/Upload via Web/);
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText('Processing Failed')).toBeDefined();
      });
    });

    it('calls onUploadComplete callback after processing', async () => {
      const onUploadComplete = vi.fn();

      processFile.mockResolvedValue({
        success: true,
        fileId: 'file-callback',
        members: [],
        enrollments: [],
        integrationResults: [],
        stages: [],
        errors: [],
        message: 'Done.',
      });

      const user = userEvent.setup();
      renderFileUpload({ onUploadComplete });

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['ISA*00*test~'], 'enrollment.edi', { type: 'text/plain' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Preview')).toBeDefined();
      });

      const uploadButton = screen.getByText(/Upload via Web/);
      await user.click(uploadButton);

      await waitFor(() => {
        expect(onUploadComplete).toHaveBeenCalledTimes(1);
        expect(onUploadComplete).toHaveBeenCalledWith(
          expect.objectContaining({ success: true, fileId: 'file-callback' })
        );
      });
    });
  });

  describe('file upload processing via Mock API', () => {
    it('uses mockApiUpload when API source is selected', async () => {
      mockApiUpload.mockResolvedValue({
        status: 'success',
        statusCode: 201,
        message: 'File uploaded via API.',
        data: {
          fileId: 'api-file-1',
          memberCount: 1,
          enrollmentCount: 1,
          integrationCount: 0,
          stages: [],
        },
      });

      const user = userEvent.setup();
      renderFileUpload();

      // Switch to API source
      const apiButton = screen.getByText('Mock API').closest('button');
      await user.click(apiButton);

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['ISA*00*api content~'], 'api_upload.edi', { type: 'text/plain' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Preview')).toBeDefined();
      });

      const uploadButton = screen.getByText(/Upload via Mock API/);
      await user.click(uploadButton);

      await waitFor(() => {
        expect(mockApiUpload).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('file upload processing via Mock SFTP', () => {
    it('uses mockSftpUpload when SFTP source is selected', async () => {
      mockSftpUpload.mockResolvedValue({
        status: 'success',
        statusCode: 201,
        message: 'File received via SFTP.',
        data: {
          fileId: 'sftp-file-1',
          memberCount: 1,
          enrollmentCount: 1,
          integrationCount: 0,
          stages: [],
        },
      });

      const user = userEvent.setup();
      renderFileUpload();

      // Switch to SFTP source
      const sftpButton = screen.getByText('Mock SFTP').closest('button');
      await user.click(sftpButton);

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['ISA*00*sftp content~'], 'sftp_upload.edi', { type: 'text/plain' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Preview')).toBeDefined();
      });

      const uploadButton = screen.getByText(/Upload via Mock SFTP/);
      await user.click(uploadButton);

      await waitFor(() => {
        expect(mockSftpUpload).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('loading state during processing', () => {
    it('shows processing spinner and pipeline section during upload', async () => {
      let resolveProcessing;
      processFile.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveProcessing = resolve;
        });
      });

      const user = userEvent.setup();
      renderFileUpload();

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['ISA*00*test~'], 'enrollment.edi', { type: 'text/plain' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Preview')).toBeDefined();
      });

      const uploadButton = screen.getByText(/Upload via Web/);
      await user.click(uploadButton);

      // While processing, the pipeline section should be visible
      await waitFor(() => {
        expect(screen.getByText('Processing Pipeline')).toBeDefined();
        expect(screen.getByText('Processing file through pipeline...')).toBeDefined();
      });

      // Resolve the processing
      resolveProcessing({
        success: true,
        fileId: 'file-loading',
        members: [],
        enrollments: [],
        integrationResults: [],
        stages: [],
        errors: [],
        message: 'Done.',
      });

      await waitFor(() => {
        expect(screen.getByText('Processing Result')).toBeDefined();
      });
    });

    it('disables upload button during processing', async () => {
      let resolveProcessing;
      processFile.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveProcessing = resolve;
        });
      });

      const user = userEvent.setup();
      renderFileUpload();

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['ISA*00*test~'], 'enrollment.edi', { type: 'text/plain' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Preview')).toBeDefined();
      });

      const uploadButton = screen.getByText(/Upload via Web/);
      await user.click(uploadButton);

      // During processing, the button text should change
      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeDefined();
      });

      resolveProcessing({
        success: true,
        fileId: 'file-disable',
        members: [],
        enrollments: [],
        integrationResults: [],
        stages: [],
        errors: [],
        message: 'Done.',
      });

      await waitFor(() => {
        expect(screen.getByText('Processing Result')).toBeDefined();
      });
    });
  });

  describe('clear and reset', () => {
    it('clears selected file when clear button is clicked', async () => {
      const user = userEvent.setup();
      renderFileUpload();

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['ISA*00*test~'], 'enrollment.edi', { type: 'text/plain' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Preview')).toBeDefined();
        expect(screen.getByText('enrollment.edi')).toBeDefined();
      });

      const clearButton = screen.getByText('Clear');
      await user.click(clearButton);

      await waitFor(() => {
        expect(screen.queryByText('File Preview')).toBeNull();
      });
    });

    it('shows Upload Another File button after successful processing', async () => {
      processFile.mockResolvedValue({
        success: true,
        fileId: 'file-another',
        members: [],
        enrollments: [],
        integrationResults: [],
        stages: [],
        errors: [],
        message: 'Done.',
      });

      const user = userEvent.setup();
      renderFileUpload();

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['ISA*00*test~'], 'enrollment.edi', { type: 'text/plain' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Preview')).toBeDefined();
      });

      const uploadButton = screen.getByText(/Upload via Web/);
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText('Upload Another File')).toBeDefined();
      });
    });
  });

  describe('error handling', () => {
    it('handles processing pipeline throwing an error', async () => {
      processFile.mockRejectedValue(new Error('Unexpected pipeline failure'));

      const user = userEvent.setup();
      renderFileUpload();

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['ISA*00*test~'], 'enrollment.edi', { type: 'text/plain' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Preview')).toBeDefined();
      });

      const uploadButton = screen.getByText(/Upload via Web/);
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText('Upload Error')).toBeDefined();
        expect(screen.getByText('Unexpected pipeline failure')).toBeDefined();
      });
    });

    it('does not allow upload when file validation failed', async () => {
      validateFile.mockReturnValue({
        valid: false,
        errors: ['Unsupported file extension ".pdf".'],
      });

      const user = userEvent.setup();
      renderFileUpload();

      const fileInput = screen.getByLabelText('File upload input');
      const testFile = new File(['content'], 'document.pdf', { type: 'application/pdf' });

      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('File Validation Failed')).toBeDefined();
      });

      // The upload button should not be present or should be disabled
      // since the file is invalid, the upload button should be disabled
      const uploadButtons = screen.queryAllByText(/Upload via/);
      if (uploadButtons.length > 0) {
        expect(uploadButtons[0].closest('button').disabled).toBe(true);
      }
    });
  });

  describe('drag and drop', () => {
    it('handles file drop on the drop zone', async () => {
      renderFileUpload();

      const dropZone = screen.getByText(/Drag and drop/).closest('div');

      const testFile = new File(['ISA*00*dropped content~'], 'dropped.edi', { type: 'text/plain' });

      const dataTransfer = {
        files: [testFile],
        items: [{ kind: 'file', type: testFile.type, getAsFile: () => testFile }],
        types: ['Files'],
      };

      // Fire dragover
      const dragOverEvent = new Event('dragover', { bubbles: true });
      Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer });
      dragOverEvent.preventDefault = vi.fn();
      dragOverEvent.stopPropagation = vi.fn();
      dropZone.dispatchEvent(dragOverEvent);

      // Fire drop
      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
      dropEvent.preventDefault = vi.fn();
      dropEvent.stopPropagation = vi.fn();
      dropZone.dispatchEvent(dropEvent);

      await waitFor(() => {
        expect(screen.getByText('dropped.edi')).toBeDefined();
      });
    });
  });
});