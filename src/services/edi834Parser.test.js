import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseEDI834,
  validateEDI834,
  generateSampleEDI834,
  detectSegmentTerminator,
  detectElementSeparator,
  splitSegments,
  parseSegment,
  getElement,
  parseEDIDate,
  calculateAge,
  validateEnvelope,
  groupMemberLoops,
  buildMemberFromLoop,
  RELATIONSHIP_CODES,
  GENDER_CODES,
  INSURANCE_LINE_CODES,
  MAINTENANCE_TYPE_CODES,
  DTP_QUALIFIERS,
} from './edi834Parser';

describe('edi834Parser', () => {
  describe('parseEDI834', () => {
    describe('with valid EDI content', () => {
      it('extracts the correct number of members from a single-member file', () => {
        const content = generateSampleEDI834({ memberCount: 1 });
        const result = parseEDI834(content);

        expect(result.success).toBe(true);
        expect(result.members).toHaveLength(1);
        expect(result.metadata.memberCount).toBe(1);
      });

      it('extracts the correct number of members from a multi-member file', () => {
        const content = generateSampleEDI834({ memberCount: 5 });
        const result = parseEDI834(content);

        expect(result.success).toBe(true);
        expect(result.members).toHaveLength(5);
        expect(result.metadata.memberCount).toBe(5);
      });

      it('extracts member demographics correctly', () => {
        const content = generateSampleEDI834({ memberCount: 1 });
        const result = parseEDI834(content);

        expect(result.success).toBe(true);
        expect(result.members).toHaveLength(1);

        const member = result.members[0];
        expect(member.demographics).toBeDefined();
        expect(member.demographics.gender).toBe('Male');
        expect(member.demographics.genderCode).toBe('M');
        expect(member.demographics.dateOfBirth).toBeDefined();
        expect(member.demographics.dateOfBirth).not.toBe('');
        expect(member.demographics.address).toBeDefined();
        expect(member.demographics.address.state).toBe('CA');
        expect(member.demographics.address.zipCode).toBe('90210');
        expect(member.demographics.address.city).toBe('ANYTOWN');
        expect(member.demographics.address.countryCode).toBe('US');
      });

      it('extracts member name data correctly', () => {
        const content = generateSampleEDI834({ memberCount: 1 });
        const result = parseEDI834(content);

        expect(result.success).toBe(true);
        const member = result.members[0];

        expect(member.firstName).toBeDefined();
        expect(member.firstName.length).toBeGreaterThan(0);
        expect(member.lastName).toBeDefined();
        expect(member.lastName.length).toBeGreaterThan(0);
        expect(member.memberId).toBeDefined();
        expect(member.memberId.length).toBeGreaterThan(0);
      });

      it('extracts coverage data correctly', () => {
        const content = generateSampleEDI834({ memberCount: 1 });
        const result = parseEDI834(content);

        expect(result.success).toBe(true);
        const member = result.members[0];

        expect(member.coverage).toBeDefined();
        expect(member.coverage.length).toBeGreaterThan(0);
        expect(member.coverageDetails).toBeDefined();
        expect(Array.isArray(member.coverageDetails)).toBe(true);
        expect(member.coverageDetails.length).toBeGreaterThan(0);

        const coverageDetail = member.coverageDetails[0];
        expect(coverageDetail.insuranceLineCode).toBe('HLT');
        expect(coverageDetail.insuranceLine).toBe('Health');
        expect(coverageDetail.planCoverageDescription).toBe('MEDICAID PLAN');
      });

      it('extracts effective date from DTP segments', () => {
        const content = generateSampleEDI834({ memberCount: 1 });
        const result = parseEDI834(content);

        expect(result.success).toBe(true);
        const member = result.members[0];

        expect(member.effectiveDate).toBeDefined();
        expect(member.effectiveDate).not.toBe('');
        expect(member.dates).toBeDefined();
        expect(Array.isArray(member.dates)).toBe(true);
        expect(member.dates.length).toBeGreaterThan(0);
      });

      it('extracts INS data correctly', () => {
        const content = generateSampleEDI834({ memberCount: 1 });
        const result = parseEDI834(content);

        expect(result.success).toBe(true);
        const member = result.members[0];

        expect(member.insData).toBeDefined();
        expect(member.insData.isSubscriber).toBe(true);
        expect(member.insData.subscriberIndicator).toBe('Y');
        expect(member.insData.relationship).toBe('Self');
        expect(member.insData.relationshipCode).toBe('18');
        expect(member.insData.maintenanceType).toBe('Addition');
        expect(member.insData.maintenanceTypeCode).toBe('021');
      });

      it('extracts REF data correctly', () => {
        const content = generateSampleEDI834({ memberCount: 1 });
        const result = parseEDI834(content);

        expect(result.success).toBe(true);
        const member = result.members[0];

        expect(member.references).toBeDefined();
        expect(member.references.subscriberNumber).toBeDefined();
        expect(member.references.subscriberNumber).toBe('SUB001');
        expect(member.references.groupPolicyNumber).toBeDefined();
      });

      it('extracts envelope data (ISA, GS, ST)', () => {
        const content = generateSampleEDI834({ memberCount: 1 });
        const result = parseEDI834(content);

        expect(result.envelope).toBeDefined();
        expect(result.envelope.isa).toBeDefined();
        expect(result.envelope.isa).not.toBeNull();
        expect(result.envelope.gs).toBeDefined();
        expect(result.envelope.gs).not.toBeNull();
        expect(result.envelope.st).toBeDefined();
        expect(result.envelope.st).not.toBeNull();
        expect(result.envelope.st.transactionSetIdCode).toBe('834');
      });

      it('populates metadata correctly', () => {
        const content = generateSampleEDI834({ memberCount: 3 });
        const result = parseEDI834(content);

        expect(result.metadata).toBeDefined();
        expect(result.metadata.totalSegments).toBeGreaterThan(0);
        expect(result.metadata.memberCount).toBe(3);
        expect(result.metadata.parsedAt).toBeDefined();
        expect(typeof result.metadata.parsedAt).toBe('string');
      });

      it('sets eligibility status to Pending for all parsed members', () => {
        const content = generateSampleEDI834({ memberCount: 3 });
        const result = parseEDI834(content);

        expect(result.success).toBe(true);
        result.members.forEach((member) => {
          expect(member.eligibilityStatus).toBe('Pending');
          expect(member.status).toBe('Pending');
        });
      });

      it('assigns unique IDs to each member', () => {
        const content = generateSampleEDI834({ memberCount: 5 });
        const result = parseEDI834(content);

        expect(result.success).toBe(true);
        const ids = result.members.map((m) => m.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(5);
      });

      it('extracts NM1 names data with member entity', () => {
        const content = generateSampleEDI834({ memberCount: 1 });
        const result = parseEDI834(content);

        expect(result.success).toBe(true);
        const member = result.members[0];

        expect(member.names).toBeDefined();
        expect(member.names.member).toBeDefined();
        expect(member.names.member.entityIdCode).toBe('IL');
        expect(member.names.member.entityTypeQualifier).toBe('1');
        expect(member.names.member.idCodeQualifier).toBe('34');
        expect(member.names.member.idCode).toBeDefined();
        expect(member.names.member.idCode.length).toBeGreaterThan(0);
      });

      it('calculates age from date of birth', () => {
        const content = generateSampleEDI834({ memberCount: 1 });
        const result = parseEDI834(content);

        expect(result.success).toBe(true);
        const member = result.members[0];

        expect(member.demographics.age).toBeDefined();
        expect(typeof member.demographics.age).toBe('number');
        expect(member.demographics.age).toBeGreaterThanOrEqual(0);
      });
    });

    describe('with malformed content', () => {
      it('returns errors for null input', () => {
        const result = parseEDI834(null);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.members).toHaveLength(0);
      });

      it('returns errors for undefined input', () => {
        const result = parseEDI834(undefined);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.members).toHaveLength(0);
      });

      it('returns errors for empty string input', () => {
        const result = parseEDI834('');

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.members).toHaveLength(0);
      });

      it('returns errors for whitespace-only input', () => {
        const result = parseEDI834('   \n\t  ');

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('returns errors for non-string input', () => {
        const result = parseEDI834(12345);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('returns errors for content missing ISA segment', () => {
        const content = 'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1~ST*834*0001~SE*2*0001~GE*1*1~IEA*1*000000001~';
        const result = parseEDI834(content);

        expect(result.errors.length).toBeGreaterThan(0);
        const hasIsaError = result.errors.some((e) => e.includes('ISA'));
        expect(hasIsaError).toBe(true);
      });

      it('returns errors for content missing GS segment', () => {
        const content = 'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:~ST*834*0001~SE*2*0001~IEA*1*000000001~';
        const result = parseEDI834(content);

        expect(result.errors.length).toBeGreaterThan(0);
        const hasGsError = result.errors.some((e) => e.includes('GS'));
        expect(hasGsError).toBe(true);
      });

      it('returns errors for content missing ST segment', () => {
        const content = 'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:~GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1~SE*2*0001~GE*1*1~IEA*1*000000001~';
        const result = parseEDI834(content);

        expect(result.errors.length).toBeGreaterThan(0);
        const hasStError = result.errors.some((e) => e.includes('ST'));
        expect(hasStError).toBe(true);
      });

      it('returns errors for content with no INS segments (no member data)', () => {
        const content = 'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:~GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1~ST*834*0001~SE*2*0001~GE*1*1~IEA*1*000000001~';
        const result = parseEDI834(content);

        expect(result.members).toHaveLength(0);
      });

      it('returns errors for random text content', () => {
        const content = 'This is not an EDI file at all. Just random text.';
        const result = parseEDI834(content);

        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('returns errors for content with mismatched ISA/IEA control numbers', () => {
        const content = [
          'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:',
          'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1',
          'ST*834*0001',
          'INS*Y*18*021**A***FT',
          'NM1*IL*1*DOE*JOHN*M***34*100000001',
          'SE*3*0001',
          'GE*1*1',
          'IEA*1*000000999',
        ].join('~') + '~';

        const result = parseEDI834(content);

        const hasMismatchError = result.errors.some((e) => e.includes('mismatch'));
        expect(hasMismatchError).toBe(true);
      });

      it('returns errors for wrong transaction set ID (not 834)', () => {
        const content = [
          'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:',
          'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1',
          'ST*837*0001',
          'INS*Y*18*021**A***FT',
          'NM1*IL*1*DOE*JOHN*M***34*100000001',
          'SE*3*0001',
          'GE*1*1',
          'IEA*1*000000001',
        ].join('~') + '~';

        const result = parseEDI834(content);

        const hasTransactionError = result.errors.some((e) => e.includes('834') || e.includes('837'));
        expect(hasTransactionError).toBe(true);
      });
    });

    describe('with partial content', () => {
      it('extracts members even with validation warnings', () => {
        const content = [
          'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:',
          'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1',
          'ST*834*0001',
          'INS*Y*18*021**A***FT',
          'NM1*IL*1*SMITH*JANE*A***34*200000001',
          'DMG*D8*19850315*F',
          'N3*456 OAK AVE',
          'N4*SPRINGFIELD*IL*62701*US',
          'HD*021**HLT*MEDICAID BASIC*EMP',
          'DTP*348*D8*20240101',
          'SE*8*0001',
          'GE*1*1',
          'IEA*1*000000001',
        ].join('~') + '~';

        const result = parseEDI834(content);

        expect(result.members.length).toBeGreaterThan(0);
        const member = result.members[0];
        expect(member.firstName).toBe('JANE');
        expect(member.lastName).toBe('SMITH');
        expect(member.demographics.gender).toBe('Female');
        expect(member.demographics.address.state).toBe('IL');
        expect(member.demographics.address.city).toBe('SPRINGFIELD');
      });

      it('handles members without DMG segment', () => {
        const content = [
          'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:',
          'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1',
          'ST*834*0001',
          'INS*Y*18*021**A***FT',
          'NM1*IL*1*JONES*BOB****34*300000001',
          'SE*3*0001',
          'GE*1*1',
          'IEA*1*000000001',
        ].join('~') + '~';

        const result = parseEDI834(content);

        expect(result.members.length).toBeGreaterThan(0);
        const member = result.members[0];
        expect(member.firstName).toBe('BOB');
        expect(member.lastName).toBe('JONES');
        expect(member.demographics.gender).toBe('');
        expect(member.demographics.dateOfBirth).toBe('');
      });

      it('handles members without address segments', () => {
        const content = [
          'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:',
          'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1',
          'ST*834*0001',
          'INS*Y*18*021**A***FT',
          'NM1*IL*1*WILLIAMS*ALICE****34*400000001',
          'DMG*D8*19950620*F',
          'SE*4*0001',
          'GE*1*1',
          'IEA*1*000000001',
        ].join('~') + '~';

        const result = parseEDI834(content);

        expect(result.members.length).toBeGreaterThan(0);
        const member = result.members[0];
        expect(member.demographics.address.line1).toBe('');
        expect(member.demographics.address.city).toBe('');
        expect(member.demographics.address.state).toBe('');
      });

      it('handles members without HD (coverage) segment', () => {
        const content = [
          'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:',
          'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1',
          'ST*834*0001',
          'INS*Y*18*021**A***FT',
          'NM1*IL*1*BROWN*CHARLIE****34*500000001',
          'SE*3*0001',
          'GE*1*1',
          'IEA*1*000000001',
        ].join('~') + '~';

        const result = parseEDI834(content);

        expect(result.members.length).toBeGreaterThan(0);
        const member = result.members[0];
        expect(member.coverage).toBe('');
        expect(member.coverageDetails).toHaveLength(0);
      });
    });
  });

  describe('validateEDI834', () => {
    it('returns valid for well-formed EDI 834 content', () => {
      const content = generateSampleEDI834({ memberCount: 1 });
      const result = validateEDI834(content);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.segmentCount).toBeGreaterThan(0);
    });

    it('returns errors for null input', () => {
      const result = validateEDI834(null);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns errors for empty string input', () => {
      const result = validateEDI834('');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns errors when ISA segment is missing', () => {
      const content = 'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1~ST*834*0001~SE*2*0001~GE*1*1~';
      const result = validateEDI834(content);

      expect(result.valid).toBe(false);
      const hasIsaError = result.errors.some((e) => e.includes('ISA'));
      expect(hasIsaError).toBe(true);
    });

    it('returns errors when no INS segments are found', () => {
      const content = [
        'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:',
        'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1',
        'ST*834*0001',
        'SE*2*0001',
        'GE*1*1',
        'IEA*1*000000001',
      ].join('~') + '~';

      const result = validateEDI834(content);

      expect(result.valid).toBe(false);
      const hasInsError = result.errors.some((e) => e.includes('INS'));
      expect(hasInsError).toBe(true);
    });

    it('returns segment count for valid content', () => {
      const content = generateSampleEDI834({ memberCount: 2 });
      const result = validateEDI834(content);

      expect(result.segmentCount).toBeGreaterThan(0);
    });
  });

  describe('generateSampleEDI834', () => {
    it('generates valid EDI 834 content with default member count', () => {
      const content = generateSampleEDI834();

      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
      expect(content.startsWith('ISA')).toBe(true);
      expect(content.includes('ST*834')).toBe(true);
    });

    it('generates content with the specified number of members', () => {
      const content = generateSampleEDI834({ memberCount: 3 });
      const result = parseEDI834(content);

      expect(result.success).toBe(true);
      expect(result.members).toHaveLength(3);
    });

    it('generates content with 1 member when memberCount is 1', () => {
      const content = generateSampleEDI834({ memberCount: 1 });
      const result = parseEDI834(content);

      expect(result.success).toBe(true);
      expect(result.members).toHaveLength(1);
    });

    it('defaults to 1 member when no options are provided', () => {
      const content = generateSampleEDI834();
      const result = parseEDI834(content);

      expect(result.success).toBe(true);
      expect(result.members).toHaveLength(1);
    });

    it('defaults to 1 member when memberCount is invalid', () => {
      const content = generateSampleEDI834({ memberCount: -5 });
      const result = parseEDI834(content);

      expect(result.success).toBe(true);
      expect(result.members).toHaveLength(1);
    });
  });

  describe('detectSegmentTerminator', () => {
    it('detects tilde (~) as segment terminator', () => {
      const content = 'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:~GS*HP~';
      const terminator = detectSegmentTerminator(content);

      expect(terminator).toBe('~');
    });

    it('returns default terminator for null input', () => {
      const terminator = detectSegmentTerminator(null);

      expect(terminator).toBe('~');
    });

    it('returns default terminator for empty string', () => {
      const terminator = detectSegmentTerminator('');

      expect(terminator).toBe('~');
    });

    it('detects newline as segment terminator when no tilde present', () => {
      const content = 'SOME*CONTENT\nANOTHER*LINE\n';
      const terminator = detectSegmentTerminator(content);

      expect(terminator).toBe('\n');
    });
  });

  describe('detectElementSeparator', () => {
    it('detects asterisk (*) as element separator', () => {
      const content = 'ISA*00*          *00*          *ZZ*SENDER~';
      const separator = detectElementSeparator(content);

      expect(separator).toBe('*');
    });

    it('returns default separator for null input', () => {
      const separator = detectElementSeparator(null);

      expect(separator).toBe('*');
    });

    it('returns default separator for empty string', () => {
      const separator = detectElementSeparator('');

      expect(separator).toBe('*');
    });

    it('detects separator from ISA segment position 3', () => {
      const content = 'ISA|00|          |00~';
      const separator = detectElementSeparator(content);

      expect(separator).toBe('|');
    });
  });

  describe('splitSegments', () => {
    it('splits content by tilde terminator', () => {
      const content = 'ISA*00~GS*HP~ST*834~';
      const segments = splitSegments(content, '~');

      expect(segments).toHaveLength(3);
      expect(segments[0]).toBe('ISA*00');
      expect(segments[1]).toBe('GS*HP');
      expect(segments[2]).toBe('ST*834');
    });

    it('filters out empty segments', () => {
      const content = 'ISA*00~~GS*HP~~~ST*834~';
      const segments = splitSegments(content, '~');

      expect(segments).toHaveLength(3);
    });

    it('returns empty array for null input', () => {
      const segments = splitSegments(null, '~');

      expect(segments).toHaveLength(0);
    });

    it('returns empty array for empty string', () => {
      const segments = splitSegments('', '~');

      expect(segments).toHaveLength(0);
    });

    it('trims whitespace from segments', () => {
      const content = '  ISA*00  ~  GS*HP  ~';
      const segments = splitSegments(content, '~');

      expect(segments[0]).toBe('ISA*00');
      expect(segments[1]).toBe('GS*HP');
    });
  });

  describe('parseSegment', () => {
    it('parses a segment into segmentId and elements', () => {
      const result = parseSegment('ISA*00*          *00', '*');

      expect(result.segmentId).toBe('ISA');
      expect(result.elements).toHaveLength(4);
      expect(result.elements[0]).toBe('ISA');
      expect(result.elements[1]).toBe('00');
    });

    it('returns empty segmentId for null input', () => {
      const result = parseSegment(null, '*');

      expect(result.segmentId).toBe('');
      expect(result.elements).toHaveLength(0);
    });

    it('returns empty segmentId for empty string', () => {
      const result = parseSegment('', '*');

      expect(result.segmentId).toBe('');
      expect(result.elements).toHaveLength(0);
    });

    it('handles segment with no elements', () => {
      const result = parseSegment('BGN', '*');

      expect(result.segmentId).toBe('BGN');
      expect(result.elements).toHaveLength(1);
    });
  });

  describe('getElement', () => {
    it('returns the element at the specified index', () => {
      const elements = ['ISA', '00', '          ', '00'];

      expect(getElement(elements, 0)).toBe('ISA');
      expect(getElement(elements, 1)).toBe('00');
    });

    it('returns empty string for out-of-bounds index', () => {
      const elements = ['ISA', '00'];

      expect(getElement(elements, 5)).toBe('');
      expect(getElement(elements, -1)).toBe('');
    });

    it('returns empty string for null elements array', () => {
      expect(getElement(null, 0)).toBe('');
    });

    it('trims whitespace from returned elements', () => {
      const elements = ['ISA', '  00  ', '  test  '];

      expect(getElement(elements, 1)).toBe('00');
      expect(getElement(elements, 2)).toBe('test');
    });
  });

  describe('parseEDIDate', () => {
    it('parses CCYYMMDD format to ISO date string', () => {
      const result = parseEDIDate('20240315');

      expect(result).toBe('2024-03-15');
    });

    it('parses another valid date', () => {
      const result = parseEDIDate('19900101');

      expect(result).toBe('1990-01-01');
    });

    it('returns empty string for null input', () => {
      expect(parseEDIDate(null)).toBe('');
    });

    it('returns empty string for empty string input', () => {
      expect(parseEDIDate('')).toBe('');
    });

    it('returns empty string for short date string', () => {
      expect(parseEDIDate('2024')).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(parseEDIDate(12345678)).toBe('');
    });
  });

  describe('calculateAge', () => {
    it('calculates age from ISO date string', () => {
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      const dobStr = tenYearsAgo.toISOString().split('T')[0];

      const age = calculateAge(dobStr);

      expect(age).toBe(10);
    });

    it('calculates age from EDI date format (CCYYMMDD)', () => {
      const twentyYearsAgo = new Date();
      twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
      twentyYearsAgo.setMonth(0);
      twentyYearsAgo.setDate(1);
      const year = String(twentyYearsAgo.getFullYear());
      const month = '01';
      const day = '01';
      const ediDate = `${year}${month}${day}`;

      const age = calculateAge(ediDate);

      expect(age).toBeGreaterThanOrEqual(19);
      expect(age).toBeLessThanOrEqual(20);
    });

    it('returns null for null input', () => {
      expect(calculateAge(null)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(calculateAge('')).toBeNull();
    });

    it('returns null for invalid date string', () => {
      expect(calculateAge('not-a-date')).toBeNull();
    });

    it('returns null for non-string input', () => {
      expect(calculateAge(12345)).toBeNull();
    });

    it('returns a non-negative age for a recent date of birth', () => {
      const recentDOB = '20200601';
      const age = calculateAge(recentDOB);

      expect(age).not.toBeNull();
      expect(age).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validateEnvelope', () => {
    it('returns valid for a complete envelope', () => {
      const content = generateSampleEDI834({ memberCount: 1 });
      const terminator = detectSegmentTerminator(content);
      const separator = detectElementSeparator(content);
      const rawSegments = splitSegments(content, terminator);
      const parsedSegments = rawSegments.map((seg) => parseSegment(seg, separator));

      const result = validateEnvelope(parsedSegments);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns errors when ISA is missing', () => {
      const parsedSegments = [
        { segmentId: 'GS', elements: ['GS', 'HP', 'SENDER', 'RECEIVER', '20240101', '1200', '1', 'X', '005010X220A1'] },
        { segmentId: 'ST', elements: ['ST', '834', '0001'] },
        { segmentId: 'SE', elements: ['SE', '2', '0001'] },
        { segmentId: 'GE', elements: ['GE', '1', '1'] },
        { segmentId: 'IEA', elements: ['IEA', '1', '000000001'] },
      ];

      const result = validateEnvelope(parsedSegments);

      expect(result.valid).toBe(false);
      const hasIsaError = result.errors.some((e) => e.includes('ISA'));
      expect(hasIsaError).toBe(true);
    });

    it('returns errors when IEA is missing', () => {
      const parsedSegments = [
        { segmentId: 'ISA', elements: ['ISA', '00', '          ', '00', '          ', 'ZZ', 'SENDER         ', 'ZZ', 'RECEIVER       ', '240101', '1200', '^', '00501', '000000001', '0', 'P', ':'] },
        { segmentId: 'GS', elements: ['GS', 'HP', 'SENDER', 'RECEIVER', '20240101', '1200', '1', 'X', '005010X220A1'] },
        { segmentId: 'ST', elements: ['ST', '834', '0001'] },
        { segmentId: 'SE', elements: ['SE', '2', '0001'] },
        { segmentId: 'GE', elements: ['GE', '1', '1'] },
      ];

      const result = validateEnvelope(parsedSegments);

      expect(result.valid).toBe(false);
      const hasIeaError = result.errors.some((e) => e.includes('IEA'));
      expect(hasIeaError).toBe(true);
    });

    it('returns errors when GS is missing', () => {
      const parsedSegments = [
        { segmentId: 'ISA', elements: ['ISA', '00', '          ', '00', '          ', 'ZZ', 'SENDER         ', 'ZZ', 'RECEIVER       ', '240101', '1200', '^', '00501', '000000001', '0', 'P', ':'] },
        { segmentId: 'ST', elements: ['ST', '834', '0001'] },
        { segmentId: 'SE', elements: ['SE', '2', '0001'] },
        { segmentId: 'GE', elements: ['GE', '1', '1'] },
        { segmentId: 'IEA', elements: ['IEA', '1', '000000001'] },
      ];

      const result = validateEnvelope(parsedSegments);

      expect(result.valid).toBe(false);
      const hasGsError = result.errors.some((e) => e.includes('GS'));
      expect(hasGsError).toBe(true);
    });

    it('returns errors when ST is missing', () => {
      const parsedSegments = [
        { segmentId: 'ISA', elements: ['ISA', '00', '          ', '00', '          ', 'ZZ', 'SENDER         ', 'ZZ', 'RECEIVER       ', '240101', '1200', '^', '00501', '000000001', '0', 'P', ':'] },
        { segmentId: 'GS', elements: ['GS', 'HP', 'SENDER', 'RECEIVER', '20240101', '1200', '1', 'X', '005010X220A1'] },
        { segmentId: 'SE', elements: ['SE', '2', '0001'] },
        { segmentId: 'GE', elements: ['GE', '1', '1'] },
        { segmentId: 'IEA', elements: ['IEA', '1', '000000001'] },
      ];

      const result = validateEnvelope(parsedSegments);

      expect(result.valid).toBe(false);
      const hasStError = result.errors.some((e) => e.includes('ST'));
      expect(hasStError).toBe(true);
    });

    it('detects ISA/IEA control number mismatch', () => {
      const parsedSegments = [
        { segmentId: 'ISA', elements: ['ISA', '00', '          ', '00', '          ', 'ZZ', 'SENDER         ', 'ZZ', 'RECEIVER       ', '240101', '1200', '^', '00501', '000000001', '0', 'P', ':'] },
        { segmentId: 'GS', elements: ['GS', 'HP', 'SENDER', 'RECEIVER', '20240101', '1200', '1', 'X', '005010X220A1'] },
        { segmentId: 'ST', elements: ['ST', '834', '0001'] },
        { segmentId: 'SE', elements: ['SE', '2', '0001'] },
        { segmentId: 'GE', elements: ['GE', '1', '1'] },
        { segmentId: 'IEA', elements: ['IEA', '1', '000000999'] },
      ];

      const result = validateEnvelope(parsedSegments);

      expect(result.valid).toBe(false);
      const hasMismatchError = result.errors.some((e) => e.includes('mismatch'));
      expect(hasMismatchError).toBe(true);
    });

    it('detects wrong transaction set ID', () => {
      const parsedSegments = [
        { segmentId: 'ISA', elements: ['ISA', '00', '          ', '00', '          ', 'ZZ', 'SENDER         ', 'ZZ', 'RECEIVER       ', '240101', '1200', '^', '00501', '000000001', '0', 'P', ':'] },
        { segmentId: 'GS', elements: ['GS', 'HP', 'SENDER', 'RECEIVER', '20240101', '1200', '1', 'X', '005010X220A1'] },
        { segmentId: 'ST', elements: ['ST', '837', '0001'] },
        { segmentId: 'SE', elements: ['SE', '2', '0001'] },
        { segmentId: 'GE', elements: ['GE', '1', '1'] },
        { segmentId: 'IEA', elements: ['IEA', '1', '000000001'] },
      ];

      const result = validateEnvelope(parsedSegments);

      expect(result.valid).toBe(false);
      const hasTransactionError = result.errors.some((e) => e.includes('834') || e.includes('837'));
      expect(hasTransactionError).toBe(true);
    });
  });

  describe('groupMemberLoops', () => {
    it('groups segments into member loops based on INS boundaries', () => {
      const parsedSegments = [
        { segmentId: 'ISA', elements: ['ISA'] },
        { segmentId: 'GS', elements: ['GS'] },
        { segmentId: 'ST', elements: ['ST', '834', '0001'] },
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN'] },
        { segmentId: 'DMG', elements: ['DMG', 'D8', '19900101', 'M'] },
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'SMITH', 'JANE'] },
        { segmentId: 'DMG', elements: ['DMG', 'D8', '19850315', 'F'] },
        { segmentId: 'SE', elements: ['SE', '7', '0001'] },
        { segmentId: 'GE', elements: ['GE', '1', '1'] },
        { segmentId: 'IEA', elements: ['IEA', '1', '000000001'] },
      ];

      const loops = groupMemberLoops(parsedSegments);

      expect(loops).toHaveLength(2);
      expect(loops[0]).toHaveLength(3); // INS, NM1, DMG
      expect(loops[1]).toHaveLength(3); // INS, NM1, DMG
      expect(loops[0][0].segmentId).toBe('INS');
      expect(loops[1][0].segmentId).toBe('INS');
    });

    it('returns empty array when no INS segments exist', () => {
      const parsedSegments = [
        { segmentId: 'ISA', elements: ['ISA'] },
        { segmentId: 'GS', elements: ['GS'] },
        { segmentId: 'ST', elements: ['ST', '834', '0001'] },
        { segmentId: 'SE', elements: ['SE', '2', '0001'] },
        { segmentId: 'GE', elements: ['GE', '1', '1'] },
        { segmentId: 'IEA', elements: ['IEA', '1', '000000001'] },
      ];

      const loops = groupMemberLoops(parsedSegments);

      expect(loops).toHaveLength(0);
    });

    it('excludes envelope segments from member loops', () => {
      const parsedSegments = [
        { segmentId: 'ISA', elements: ['ISA'] },
        { segmentId: 'GS', elements: ['GS'] },
        { segmentId: 'ST', elements: ['ST', '834', '0001'] },
        { segmentId: 'BGN', elements: ['BGN', '00', '12345'] },
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN'] },
        { segmentId: 'SE', elements: ['SE', '4', '0001'] },
        { segmentId: 'GE', elements: ['GE', '1', '1'] },
        { segmentId: 'IEA', elements: ['IEA', '1', '000000001'] },
      ];

      const loops = groupMemberLoops(parsedSegments);

      expect(loops).toHaveLength(1);
      expect(loops[0]).toHaveLength(2); // INS, NM1 only
      const segmentIds = loops[0].map((s) => s.segmentId);
      expect(segmentIds).not.toContain('ISA');
      expect(segmentIds).not.toContain('GS');
      expect(segmentIds).not.toContain('ST');
      expect(segmentIds).not.toContain('SE');
      expect(segmentIds).not.toContain('GE');
      expect(segmentIds).not.toContain('IEA');
      expect(segmentIds).not.toContain('BGN');
    });
  });

  describe('buildMemberFromLoop', () => {
    it('builds a member object from a complete loop', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021', '', 'A', '', '', 'FT'] },
        { segmentId: 'REF', elements: ['REF', '0F', 'SUB001'] },
        { segmentId: 'REF', elements: ['REF', '1L', 'GRP001'] },
        { segmentId: 'DTP', elements: ['DTP', '356', 'D8', '20240101'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'JOHNSON', 'MICHAEL', 'A', '', '', '34', '123456789'] },
        { segmentId: 'N3', elements: ['N3', '789 PINE RD', 'SUITE 100'] },
        { segmentId: 'N4', elements: ['N4', 'DENVER', 'CO', '80201', 'US'] },
        { segmentId: 'DMG', elements: ['DMG', 'D8', '19880520', 'M'] },
        { segmentId: 'HD', elements: ['HD', '021', '', 'HLT', 'MEDICAID PLUS', 'EMP'] },
        { segmentId: 'DTP', elements: ['DTP', '348', 'D8', '20240101'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member).toBeDefined();
      expect(member.id).toBeDefined();
      expect(member.firstName).toBe('MICHAEL');
      expect(member.lastName).toBe('JOHNSON');
      expect(member.middleName).toBe('A');
      expect(member.memberId).toBe('123456789');

      expect(member.demographics.gender).toBe('Male');
      expect(member.demographics.genderCode).toBe('M');
      expect(member.demographics.dateOfBirth).toBe('1988-05-20');
      expect(member.demographics.age).not.toBeNull();
      expect(member.demographics.address.line1).toBe('789 PINE RD');
      expect(member.demographics.address.line2).toBe('SUITE 100');
      expect(member.demographics.address.city).toBe('DENVER');
      expect(member.demographics.address.state).toBe('CO');
      expect(member.demographics.address.zipCode).toBe('80201');
      expect(member.demographics.address.countryCode).toBe('US');

      expect(member.coverage).toContain('Health');
      expect(member.coverage).toContain('MEDICAID PLUS');
      expect(member.coverageDetails).toHaveLength(1);
      expect(member.coverageDetails[0].insuranceLineCode).toBe('HLT');
      expect(member.coverageDetails[0].planCoverageDescription).toBe('MEDICAID PLUS');

      expect(member.effectiveDate).toBe('2024-01-01');

      expect(member.insData.isSubscriber).toBe(true);
      expect(member.insData.relationship).toBe('Self');
      expect(member.insData.maintenanceType).toBe('Addition');

      expect(member.references.subscriberNumber).toBe('SUB001');
      expect(member.references.groupPolicyNumber).toBe('GRP001');

      expect(member.names.member).toBeDefined();
      expect(member.names.member.entityIdCode).toBe('IL');

      expect(member.eligibilityStatus).toBe('Pending');
      expect(member.status).toBe('Pending');
    });

    it('builds a member with minimal data (INS only)', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'N', '01', '024'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member).toBeDefined();
      expect(member.id).toBeDefined();
      expect(member.insData.isSubscriber).toBe(false);
      expect(member.insData.subscriberIndicator).toBe('N');
      expect(member.insData.relationshipCode).toBe('01');
      expect(member.insData.relationship).toBe('Spouse');
      expect(member.firstName).toBe('');
      expect(member.lastName).toBe('');
      expect(member.demographics.gender).toBe('');
      expect(member.coverage).toBe('');
    });

    it('handles multiple HD segments', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '999999999'] },
        { segmentId: 'HD', elements: ['HD', '021', '', 'HLT', 'MEDICAID STANDARD', 'EMP'] },
        { segmentId: 'HD', elements: ['HD', '021', '', 'DEN', 'DENTAL PLAN', 'EMP'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.coverageDetails).toHaveLength(2);
      expect(member.coverageDetails[0].insuranceLineCode).toBe('HLT');
      expect(member.coverageDetails[1].insuranceLineCode).toBe('DEN');
      expect(member.coverage).toContain('Health');
      expect(member.coverage).toContain('Dental');
    });

    it('handles multiple DTP segments', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '999999999'] },
        { segmentId: 'DTP', elements: ['DTP', '356', 'D8', '20240101'] },
        { segmentId: 'DTP', elements: ['DTP', '357', 'D8', '20241231'] },
        { segmentId: 'DTP', elements: ['DTP', '303', 'D8', '20240115'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.dates).toHaveLength(3);
      expect(member.effectiveDate).toBe('2024-01-01');
      expect(member.terminationDate).toBe('2024-12-31');
    });
  });

  describe('constant mappings', () => {
    it('RELATIONSHIP_CODES contains expected mappings', () => {
      expect(RELATIONSHIP_CODES['18']).toBe('Self');
      expect(RELATIONSHIP_CODES['01']).toBe('Spouse');
      expect(RELATIONSHIP_CODES['19']).toBe('Child');
    });

    it('GENDER_CODES contains expected mappings', () => {
      expect(GENDER_CODES['M']).toBe('Male');
      expect(GENDER_CODES['F']).toBe('Female');
      expect(GENDER_CODES['U']).toBe('Unknown');
    });

    it('INSURANCE_LINE_CODES contains expected mappings', () => {
      expect(INSURANCE_LINE_CODES['HLT']).toBe('Health');
      expect(INSURANCE_LINE_CODES['DEN']).toBe('Dental');
      expect(INSURANCE_LINE_CODES['VIS']).toBe('Vision');
    });

    it('MAINTENANCE_TYPE_CODES contains expected mappings', () => {
      expect(MAINTENANCE_TYPE_CODES['001']).toBe('Change');
      expect(MAINTENANCE_TYPE_CODES['021']).toBe('Addition');
      expect(MAINTENANCE_TYPE_CODES['024']).toBe('Cancellation or Termination');
    });

    it('DTP_QUALIFIERS contains expected mappings', () => {
      expect(DTP_QUALIFIERS['356']).toBe('Eligibility Begin');
      expect(DTP_QUALIFIERS['357']).toBe('Eligibility End');
      expect(DTP_QUALIFIERS['348']).toBe('Benefit');
      expect(DTP_QUALIFIERS['303']).toBe('Maintenance Effective');
    });
  });

  describe('ISA segment parsing', () => {
    it('extracts ISA envelope data from parsed content', () => {
      const content = generateSampleEDI834({ memberCount: 1 });
      const result = parseEDI834(content);

      expect(result.envelope.isa).not.toBeNull();
      expect(result.envelope.isa.senderId).toBeDefined();
      expect(result.envelope.isa.receiverId).toBeDefined();
      expect(result.envelope.isa.controlNumber).toBeDefined();
      expect(result.envelope.isa.controlVersionNumber).toBeDefined();
    });
  });

  describe('GS segment parsing', () => {
    it('extracts GS envelope data from parsed content', () => {
      const content = generateSampleEDI834({ memberCount: 1 });
      const result = parseEDI834(content);

      expect(result.envelope.gs).not.toBeNull();
      expect(result.envelope.gs.functionalIdCode).toBe('HP');
      expect(result.envelope.gs.applicationSenderCode).toBeDefined();
      expect(result.envelope.gs.applicationReceiverCode).toBeDefined();
      expect(result.envelope.gs.groupControlNumber).toBeDefined();
    });
  });

  describe('ST segment parsing', () => {
    it('extracts ST envelope data from parsed content', () => {
      const content = generateSampleEDI834({ memberCount: 1 });
      const result = parseEDI834(content);

      expect(result.envelope.st).not.toBeNull();
      expect(result.envelope.st.transactionSetIdCode).toBe('834');
      expect(result.envelope.st.transactionSetControlNumber).toBeDefined();
    });
  });

  describe('INS segment parsing', () => {
    it('parses subscriber indicator correctly', () => {
      const content = generateSampleEDI834({ memberCount: 1 });
      const result = parseEDI834(content);

      expect(result.members[0].insData.subscriberIndicator).toBe('Y');
      expect(result.members[0].insData.isSubscriber).toBe(true);
    });

    it('parses relationship code correctly', () => {
      const content = generateSampleEDI834({ memberCount: 1 });
      const result = parseEDI834(content);

      expect(result.members[0].insData.relationshipCode).toBe('18');
      expect(result.members[0].insData.relationship).toBe('Self');
    });

    it('parses maintenance type code correctly', () => {
      const content = generateSampleEDI834({ memberCount: 1 });
      const result = parseEDI834(content);

      expect(result.members[0].insData.maintenanceTypeCode).toBe('021');
      expect(result.members[0].insData.maintenanceType).toBe('Addition');
    });
  });

  describe('DMG segment parsing', () => {
    it('parses date of birth correctly', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'TEST', 'USER', '', '', '', '34', '111111111'] },
        { segmentId: 'DMG', elements: ['DMG', 'D8', '19950315', 'F'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.demographics.dateOfBirth).toBe('1995-03-15');
      expect(member.demographics.rawDateOfBirth).toBe('19950315');
    });

    it('parses gender code correctly', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'TEST', 'USER', '', '', '', '34', '111111111'] },
        { segmentId: 'DMG', elements: ['DMG', 'D8', '19950315', 'F'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.demographics.genderCode).toBe('F');
      expect(member.demographics.gender).toBe('Female');
    });

    it('parses marital status code when present', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'TEST', 'USER', '', '', '', '34', '111111111'] },
        { segmentId: 'DMG', elements: ['DMG', 'D8', '19950315', 'M', 'S'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.demographics.maritalStatusCode).toBe('S');
    });

    it('parses citizenship status code when present', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'TEST', 'USER', '', '', '', '34', '111111111'] },
        { segmentId: 'DMG', elements: ['DMG', 'D8', '19950315', 'M', '', '', '1'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.demographics.citizenshipStatusCode).toBe('1');
    });
  });

  describe('NM1 segment parsing', () => {
    it('parses member name (IL entity) correctly', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'GARCIA', 'MARIA', 'L', 'MS', '', '34', '222333444'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.firstName).toBe('MARIA');
      expect(member.lastName).toBe('GARCIA');
      expect(member.middleName).toBe('L');
      expect(member.names.member.prefix).toBe('MS');
      expect(member.names.member.idCode).toBe('222333444');
    });

    it('handles multiple NM1 segments with different entity codes', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111222333'] },
        { segmentId: 'NM1', elements: ['NM1', '36', '2', 'ACME CORP', '', '', '', '', '', ''] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.names.member).toBeDefined();
      expect(member.names.member.lastName).toBe('DOE');
      expect(member.names.employer).toBeDefined();
      expect(member.names.employer.lastName).toBe('ACME CORP');
    });

    it('uses idCode from NM1 as memberId', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'SMITH', 'JANE', '', '', '', '34', '987654321'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.memberId).toBe('987654321');
    });
  });

  describe('HD segment parsing', () => {
    it('parses health coverage data correctly', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111111111'] },
        { segmentId: 'HD', elements: ['HD', '021', '', 'HLT', 'MEDICAID STANDARD', 'EMP'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.coverageDetails).toHaveLength(1);
      expect(member.coverageDetails[0].maintenanceTypeCode).toBe('021');
      expect(member.coverageDetails[0].maintenanceType).toBe('Addition');
      expect(member.coverageDetails[0].insuranceLineCode).toBe('HLT');
      expect(member.coverageDetails[0].insuranceLine).toBe('Health');
      expect(member.coverageDetails[0].planCoverageDescription).toBe('MEDICAID STANDARD');
      expect(member.coverageDetails[0].coverageLevelCode).toBe('EMP');
    });

    it('builds coverage description string from HD data', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111111111'] },
        { segmentId: 'HD', elements: ['HD', '021', '', 'DEN', 'DENTAL BASIC', 'EMP'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.coverage).toContain('Dental');
      expect(member.coverage).toContain('DENTAL BASIC');
    });

    it('handles HD segment with unknown insurance line code', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111111111'] },
        { segmentId: 'HD', elements: ['HD', '021', '', 'XYZ', 'CUSTOM PLAN', 'EMP'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.coverageDetails).toHaveLength(1);
      expect(member.coverageDetails[0].insuranceLineCode).toBe('XYZ');
      expect(member.coverageDetails[0].insuranceLine).toBe('XYZ');
    });
  });

  describe('DTP segment parsing', () => {
    it('parses D8 format date correctly', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111111111'] },
        { segmentId: 'DTP', elements: ['DTP', '356', 'D8', '20240315'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.dates).toHaveLength(1);
      expect(member.dates[0].qualifier).toBe('356');
      expect(member.dates[0].qualifierDescription).toBe('Eligibility Begin');
      expect(member.dates[0].formatQualifier).toBe('D8');
      expect(member.dates[0].date).toBe('2024-03-15');
      expect(member.dates[0].rawDate).toBe('20240315');
    });

    it('parses RD8 format date range correctly', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111111111'] },
        { segmentId: 'DTP', elements: ['DTP', '348', 'RD8', '20240101-20241231'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.dates).toHaveLength(1);
      expect(member.dates[0].qualifier).toBe('348');
      expect(member.dates[0].formatQualifier).toBe('RD8');
      expect(member.dates[0].startDate).toBe('2024-01-01');
      expect(member.dates[0].endDate).toBe('2024-12-31');
    });

    it('extracts effective date from eligibility begin DTP', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111111111'] },
        { segmentId: 'DTP', elements: ['DTP', '356', 'D8', '20240601'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.effectiveDate).toBe('2024-06-01');
    });

    it('extracts termination date from eligibility end DTP', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111111111'] },
        { segmentId: 'DTP', elements: ['DTP', '356', 'D8', '20240101'] },
        { segmentId: 'DTP', elements: ['DTP', '357', 'D8', '20241231'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.effectiveDate).toBe('2024-01-01');
      expect(member.terminationDate).toBe('2024-12-31');
    });

    it('uses maintenance effective date as fallback for effective date', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111111111'] },
        { segmentId: 'DTP', elements: ['DTP', '303', 'D8', '20240201'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.effectiveDate).toBe('2024-02-01');
    });

    it('maps DTP qualifier descriptions correctly', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111111111'] },
        { segmentId: 'DTP', elements: ['DTP', '338', 'D8', '20240101'] },
        { segmentId: 'DTP', elements: ['DTP', '339', 'D8', '20241231'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.dates).toHaveLength(2);
      expect(member.dates[0].qualifierDescription).toBe('Benefit Begin');
      expect(member.dates[1].qualifierDescription).toBe('Benefit End');
    });
  });

  describe('ICM segment parsing', () => {
    it('extracts income data from ICM segment', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111111111'] },
        { segmentId: 'ICM', elements: ['ICM', 'A', '35000.00', '40', ''] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.income).toBe(35000.00);
    });

    it('handles missing ICM segment gracefully', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111111111'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.income).toBeNull();
    });
  });

  describe('REF segment parsing', () => {
    it('extracts subscriber number from REF 0F', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'REF', elements: ['REF', '0F', 'SUB123456'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111111111'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.references.subscriberNumber).toBe('SUB123456');
    });

    it('extracts group policy number from REF 1L', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'REF', elements: ['REF', '1L', 'GRP789'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111111111'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.references.groupPolicyNumber).toBe('GRP789');
    });

    it('uses subscriber number as memberId fallback when NM1 idCode is missing', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'REF', elements: ['REF', '0F', 'FALLBACK_ID'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.memberId).toBe('FALLBACK_ID');
    });

    it('handles multiple REF segments', () => {
      const loopSegments = [
        { segmentId: 'INS', elements: ['INS', 'Y', '18', '021'] },
        { segmentId: 'REF', elements: ['REF', '0F', 'SUB001'] },
        { segmentId: 'REF', elements: ['REF', '1L', 'GRP001'] },
        { segmentId: 'REF', elements: ['REF', '23', 'CLIENT001'] },
        { segmentId: 'NM1', elements: ['NM1', 'IL', '1', 'DOE', 'JOHN', '', '', '', '34', '111111111'] },
      ];

      const member = buildMemberFromLoop(loopSegments, ':');

      expect(member.references.subscriberNumber).toBe('SUB001');
      expect(member.references.groupPolicyNumber).toBe('GRP001');
      expect(member.references.clientNumber).toBe('CLIENT001');
    });
  });

  describe('end-to-end parsing with multiple members', () => {
    it('correctly parses a file with multiple members having different data', () => {
      const content = [
        'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:',
        'GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1',
        'ST*834*0001*005010X220A1',
        'BGN*00*12345*20240101*1200****2',
        'INS*Y*18*021**A***FT',
        'REF*0F*SUB001',
        'DTP*356*D8*20240101',
        'NM1*IL*1*SMITH*JOHN*A***34*100000001',
        'N3*100 MAIN ST',
        'N4*LOS ANGELES*CA*90001*US',
        'DMG*D8*19900115*M',
        'HD*021**HLT*MEDICAID STANDARD*EMP',
        'DTP*348*D8*20240101',
        'INS*Y*18*021**A***FT',
        'REF*0F*SUB002',
        'DTP*356*D8*20240201',
        'NM1*IL*1*JOHNSON*MARY*B***34*200000002',
        'N3*200 OAK AVE',
        'N4*NEW YORK*NY*10001*US',
        'DMG*D8*19850620*F',
        'HD*021**HLT*MEDICAID PLUS*EMP',
        'DTP*348*D8*20240201',
        'INS*Y*18*021**A***FT',
        'REF*0F*SUB003',
        'DTP*356*D8*20240301',
        'NM1*IL*1*WILLIAMS*ROBERT****34*300000003',
        'N3*300 ELM ST',
        'N4*CHICAGO*IL*60601*US',
        'DMG*D8*20000101*M',
        'HD*021**DEN*DENTAL PLAN*EMP',
        'DTP*348*D8*20240301',
        'SE*28*0001',
        'GE*1*1',
        'IEA*1*000000001',
      ].join('~') + '~';

      const result = parseEDI834(content);

      expect(result.success).toBe(true);
      expect(result.members).toHaveLength(3);

      // First member
      expect(result.members[0].firstName).toBe('JOHN');
      expect(result.members[0].lastName).toBe('SMITH');
      expect(result.members[0].demographics.gender).toBe('Male');
      expect(result.members[0].demographics.address.state).toBe('CA');
      expect(result.members[0].demographics.address.city).toBe('LOS ANGELES');
      expect(result.members[0].coverageDetails[0].insuranceLine).toBe('Health');

      // Second member
      expect(result.members[1].firstName).toBe('MARY');
      expect(result.members[1].lastName).toBe('JOHNSON');
      expect(result.members[1].demographics.gender).toBe('Female');
      expect(result.members[1].demographics.address.state).toBe('NY');
      expect(result.members[1].coverageDetails[0].planCoverageDescription).toBe('MEDICAID PLUS');

      // Third member
      expect(result.members[2].firstName).toBe('ROBERT');
      expect(result.members[2].lastName).toBe('WILLIAMS');
      expect(result.members[2].demographics.gender).toBe('Male');
      expect(result.members[2].demographics.address.state).toBe('IL');
      expect(result.members[2].coverageDetails[0].insuranceLine).toBe('Dental');
    });
  });
});