import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuditStore } from './auditStore';

describe('auditStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useAuditStore.setState({
      auditLogs: [],
      errorLogs: [],
    });
  });

  describe('logAction', () => {
    it('creates an audit entry with correct fields', () => {
      const store = useAuditStore.getState();

      const entry = store.logAction('File Uploaded', 'file-123', 'user-456', {
        fileName: 'test.edi',
        fileSize: 1024,
      });

      expect(entry).toBeDefined();
      expect(entry.logId).toBeDefined();
      expect(typeof entry.logId).toBe('string');
      expect(entry.logId.length).toBeGreaterThan(0);
      expect(entry.action).toBe('File Uploaded');
      expect(entry.entityId).toBe('file-123');
      expect(entry.userId).toBe('user-456');
      expect(entry.timestamp).toBeDefined();
      expect(entry.details).toEqual({
        fileName: 'test.edi',
        fileSize: 1024,
      });

      const { auditLogs } = useAuditStore.getState();
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]).toEqual(entry);
    });

    it('prepends new entries to the beginning of the audit logs array', () => {
      const store = useAuditStore.getState();

      store.logAction('First Action', 'entity-1', 'user-1');
      store.logAction('Second Action', 'entity-2', 'user-2');

      const { auditLogs } = useAuditStore.getState();
      expect(auditLogs).toHaveLength(2);
      expect(auditLogs[0].action).toBe('Second Action');
      expect(auditLogs[1].action).toBe('First Action');
    });

    it('handles missing optional details parameter', () => {
      const store = useAuditStore.getState();

      const entry = store.logAction('Member Viewed', 'member-1', 'user-1');

      expect(entry.details).toBeNull();
    });

    it('handles empty string parameters gracefully', () => {
      const store = useAuditStore.getState();

      const entry = store.logAction('', '', '');

      expect(entry.action).toBe('');
      expect(entry.entityId).toBe('');
      expect(entry.userId).toBe('');
      expect(entry.logId).toBeDefined();
      expect(entry.timestamp).toBeDefined();
    });

    it('persists audit logs to localStorage', () => {
      const store = useAuditStore.getState();

      store.logAction('File Uploaded', 'file-1', 'user-1');

      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('logError', () => {
    it('creates an error entry with correct fields', () => {
      const store = useAuditStore.getState();

      const entry = store.logError(
        'ValidationError',
        'Missing ISA segment',
        'file-123',
        'member-456'
      );

      expect(entry).toBeDefined();
      expect(entry.logId).toBeDefined();
      expect(typeof entry.logId).toBe('string');
      expect(entry.errorType).toBe('ValidationError');
      expect(entry.message).toBe('Missing ISA segment');
      expect(entry.fileId).toBe('file-123');
      expect(entry.memberId).toBe('member-456');
      expect(entry.timestamp).toBeDefined();

      const { errorLogs } = useAuditStore.getState();
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0]).toEqual(entry);
    });

    it('also adds an error action to audit logs', () => {
      const store = useAuditStore.getState();

      store.logError('ParsingError', 'Invalid segment format', 'file-1', null);

      const { auditLogs, errorLogs } = useAuditStore.getState();
      expect(errorLogs).toHaveLength(1);
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].action).toBe('Error: ParsingError');
      expect(auditLogs[0].details).toEqual({
        errorType: 'ParsingError',
        message: 'Invalid segment format',
        fileId: 'file-1',
        memberId: null,
      });
    });

    it('handles null fileId and memberId', () => {
      const store = useAuditStore.getState();

      const entry = store.logError('IntegrationError', 'Connection timeout');

      expect(entry.fileId).toBeNull();
      expect(entry.memberId).toBeNull();
    });

    it('prepends new error entries to the beginning of the error logs array', () => {
      const store = useAuditStore.getState();

      store.logError('ValidationError', 'First error', 'file-1');
      store.logError('ParsingError', 'Second error', 'file-2');

      const { errorLogs } = useAuditStore.getState();
      expect(errorLogs).toHaveLength(2);
      expect(errorLogs[0].errorType).toBe('ParsingError');
      expect(errorLogs[1].errorType).toBe('ValidationError');
    });

    it('persists error logs to localStorage', () => {
      const store = useAuditStore.getState();

      store.logError('EligibilityError', 'Rule evaluation failed', 'file-1');

      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('getLogs', () => {
    beforeEach(() => {
      const store = useAuditStore.getState();
      store.logAction('File Uploaded', 'file-1', 'user-1', { fileName: 'a.edi' });
      store.logAction('Member Added', 'member-1', 'user-2', { firstName: 'John' });
      store.logAction('File Uploaded', 'file-2', 'user-1', { fileName: 'b.edi' });
      store.logAction('Eligibility Determined', 'member-2', 'user-3');
    });

    it('returns all audit logs when no filters are provided', () => {
      const store = useAuditStore.getState();
      const logs = store.getLogs();

      expect(logs).toHaveLength(4);
    });

    it('filters by action', () => {
      const store = useAuditStore.getState();
      const logs = store.getLogs({ action: 'File Uploaded' });

      expect(logs).toHaveLength(2);
      logs.forEach((log) => {
        expect(log.action).toBe('File Uploaded');
      });
    });

    it('filters by entityId', () => {
      const store = useAuditStore.getState();
      const logs = store.getLogs({ entityId: 'file-1' });

      expect(logs).toHaveLength(1);
      expect(logs[0].entityId).toBe('file-1');
    });

    it('filters by userId', () => {
      const store = useAuditStore.getState();
      const logs = store.getLogs({ userId: 'user-1' });

      expect(logs).toHaveLength(2);
      logs.forEach((log) => {
        expect(log.userId).toBe('user-1');
      });
    });

    it('returns empty array when no logs match the filter', () => {
      const store = useAuditStore.getState();
      const logs = store.getLogs({ action: 'NonExistentAction' });

      expect(logs).toHaveLength(0);
    });

    it('returns all logs when filters is null or undefined', () => {
      const store = useAuditStore.getState();

      const logsNull = store.getLogs(null);
      expect(logsNull).toHaveLength(4);

      const logsUndefined = store.getLogs(undefined);
      expect(logsUndefined).toHaveLength(4);
    });
  });

  describe('getErrorLogs', () => {
    beforeEach(() => {
      const store = useAuditStore.getState();
      store.logError('ValidationError', 'Missing ISA', 'file-1', null);
      store.logError('ParsingError', 'Bad format', 'file-2', 'member-1');
      store.logError('ValidationError', 'Missing GS', 'file-3', null);
    });

    it('returns all error logs when no filters are provided', () => {
      const store = useAuditStore.getState();
      const logs = store.getErrorLogs();

      expect(logs).toHaveLength(3);
    });

    it('filters by errorType', () => {
      const store = useAuditStore.getState();
      const logs = store.getErrorLogs({ errorType: 'ValidationError' });

      expect(logs).toHaveLength(2);
      logs.forEach((log) => {
        expect(log.errorType).toBe('ValidationError');
      });
    });

    it('filters by fileId', () => {
      const store = useAuditStore.getState();
      const logs = store.getErrorLogs({ fileId: 'file-2' });

      expect(logs).toHaveLength(1);
      expect(logs[0].fileId).toBe('file-2');
    });

    it('filters by memberId', () => {
      const store = useAuditStore.getState();
      const logs = store.getErrorLogs({ memberId: 'member-1' });

      expect(logs).toHaveLength(1);
      expect(logs[0].memberId).toBe('member-1');
    });
  });

  describe('clearLogs', () => {
    it('empties both audit logs and error logs arrays', () => {
      const store = useAuditStore.getState();

      store.logAction('File Uploaded', 'file-1', 'user-1');
      store.logAction('Member Added', 'member-1', 'user-2');
      store.logError('ValidationError', 'Missing ISA', 'file-1');
      store.logError('ParsingError', 'Bad format', 'file-2');

      let state = useAuditStore.getState();
      expect(state.auditLogs.length).toBeGreaterThan(0);
      expect(state.errorLogs.length).toBeGreaterThan(0);

      state.clearLogs();

      state = useAuditStore.getState();
      expect(state.auditLogs).toHaveLength(0);
      expect(state.errorLogs).toHaveLength(0);
    });

    it('persists empty arrays to localStorage after clearing', () => {
      const store = useAuditStore.getState();

      store.logAction('File Uploaded', 'file-1', 'user-1');
      store.clearLogs();

      // localStorage.setItem should have been called with empty arrays
      const setItemCalls = localStorage.setItem.mock.calls;
      const lastCalls = setItemCalls.slice(-2);

      const emptyArrayCalls = lastCalls.filter(
        ([, value]) => value === '[]'
      );
      expect(emptyArrayCalls.length).toBe(2);
    });

    it('works correctly when logs are already empty', () => {
      const store = useAuditStore.getState();

      expect(store.auditLogs).toHaveLength(0);
      expect(store.errorLogs).toHaveLength(0);

      store.clearLogs();

      const state = useAuditStore.getState();
      expect(state.auditLogs).toHaveLength(0);
      expect(state.errorLogs).toHaveLength(0);
    });
  });

  describe('exportLogs', () => {
    it('returns a valid JSON string with correct format', () => {
      const store = useAuditStore.getState();

      store.logAction('File Uploaded', 'file-1', 'user-1', { fileName: 'test.edi' });
      store.logError('ValidationError', 'Missing ISA', 'file-1');

      const exported = store.exportLogs();

      expect(typeof exported).toBe('string');

      const parsed = JSON.parse(exported);
      expect(parsed).toBeDefined();
      expect(parsed.exportedAt).toBeDefined();
      expect(typeof parsed.exportedAt).toBe('string');
      expect(Array.isArray(parsed.auditLogs)).toBe(true);
      expect(Array.isArray(parsed.errorLogs)).toBe(true);
    });

    it('includes all audit logs and error logs in the export', () => {
      const store = useAuditStore.getState();

      store.logAction('File Uploaded', 'file-1', 'user-1');
      store.logAction('Member Added', 'member-1', 'user-2');
      store.logError('ValidationError', 'Missing ISA', 'file-1');

      const exported = store.exportLogs();
      const parsed = JSON.parse(exported);

      // auditLogs includes the 2 logAction entries + 1 error action from logError
      expect(parsed.auditLogs).toHaveLength(3);
      expect(parsed.errorLogs).toHaveLength(1);
    });

    it('returns correct format when logs are empty', () => {
      const store = useAuditStore.getState();

      const exported = store.exportLogs();
      const parsed = JSON.parse(exported);

      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.auditLogs).toHaveLength(0);
      expect(parsed.errorLogs).toHaveLength(0);
    });

    it('preserves log entry details in the export', () => {
      const store = useAuditStore.getState();

      store.logAction('File Uploaded', 'file-1', 'user-1', {
        fileName: 'test.edi',
        fileSize: 2048,
      });

      const exported = store.exportLogs();
      const parsed = JSON.parse(exported);

      const logEntry = parsed.auditLogs[0];
      expect(logEntry.action).toBe('File Uploaded');
      expect(logEntry.entityId).toBe('file-1');
      expect(logEntry.userId).toBe('user-1');
      expect(logEntry.details).toEqual({
        fileName: 'test.edi',
        fileSize: 2048,
      });
    });
  });

  describe('date range filtering', () => {
    it('filters audit logs by startDate', () => {
      useAuditStore.setState({
        auditLogs: [
          {
            logId: 'log-1',
            action: 'Old Action',
            entityId: '',
            userId: '',
            timestamp: '2023-01-01T00:00:00.000Z',
            details: null,
          },
          {
            logId: 'log-2',
            action: 'New Action',
            entityId: '',
            userId: '',
            timestamp: '2024-06-15T00:00:00.000Z',
            details: null,
          },
        ],
        errorLogs: [],
      });

      const store = useAuditStore.getState();
      const logs = store.getLogs({ startDate: '2024-01-01T00:00:00.000Z' });

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('New Action');
    });

    it('filters audit logs by endDate', () => {
      useAuditStore.setState({
        auditLogs: [
          {
            logId: 'log-1',
            action: 'Old Action',
            entityId: '',
            userId: '',
            timestamp: '2023-01-01T00:00:00.000Z',
            details: null,
          },
          {
            logId: 'log-2',
            action: 'New Action',
            entityId: '',
            userId: '',
            timestamp: '2024-06-15T00:00:00.000Z',
            details: null,
          },
        ],
        errorLogs: [],
      });

      const store = useAuditStore.getState();
      const logs = store.getLogs({ endDate: '2023-12-31T23:59:59.999Z' });

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('Old Action');
    });
  });

  describe('standalone functions', () => {
    it('logAction standalone function works correctly', async () => {
      const { logAction } = await import('./auditStore');

      const entry = logAction('Standalone Action', 'entity-1', 'user-1', { key: 'value' });

      expect(entry).toBeDefined();
      expect(entry.action).toBe('Standalone Action');
      expect(entry.entityId).toBe('entity-1');
    });

    it('logError standalone function works correctly', async () => {
      const { logError } = await import('./auditStore');

      const entry = logError('IntegrationError', 'Timeout occurred', 'file-1', 'member-1');

      expect(entry).toBeDefined();
      expect(entry.errorType).toBe('IntegrationError');
      expect(entry.message).toBe('Timeout occurred');
    });

    it('getLogs standalone function works correctly', async () => {
      const { logAction: standaloneLogAction, getLogs } = await import('./auditStore');

      standaloneLogAction('Test Action', 'entity-1', 'user-1');

      const logs = getLogs();
      expect(logs.length).toBeGreaterThan(0);
    });
  });
});