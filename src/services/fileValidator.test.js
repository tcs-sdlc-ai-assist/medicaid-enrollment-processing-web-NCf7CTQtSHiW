import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateFile,
  validateEDI834Format,
  detectDuplicate,
  getFileExtension,
  generateContentHash,
  validateFileExtension,
  validateFileSize,
  validateMimeType,
  ALLOWED_MIME_TYPES,
} from './fileValidator';
import { generateSampleEDI834 } from './edi834Parser';
import { MAX_FILE_SIZE_BYTES, SUPPORTED_FILE_EXTENSIONS } from '../utils/constants';

describe('fileValidator', () => {
  describe('validateFile', () => {
    describe('with valid files', () => {
      it('accepts a valid .edi file with correct size and type', () => {
        const file = {
          name: 'enrollment.edi',
          size: 1024,
          type: 'text/plain',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('accepts a valid .x12 file', () => {
        const file = {
          name: 'data.x12',
          size: 2048,
          type: 'application/octet-stream',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('accepts a valid .834 file', () => {
        const file = {
          name: 'members.834',
          size: 5000,
          type: 'text/plain',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('accepts a valid .csv file', () => {
        const file = {
          name: 'report.csv',
          size: 512,
          type: 'text/csv',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('accepts a valid .txt file', () => {
        const file = {
          name: 'data.txt',
          size: 100,
          type: 'text/plain',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('accepts a valid .json file', () => {
        const file = {
          name: 'config.json',
          size: 256,
          type: 'application/json',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('accepts a valid .xml file', () => {
        const file = {
          name: 'data.xml',
          size: 4096,
          type: 'application/xml',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('accepts a file with empty MIME type', () => {
        const file = {
          name: 'enrollment.edi',
          size: 1024,
          type: '',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('accepts a file with no type property', () => {
        const file = {
          name: 'enrollment.edi',
          size: 1024,
        };

        const result = validateFile(file);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('rejects oversized files', () => {
      it('rejects a file that exceeds the maximum file size', () => {
        const file = {
          name: 'large_file.edi',
          size: MAX_FILE_SIZE_BYTES + 1,
          type: 'text/plain',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        const hasSizeError = result.errors.some((e) => e.includes('size') || e.includes('exceeds'));
        expect(hasSizeError).toBe(true);
      });

      it('rejects a file that is exactly one byte over the limit', () => {
        const file = {
          name: 'barely_over.edi',
          size: MAX_FILE_SIZE_BYTES + 1,
          type: 'text/plain',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('accepts a file that is exactly at the maximum size', () => {
        const file = {
          name: 'max_size.edi',
          size: MAX_FILE_SIZE_BYTES,
          type: 'text/plain',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('rejects wrong extensions', () => {
      it('rejects a .pdf file', () => {
        const file = {
          name: 'document.pdf',
          size: 1024,
          type: 'application/pdf',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        const hasExtensionError = result.errors.some((e) => e.includes('extension') || e.includes('Unsupported'));
        expect(hasExtensionError).toBe(true);
      });

      it('rejects a .docx file', () => {
        const file = {
          name: 'report.docx',
          size: 2048,
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('rejects a .exe file', () => {
        const file = {
          name: 'program.exe',
          size: 1024,
          type: 'application/octet-stream',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        const hasExtensionError = result.errors.some((e) => e.includes('.exe'));
        expect(hasExtensionError).toBe(true);
      });

      it('rejects a .zip file', () => {
        const file = {
          name: 'archive.zip',
          size: 1024,
          type: 'application/zip',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('rejects a file with no extension', () => {
        const file = {
          name: 'noextension',
          size: 1024,
          type: 'text/plain',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        const hasExtensionError = result.errors.some((e) => e.includes('extension'));
        expect(hasExtensionError).toBe(true);
      });
    });

    describe('rejects empty and zero-size files', () => {
      it('rejects a file with size 0', () => {
        const file = {
          name: 'empty.edi',
          size: 0,
          type: 'text/plain',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        const hasSizeError = result.errors.some((e) => e.includes('empty') || e.includes('0 bytes'));
        expect(hasSizeError).toBe(true);
      });

      it('rejects a file with negative size', () => {
        const file = {
          name: 'negative.edi',
          size: -100,
          type: 'text/plain',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('rejects invalid input', () => {
      it('rejects null input', () => {
        const result = validateFile(null);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        const hasNoFileError = result.errors.some((e) => e.includes('No file'));
        expect(hasNoFileError).toBe(true);
      });

      it('rejects undefined input', () => {
        const result = validateFile(undefined);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('rejects string input', () => {
        const result = validateFile('not a file');

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('rejects number input', () => {
        const result = validateFile(12345);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('collects multiple errors', () => {
      it('reports both extension and size errors for an invalid file', () => {
        const file = {
          name: 'bad_file.pdf',
          size: MAX_FILE_SIZE_BYTES + 1000,
          type: 'application/pdf',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(2);
      });

      it('reports extension error and empty size error', () => {
        const file = {
          name: 'bad_file.pdf',
          size: 0,
          type: 'text/plain',
        };

        const result = validateFile(file);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('validateEDI834Format', () => {
    describe('with valid EDI 834 content', () => {
      it('validates well-formed EDI 834 content as valid', () => {
        const content = generateSampleEDI834({ memberCount: 1 });
        const result = validateEDI834Format(content);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.segmentCount).toBeGreaterThan(0);
      });

      it('validates multi-member EDI 834 content as valid', () => {
        const content = generateSampleEDI834({ memberCount: 5 });
        const result = validateEDI834Format(content);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.segmentCount).toBeGreaterThan(0);
      });

      it('returns segment count for valid content', () => {
        const content = generateSampleEDI834({ memberCount: 3 });
        const result = validateEDI834Format(content);

        expect(result.segmentCount).toBeGreaterThan(0);
      });
    });

    describe('catches missing segments', () => {
      it('catches missing ISA segment', () => {
        const content = 'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1~ST*834*0001~INS*Y*18*021**A***FT~NM1*IL*1*DOE*JOHN****34*100000001~SE*3*0001~GE*1*1~IEA*1*000000001~';
        const result = validateEDI834Format(content);

        expect(result.valid).toBe(false);
        const hasIsaError = result.errors.some((e) => e.includes('ISA'));
        expect(hasIsaError).toBe(true);
      });

      it('catches content not starting with ISA', () => {
        const content = 'GS*HP*SENDER*RECEIVER~ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:~ST*834*0001~SE*2*0001~GE*1*1~IEA*1*000000001~';
        const result = validateEDI834Format(content);

        expect(result.valid).toBe(false);
        const hasStartError = result.errors.some((e) => e.includes('ISA') || e.includes('start'));
        expect(hasStartError).toBe(true);
      });

      it('catches missing GS segment', () => {
        const content = 'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:~ST*834*0001~INS*Y*18*021**A***FT~NM1*IL*1*DOE*JOHN****34*100000001~SE*3*0001~IEA*1*000000001~';
        const result = validateEDI834Format(content);

        expect(result.valid).toBe(false);
        const hasGsError = result.errors.some((e) => e.includes('GS') || e.includes('GE'));
        expect(hasGsError).toBe(true);
      });

      it('catches missing ST segment', () => {
        const content = 'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:~GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1~INS*Y*18*021**A***FT~SE*2*0001~GE*1*1~IEA*1*000000001~';
        const result = validateEDI834Format(content);

        expect(result.valid).toBe(false);
        const hasStError = result.errors.some((e) => e.includes('ST'));
        expect(hasStError).toBe(true);
      });

      it('catches missing SE segment', () => {
        const content = 'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:~GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1~ST*834*0001~INS*Y*18*021**A***FT~GE*1*1~IEA*1*000000001~';
        const result = validateEDI834Format(content);

        expect(result.valid).toBe(false);
        const hasSeError = result.errors.some((e) => e.includes('SE'));
        expect(hasSeError).toBe(true);
      });

      it('catches missing GE segment', () => {
        const content = 'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:~GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1~ST*834*0001~INS*Y*18*021**A***FT~SE*3*0001~IEA*1*000000001~';
        const result = validateEDI834Format(content);

        expect(result.valid).toBe(false);
        const hasGeError = result.errors.some((e) => e.includes('GE'));
        expect(hasGeError).toBe(true);
      });

      it('catches missing IEA segment', () => {
        const content = 'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:~GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1~ST*834*0001~INS*Y*18*021**A***FT~SE*3*0001~GE*1*1~';
        const result = validateEDI834Format(content);

        expect(result.valid).toBe(false);
        const hasIeaError = result.errors.some((e) => e.includes('IEA'));
        expect(hasIeaError).toBe(true);
      });

      it('catches missing INS segment (no member data)', () => {
        const content = [
          'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:',
          'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1',
          'ST*834*0001',
          'SE*2*0001',
          'GE*1*1',
          'IEA*1*000000001',
        ].join('~') + '~';

        const result = validateEDI834Format(content);

        expect(result.valid).toBe(false);
        const hasInsError = result.errors.some((e) => e.includes('INS'));
        expect(hasInsError).toBe(true);
      });
    });

    describe('catches invalid structure', () => {
      it('catches wrong transaction set ID (not 834)', () => {
        const content = [
          'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:',
          'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1',
          'ST*837*0001',
          'INS*Y*18*021**A***FT',
          'NM1*IL*1*DOE*JOHN****34*100000001',
          'SE*3*0001',
          'GE*1*1',
          'IEA*1*000000001',
        ].join('~') + '~';

        const result = validateEDI834Format(content);

        expect(result.valid).toBe(false);
        const hasTransactionError = result.errors.some((e) => e.includes('834') || e.includes('837') || e.includes('transaction'));
        expect(hasTransactionError).toBe(true);
      });

      it('catches mismatched ISA/IEA control numbers', () => {
        const content = [
          'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:',
          'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1',
          'ST*834*0001',
          'INS*Y*18*021**A***FT',
          'NM1*IL*1*DOE*JOHN****34*100000001',
          'SE*3*0001',
          'GE*1*1',
          'IEA*1*000000999',
        ].join('~') + '~';

        const result = validateEDI834Format(content);

        expect(result.valid).toBe(false);
        const hasMismatchError = result.errors.some((e) => e.includes('mismatch'));
        expect(hasMismatchError).toBe(true);
      });
    });

    describe('with invalid input', () => {
      it('returns errors for null input', () => {
        const result = validateEDI834Format(null);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('returns errors for undefined input', () => {
        const result = validateEDI834Format(undefined);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('returns errors for empty string input', () => {
        const result = validateEDI834Format('');

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('returns errors for whitespace-only input', () => {
        const result = validateEDI834Format('   \n\t  ');

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('returns errors for random text content', () => {
        const result = validateEDI834Format('This is not an EDI file at all.');

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('returns errors for non-string input', () => {
        const result = validateEDI834Format(12345);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('detectDuplicate', () => {
    describe('identifies duplicate files by content hash', () => {
      it('detects a duplicate when file content matches an existing file', () => {
        const existingFiles = [
          {
            id: 'file-001',
            name: 'enrollment_jan.edi',
            size: 1024,
            rawContent: 'ISA*00*TEST_CONTENT_ALPHA~GS*HP*SENDER~ST*834*0001~SE*2*0001~GE*1*1~IEA*1*000000001~',
          },
          {
            id: 'file-002',
            name: 'enrollment_feb.edi',
            size: 2048,
            rawContent: 'ISA*00*TEST_CONTENT_BETA~GS*HP*SENDER~ST*834*0001~SE*2*0001~GE*1*1~IEA*1*000000001~',
          },
        ];

        const newFile = {
          name: 'enrollment_copy.edi',
          size: 1024,
          rawContent: 'ISA*00*TEST_CONTENT_ALPHA~GS*HP*SENDER~ST*834*0001~SE*2*0001~GE*1*1~IEA*1*000000001~',
        };

        const result = detectDuplicate(newFile, existingFiles);

        expect(result.isDuplicate).toBe(true);
        expect(result.duplicateFileId).toBe('file-001');
        expect(result.reason).toBeDefined();
        expect(typeof result.reason).toBe('string');
        expect(result.reason.length).toBeGreaterThan(0);
      });

      it('detects a duplicate by matching filename and size when content is not available', () => {
        const existingFiles = [
          {
            id: 'file-003',
            name: 'enrollment_march.edi',
            size: 5000,
          },
        ];

        const newFile = {
          name: 'enrollment_march.edi',
          size: 5000,
        };

        const result = detectDuplicate(newFile, existingFiles);

        expect(result.isDuplicate).toBe(true);
        expect(result.duplicateFileId).toBe('file-003');
        expect(result.reason).toBeDefined();
      });

      it('detects a duplicate by filename and size case-insensitively', () => {
        const existingFiles = [
          {
            id: 'file-004',
            name: 'Enrollment_April.EDI',
            size: 3000,
          },
        ];

        const newFile = {
          name: 'enrollment_april.edi',
          size: 3000,
        };

        const result = detectDuplicate(newFile, existingFiles);

        expect(result.isDuplicate).toBe(true);
        expect(result.duplicateFileId).toBe('file-004');
      });
    });

    describe('does not flag non-duplicates', () => {
      it('returns not duplicate when content is different', () => {
        const existingFiles = [
          {
            id: 'file-005',
            name: 'enrollment_may.edi',
            size: 1024,
            rawContent: 'ISA*00*UNIQUE_CONTENT_ONE~GS*HP*SENDER~ST*834*0001~SE*2*0001~GE*1*1~IEA*1*000000001~',
          },
        ];

        const newFile = {
          name: 'enrollment_june.edi',
          size: 2048,
          rawContent: 'ISA*00*COMPLETELY_DIFFERENT_CONTENT~GS*HP*SENDER~ST*834*0001~SE*2*0001~GE*1*1~IEA*1*000000001~',
        };

        const result = detectDuplicate(newFile, existingFiles);

        expect(result.isDuplicate).toBe(false);
        expect(result.duplicateFileId).toBeNull();
        expect(result.reason).toBeNull();
      });

      it('returns not duplicate when filename matches but size differs', () => {
        const existingFiles = [
          {
            id: 'file-006',
            name: 'enrollment.edi',
            size: 1024,
          },
        ];

        const newFile = {
          name: 'enrollment.edi',
          size: 2048,
        };

        const result = detectDuplicate(newFile, existingFiles);

        expect(result.isDuplicate).toBe(false);
      });

      it('returns not duplicate when size matches but filename differs', () => {
        const existingFiles = [
          {
            id: 'file-007',
            name: 'file_a.edi',
            size: 1024,
          },
        ];

        const newFile = {
          name: 'file_b.edi',
          size: 1024,
        };

        const result = detectDuplicate(newFile, existingFiles);

        expect(result.isDuplicate).toBe(false);
      });

      it('returns not duplicate when existing files array is empty', () => {
        const newFile = {
          name: 'enrollment.edi',
          size: 1024,
          rawContent: 'ISA*00*SOME_CONTENT~',
        };

        const result = detectDuplicate(newFile, []);

        expect(result.isDuplicate).toBe(false);
        expect(result.duplicateFileId).toBeNull();
        expect(result.reason).toBeNull();
      });

      it('returns not duplicate when existing files is null', () => {
        const newFile = {
          name: 'enrollment.edi',
          size: 1024,
        };

        const result = detectDuplicate(newFile, null);

        expect(result.isDuplicate).toBe(false);
      });

      it('returns not duplicate when existing files is undefined', () => {
        const newFile = {
          name: 'enrollment.edi',
          size: 1024,
        };

        const result = detectDuplicate(newFile, undefined);

        expect(result.isDuplicate).toBe(false);
      });
    });

    describe('handles edge cases', () => {
      it('returns not duplicate for null file input', () => {
        const result = detectDuplicate(null, [{ id: 'file-1', name: 'test.edi', size: 100 }]);

        expect(result.isDuplicate).toBe(false);
        expect(result.duplicateFileId).toBeNull();
        expect(result.reason).toBeNull();
      });

      it('returns not duplicate for undefined file input', () => {
        const result = detectDuplicate(undefined, [{ id: 'file-1', name: 'test.edi', size: 100 }]);

        expect(result.isDuplicate).toBe(false);
      });

      it('returns not duplicate for non-object file input', () => {
        const result = detectDuplicate('not a file', [{ id: 'file-1', name: 'test.edi', size: 100 }]);

        expect(result.isDuplicate).toBe(false);
      });

      it('handles file with fileContent property instead of rawContent', () => {
        const existingFiles = [
          {
            id: 'file-008',
            name: 'existing.edi',
            size: 1024,
            fileContent: 'ISA*00*SHARED_CONTENT_XYZ~GS*HP~ST*834*0001~SE*2*0001~GE*1*1~IEA*1*000000001~',
          },
        ];

        const newFile = {
          name: 'new.edi',
          size: 1024,
          fileContent: 'ISA*00*SHARED_CONTENT_XYZ~GS*HP~ST*834*0001~SE*2*0001~GE*1*1~IEA*1*000000001~',
        };

        const result = detectDuplicate(newFile, existingFiles);

        expect(result.isDuplicate).toBe(true);
        expect(result.duplicateFileId).toBe('file-008');
      });

      it('handles existing file with fileId property instead of id', () => {
        const existingFiles = [
          {
            fileId: 'file-009',
            name: 'existing.edi',
            size: 1024,
            rawContent: 'ISA*00*CONTENT_FOR_FILEID_TEST~',
          },
        ];

        const newFile = {
          name: 'new.edi',
          size: 1024,
          rawContent: 'ISA*00*CONTENT_FOR_FILEID_TEST~',
        };

        const result = detectDuplicate(newFile, existingFiles);

        expect(result.isDuplicate).toBe(true);
        expect(result.duplicateFileId).toBe('file-009');
      });

      it('prefers content hash match over filename/size match', () => {
        const existingFiles = [
          {
            id: 'file-010',
            name: 'different_name.edi',
            size: 9999,
            rawContent: 'ISA*00*EXACT_MATCH_CONTENT~GS*HP~ST*834~SE*2~GE*1~IEA*1~',
          },
          {
            id: 'file-011',
            name: 'same_name.edi',
            size: 1024,
            rawContent: 'ISA*00*DIFFERENT_CONTENT~',
          },
        ];

        const newFile = {
          name: 'same_name.edi',
          size: 1024,
          rawContent: 'ISA*00*EXACT_MATCH_CONTENT~GS*HP~ST*834~SE*2~GE*1~IEA*1~',
        };

        const result = detectDuplicate(newFile, existingFiles);

        expect(result.isDuplicate).toBe(true);
        // Content hash match should find file-010 first
        expect(result.duplicateFileId).toBe('file-010');
      });
    });
  });

  describe('getFileExtension', () => {
    it('extracts .edi extension', () => {
      expect(getFileExtension('file.edi')).toBe('.edi');
    });

    it('extracts .x12 extension', () => {
      expect(getFileExtension('data.x12')).toBe('.x12');
    });

    it('extracts .834 extension', () => {
      expect(getFileExtension('members.834')).toBe('.834');
    });

    it('extracts .csv extension', () => {
      expect(getFileExtension('report.csv')).toBe('.csv');
    });

    it('extracts .txt extension', () => {
      expect(getFileExtension('data.txt')).toBe('.txt');
    });

    it('extracts .json extension', () => {
      expect(getFileExtension('config.json')).toBe('.json');
    });

    it('extracts .xml extension', () => {
      expect(getFileExtension('data.xml')).toBe('.xml');
    });

    it('returns lowercase extension for uppercase input', () => {
      expect(getFileExtension('FILE.EDI')).toBe('.edi');
    });

    it('returns lowercase extension for mixed case input', () => {
      expect(getFileExtension('Data.Csv')).toBe('.csv');
    });

    it('returns empty string for filename without extension', () => {
      expect(getFileExtension('noextension')).toBe('');
    });

    it('returns empty string for null input', () => {
      expect(getFileExtension(null)).toBe('');
    });

    it('returns empty string for undefined input', () => {
      expect(getFileExtension(undefined)).toBe('');
    });

    it('returns empty string for empty string input', () => {
      expect(getFileExtension('')).toBe('');
    });

    it('returns empty string for filename ending with dot', () => {
      expect(getFileExtension('file.')).toBe('');
    });

    it('handles filename with multiple dots', () => {
      expect(getFileExtension('my.file.name.edi')).toBe('.edi');
    });
  });

  describe('generateContentHash', () => {
    it('generates a non-empty hash for valid content', () => {
      const hash = generateContentHash('ISA*00*TEST~GS*HP~');

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('generates the same hash for identical content', () => {
      const content = 'ISA*00*IDENTICAL_CONTENT~GS*HP*SENDER~';
      const hash1 = generateContentHash(content);
      const hash2 = generateContentHash(content);

      expect(hash1).toBe(hash2);
    });

    it('generates different hashes for different content', () => {
      const hash1 = generateContentHash('ISA*00*CONTENT_A~');
      const hash2 = generateContentHash('ISA*00*CONTENT_B~');

      expect(hash1).not.toBe(hash2);
    });

    it('returns empty string for null input', () => {
      expect(generateContentHash(null)).toBe('');
    });

    it('returns empty string for undefined input', () => {
      expect(generateContentHash(undefined)).toBe('');
    });

    it('returns empty string for empty string input', () => {
      expect(generateContentHash('')).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(generateContentHash(12345)).toBe('');
    });

    it('generates a hash that includes length information', () => {
      const hash = generateContentHash('test content');

      expect(hash).toContain('-');
    });
  });

  describe('validateFileExtension', () => {
    it('returns valid for supported extensions', () => {
      SUPPORTED_FILE_EXTENSIONS.forEach((ext) => {
        const result = validateFileExtension(`file${ext}`);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    it('returns invalid for unsupported extension', () => {
      const result = validateFileExtension('file.pdf');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('.pdf');
    });

    it('returns invalid for null filename', () => {
      const result = validateFileExtension(null);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Filename');
    });

    it('returns invalid for empty filename', () => {
      const result = validateFileExtension('');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns invalid for filename without extension', () => {
      const result = validateFileExtension('noextension');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('no extension');
    });
  });

  describe('validateFileSize', () => {
    it('returns valid for a normal file size', () => {
      const result = validateFileSize(1024);

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns valid for file at maximum size', () => {
      const result = validateFileSize(MAX_FILE_SIZE_BYTES);

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns invalid for file exceeding maximum size', () => {
      const result = validateFileSize(MAX_FILE_SIZE_BYTES + 1);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('exceeds');
    });

    it('returns invalid for zero size', () => {
      const result = validateFileSize(0);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('returns invalid for negative size', () => {
      const result = validateFileSize(-100);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns invalid for null size', () => {
      const result = validateFileSize(null);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('returns invalid for undefined size', () => {
      const result = validateFileSize(undefined);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns invalid for non-number size', () => {
      const result = validateFileSize('1024');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateMimeType', () => {
    it('returns valid for text/plain', () => {
      const result = validateMimeType('text/plain');

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns valid for application/octet-stream', () => {
      const result = validateMimeType('application/octet-stream');

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns valid for application/json', () => {
      const result = validateMimeType('application/json');

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns valid for application/xml', () => {
      const result = validateMimeType('application/xml');

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns valid for text/xml', () => {
      const result = validateMimeType('text/xml');

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns valid for text/csv', () => {
      const result = validateMimeType('text/csv');

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns valid for empty string (no MIME type)', () => {
      const result = validateMimeType('');

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns valid for null (no MIME type)', () => {
      const result = validateMimeType(null);

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns valid for undefined (no MIME type)', () => {
      const result = validateMimeType(undefined);

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns invalid for unsupported MIME type', () => {
      const result = validateMimeType('application/pdf');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unsupported MIME type');
    });

    it('returns invalid for image MIME type', () => {
      const result = validateMimeType('image/png');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('handles case-insensitive MIME type comparison', () => {
      const result = validateMimeType('TEXT/PLAIN');

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('handles MIME type with leading/trailing whitespace', () => {
      const result = validateMimeType('  text/plain  ');

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('ALLOWED_MIME_TYPES', () => {
    it('is a frozen array', () => {
      expect(Object.isFrozen(ALLOWED_MIME_TYPES)).toBe(true);
    });

    it('includes text/plain', () => {
      expect(ALLOWED_MIME_TYPES).toContain('text/plain');
    });

    it('includes application/octet-stream', () => {
      expect(ALLOWED_MIME_TYPES).toContain('application/octet-stream');
    });

    it('includes application/json', () => {
      expect(ALLOWED_MIME_TYPES).toContain('application/json');
    });

    it('includes empty string for files with no MIME type', () => {
      expect(ALLOWED_MIME_TYPES).toContain('');
    });
  });
});