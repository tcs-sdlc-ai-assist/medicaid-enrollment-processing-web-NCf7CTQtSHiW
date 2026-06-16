import { v4 as uuidv4 } from 'uuid';
import { EDI_SEGMENT_TERMINATORS } from '../utils/constants';

/**
 * Default segment terminator character.
 * @type {string}
 */
const DEFAULT_SEGMENT_TERMINATOR = EDI_SEGMENT_TERMINATORS.SEGMENT;

/**
 * Default element separator character.
 * @type {string}
 */
const DEFAULT_ELEMENT_SEPARATOR = EDI_SEGMENT_TERMINATORS.ELEMENT;

/**
 * Default sub-element separator character.
 * @type {string}
 */
const DEFAULT_SUB_ELEMENT_SEPARATOR = EDI_SEGMENT_TERMINATORS.SUB_ELEMENT;

/**
 * Relationship code mappings for INS segment (INS03).
 * @type {Object<string, string>}
 */
const RELATIONSHIP_CODES = Object.freeze({
  '18': 'Self',
  '01': 'Spouse',
  '19': 'Child',
  '20': 'Employee',
  '21': 'Unknown',
  '39': 'Organ Donor',
  '40': 'Cadaver Donor',
  '53': 'Life Partner',
  'G8': 'Other Relationship',
});

/**
 * Gender code mappings for DMG segment (DMG03).
 * @type {Object<string, string>}
 */
const GENDER_CODES = Object.freeze({
  'M': 'Male',
  'F': 'Female',
  'U': 'Unknown',
});

/**
 * Insurance line code mappings for HD segment (HD03).
 * @type {Object<string, string>}
 */
const INSURANCE_LINE_CODES = Object.freeze({
  'HLT': 'Health',
  'DEN': 'Dental',
  'VIS': 'Vision',
  'HMO': 'HMO',
  'PPO': 'PPO',
  'POS': 'POS',
  'EPO': 'EPO',
  'AG': 'Ambulance',
  'AH': 'Allied Health',
  'AK': 'Chiropractic',
});

/**
 * Maintenance type code mappings for INS segment (INS03).
 * @type {Object<string, string>}
 */
const MAINTENANCE_TYPE_CODES = Object.freeze({
  '001': 'Change',
  '021': 'Addition',
  '024': 'Cancellation or Termination',
  '025': 'Reinstatement',
  '030': 'Audit or Compare',
});

/**
 * DTP date/time qualifier mappings.
 * @type {Object<string, string>}
 */
const DTP_QUALIFIERS = Object.freeze({
  '336': 'Employment Begin',
  '337': 'Employment End',
  '338': 'Benefit Begin',
  '339': 'Benefit End',
  '340': 'COBRA Begin',
  '341': 'COBRA End',
  '348': 'Benefit',
  '349': 'Benefit End',
  '356': 'Eligibility Begin',
  '357': 'Eligibility End',
  '303': 'Maintenance Effective',
  '394': 'Initial Disability Period Start',
  '473': 'Member Level Dates',
});

/**
 * Detects the segment terminator used in the raw EDI content.
 * Checks for standard '~' terminator, newline-based, or other common terminators.
 * @param {string} rawContent - The raw EDI content string.
 * @returns {string} The detected segment terminator.
 */
function detectSegmentTerminator(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    return DEFAULT_SEGMENT_TERMINATOR;
  }

  // Check if ISA segment exists (standard EDI 834 starts with ISA)
  // The segment terminator is typically the character at position 105 in the ISA segment
  if (rawContent.startsWith('ISA') && rawContent.length > 105) {
    const possibleTerminator = rawContent.charAt(105);
    if (possibleTerminator === '~' || possibleTerminator === '\n' || possibleTerminator === '\r') {
      return possibleTerminator;
    }
  }

  // Check for common terminators
  if (rawContent.includes('~')) {
    return '~';
  }

  if (rawContent.includes('\n')) {
    return '\n';
  }

  return DEFAULT_SEGMENT_TERMINATOR;
}

/**
 * Detects the element separator used in the raw EDI content.
 * @param {string} rawContent - The raw EDI content string.
 * @returns {string} The detected element separator.
 */
function detectElementSeparator(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    return DEFAULT_ELEMENT_SEPARATOR;
  }

  // In standard EDI, the element separator is the 4th character (position 3)
  if (rawContent.startsWith('ISA') && rawContent.length > 3) {
    return rawContent.charAt(3);
  }

  if (rawContent.includes('*')) {
    return '*';
  }

  return DEFAULT_ELEMENT_SEPARATOR;
}

/**
 * Detects the sub-element separator used in the raw EDI content.
 * @param {string} rawContent - The raw EDI content string.
 * @param {string} elementSeparator - The detected element separator.
 * @param {string} segmentTerminator - The detected segment terminator.
 * @returns {string} The detected sub-element separator.
 */
function detectSubElementSeparator(rawContent, elementSeparator, segmentTerminator) {
  if (!rawContent || typeof rawContent !== 'string') {
    return DEFAULT_SUB_ELEMENT_SEPARATOR;
  }

  // In standard EDI 834, the sub-element separator is in the ISA16 element
  // ISA has 16 elements; the sub-element separator is the last element value before the segment terminator
  if (rawContent.startsWith('ISA')) {
    const isaEnd = rawContent.indexOf(segmentTerminator);
    if (isaEnd > 0) {
      const isaSegment = rawContent.substring(0, isaEnd);
      const elements = isaSegment.split(elementSeparator);
      if (elements.length >= 17) {
        const subElSep = elements[16];
        if (subElSep && subElSep.length > 0) {
          return subElSep.charAt(0);
        }
      }
    }
  }

  if (rawContent.includes(':')) {
    return ':';
  }

  return DEFAULT_SUB_ELEMENT_SEPARATOR;
}

/**
 * Splits raw EDI content into an array of segment strings.
 * Removes empty segments and trims whitespace.
 * @param {string} rawContent - The raw EDI content string.
 * @param {string} segmentTerminator - The segment terminator character.
 * @returns {Array<string>} An array of segment strings.
 */
function splitSegments(rawContent, segmentTerminator) {
  if (!rawContent || typeof rawContent !== 'string') {
    return [];
  }

  // Normalize line endings
  let content = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split by segment terminator
  let segments = content.split(segmentTerminator);

  // If the terminator is not newline, also handle newlines within segments
  if (segmentTerminator !== '\n') {
    segments = segments.map((seg) => seg.replace(/\n/g, '').trim());
  } else {
    segments = segments.map((seg) => seg.trim());
  }

  // Filter out empty segments
  return segments.filter((seg) => seg.length > 0);
}

/**
 * Parses a single segment string into its element components.
 * @param {string} segment - The segment string.
 * @param {string} elementSeparator - The element separator character.
 * @returns {{ segmentId: string, elements: Array<string> }} The parsed segment.
 */
function parseSegment(segment, elementSeparator) {
  if (!segment || typeof segment !== 'string') {
    return { segmentId: '', elements: [] };
  }

  const elements = segment.split(elementSeparator);
  const segmentId = elements[0] || '';

  return {
    segmentId: segmentId.trim(),
    elements,
  };
}

/**
 * Safely retrieves an element from a parsed segment's elements array.
 * @param {Array<string>} elements - The segment elements.
 * @param {number} index - The zero-based index of the element.
 * @returns {string} The element value, or empty string if not found.
 */
function getElement(elements, index) {
  if (!Array.isArray(elements) || index < 0 || index >= elements.length) {
    return '';
  }
  return (elements[index] || '').trim();
}

/**
 * Parses a date string in EDI format (CCYYMMDD) to ISO date string.
 * @param {string} dateStr - The date string in CCYYMMDD format.
 * @returns {string} The ISO date string (YYYY-MM-DD), or empty string if invalid.
 */
function parseEDIDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.length < 8) {
    return '';
  }

  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);

  const parsed = new Date(`${year}-${month}-${day}`);
  if (isNaN(parsed.getTime())) {
    return '';
  }

  return `${year}-${month}-${day}`;
}

/**
 * Calculates age from a date of birth string.
 * @param {string} dob - The date of birth in ISO format (YYYY-MM-DD) or EDI format (CCYYMMDD).
 * @returns {number|null} The calculated age, or null if invalid.
 */
function calculateAge(dob) {
  if (!dob || typeof dob !== 'string') {
    return null;
  }

  let dateStr = dob;
  if (dob.length === 8 && !dob.includes('-')) {
    dateStr = parseEDIDate(dob);
  }

  if (!dateStr) {
    return null;
  }

  const birthDate = new Date(dateStr);
  if (isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
}

/**
 * Extracts the ISA (Interchange Control Header) data from parsed segments.
 * @param {Array<{ segmentId: string, elements: Array<string> }>} parsedSegments - The parsed segments.
 * @returns {object|null} The ISA header data, or null if not found.
 */
function extractISA(parsedSegments) {
  const isa = parsedSegments.find((seg) => seg.segmentId === 'ISA');
  if (!isa) {
    return null;
  }

  return {
    authorizationQualifier: getElement(isa.elements, 1),
    authorizationInfo: getElement(isa.elements, 2),
    securityQualifier: getElement(isa.elements, 3),
    securityInfo: getElement(isa.elements, 4),
    senderQualifier: getElement(isa.elements, 5),
    senderId: getElement(isa.elements, 6),
    receiverQualifier: getElement(isa.elements, 7),
    receiverId: getElement(isa.elements, 8),
    date: getElement(isa.elements, 9),
    time: getElement(isa.elements, 10),
    repetitionSeparator: getElement(isa.elements, 11),
    controlVersionNumber: getElement(isa.elements, 12),
    controlNumber: getElement(isa.elements, 13),
    acknowledgmentRequested: getElement(isa.elements, 14),
    usageIndicator: getElement(isa.elements, 15),
    subElementSeparator: getElement(isa.elements, 16),
  };
}

/**
 * Extracts the GS (Functional Group Header) data from parsed segments.
 * @param {Array<{ segmentId: string, elements: Array<string> }>} parsedSegments - The parsed segments.
 * @returns {object|null} The GS header data, or null if not found.
 */
function extractGS(parsedSegments) {
  const gs = parsedSegments.find((seg) => seg.segmentId === 'GS');
  if (!gs) {
    return null;
  }

  return {
    functionalIdCode: getElement(gs.elements, 1),
    applicationSenderCode: getElement(gs.elements, 2),
    applicationReceiverCode: getElement(gs.elements, 3),
    date: getElement(gs.elements, 4),
    time: getElement(gs.elements, 5),
    groupControlNumber: getElement(gs.elements, 6),
    responsibleAgencyCode: getElement(gs.elements, 7),
    versionCode: getElement(gs.elements, 8),
  };
}

/**
 * Extracts the ST (Transaction Set Header) data from parsed segments.
 * @param {Array<{ segmentId: string, elements: Array<string> }>} parsedSegments - The parsed segments.
 * @returns {object|null} The ST header data, or null if not found.
 */
function extractST(parsedSegments) {
  const st = parsedSegments.find((seg) => seg.segmentId === 'ST');
  if (!st) {
    return null;
  }

  return {
    transactionSetIdCode: getElement(st.elements, 1),
    transactionSetControlNumber: getElement(st.elements, 2),
    implementationConventionReference: getElement(st.elements, 3),
  };
}

/**
 * Validates the envelope segments (ISA/IEA, GS/GE, ST/SE) and control numbers.
 * @param {Array<{ segmentId: string, elements: Array<string> }>} parsedSegments - The parsed segments.
 * @returns {{ valid: boolean, errors: Array<string> }} Validation result.
 */
function validateEnvelope(parsedSegments) {
  const errors = [];

  // Check ISA/IEA pair
  const isaSegments = parsedSegments.filter((seg) => seg.segmentId === 'ISA');
  const ieaSegments = parsedSegments.filter((seg) => seg.segmentId === 'IEA');

  if (isaSegments.length === 0) {
    errors.push('Missing ISA (Interchange Control Header) segment.');
  }

  if (ieaSegments.length === 0) {
    errors.push('Missing IEA (Interchange Control Trailer) segment.');
  }

  if (isaSegments.length > 0 && ieaSegments.length > 0) {
    const isaControlNumber = getElement(isaSegments[0].elements, 13).trim();
    const ieaControlNumber = getElement(ieaSegments[0].elements, 2).trim();
    if (isaControlNumber && ieaControlNumber && isaControlNumber !== ieaControlNumber) {
      errors.push(
        `ISA/IEA control number mismatch: ISA=${isaControlNumber}, IEA=${ieaControlNumber}.`
      );
    }
  }

  // Check GS/GE pair
  const gsSegments = parsedSegments.filter((seg) => seg.segmentId === 'GS');
  const geSegments = parsedSegments.filter((seg) => seg.segmentId === 'GE');

  if (gsSegments.length === 0) {
    errors.push('Missing GS (Functional Group Header) segment.');
  }

  if (geSegments.length === 0) {
    errors.push('Missing GE (Functional Group Trailer) segment.');
  }

  if (gsSegments.length > 0 && geSegments.length > 0) {
    const gsControlNumber = getElement(gsSegments[0].elements, 6).trim();
    const geControlNumber = getElement(geSegments[0].elements, 2).trim();
    if (gsControlNumber && geControlNumber && gsControlNumber !== geControlNumber) {
      errors.push(
        `GS/GE control number mismatch: GS=${gsControlNumber}, GE=${geControlNumber}.`
      );
    }
  }

  // Check ST/SE pair
  const stSegments = parsedSegments.filter((seg) => seg.segmentId === 'ST');
  const seSegments = parsedSegments.filter((seg) => seg.segmentId === 'SE');

  if (stSegments.length === 0) {
    errors.push('Missing ST (Transaction Set Header) segment.');
  }

  if (seSegments.length === 0) {
    errors.push('Missing SE (Transaction Set Trailer) segment.');
  }

  if (stSegments.length > 0 && seSegments.length > 0) {
    const stControlNumber = getElement(stSegments[0].elements, 2).trim();
    const seControlNumber = getElement(seSegments[0].elements, 2).trim();
    if (stControlNumber && seControlNumber && stControlNumber !== seControlNumber) {
      errors.push(
        `ST/SE control number mismatch: ST=${stControlNumber}, SE=${seControlNumber}.`
      );
    }

    // Validate segment count in SE
    const seSegmentCount = getElement(seSegments[0].elements, 1).trim();
    if (seSegmentCount) {
      const expectedCount = parseInt(seSegmentCount, 10);
      // Count segments between ST and SE (inclusive)
      const stIndex = parsedSegments.indexOf(stSegments[0]);
      const seIndex = parsedSegments.indexOf(seSegments[0]);
      if (stIndex >= 0 && seIndex >= 0) {
        const actualCount = seIndex - stIndex + 1;
        if (!isNaN(expectedCount) && expectedCount !== actualCount) {
          errors.push(
            `SE segment count mismatch: expected=${expectedCount}, actual=${actualCount}.`
          );
        }
      }
    }
  }

  // Verify transaction set ID is 834
  if (stSegments.length > 0) {
    const transactionSetId = getElement(stSegments[0].elements, 1).trim();
    if (transactionSetId && transactionSetId !== '834') {
      errors.push(
        `Invalid transaction set ID: expected 834, got ${transactionSetId}.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Groups parsed segments into member loops based on INS segment boundaries.
 * Each member loop starts with an INS segment and continues until the next INS
 * or an envelope trailer segment (SE, GE, IEA).
 * @param {Array<{ segmentId: string, elements: Array<string> }>} parsedSegments - The parsed segments.
 * @returns {Array<Array<{ segmentId: string, elements: Array<string> }>>} An array of member loop segment groups.
 */
function groupMemberLoops(parsedSegments) {
  const memberLoops = [];
  let currentLoop = null;

  const envelopeSegments = new Set(['ISA', 'IEA', 'GS', 'GE', 'ST', 'SE', 'BGN']);

  for (const segment of parsedSegments) {
    if (envelopeSegments.has(segment.segmentId)) {
      continue;
    }

    if (segment.segmentId === 'INS') {
      if (currentLoop && currentLoop.length > 0) {
        memberLoops.push(currentLoop);
      }
      currentLoop = [segment];
    } else if (currentLoop) {
      currentLoop.push(segment);
    }
  }

  // Push the last loop
  if (currentLoop && currentLoop.length > 0) {
    memberLoops.push(currentLoop);
  }

  return memberLoops;
}

/**
 * Extracts INS (Insured Benefit) segment data from a member loop.
 * @param {Array<{ segmentId: string, elements: Array<string> }>} loopSegments - The member loop segments.
 * @returns {object} The extracted INS data.
 */
function extractINS(loopSegments) {
  const ins = loopSegments.find((seg) => seg.segmentId === 'INS');
  if (!ins) {
    return {};
  }

  const subscriberIndicator = getElement(ins.elements, 1);
  const relationshipCode = getElement(ins.elements, 2);
  const maintenanceTypeCode = getElement(ins.elements, 3);
  const maintenanceReasonCode = getElement(ins.elements, 4);
  const benefitStatusCode = getElement(ins.elements, 5);

  return {
    subscriberIndicator,
    isSubscriber: subscriberIndicator === 'Y',
    relationshipCode,
    relationship: RELATIONSHIP_CODES[relationshipCode] || relationshipCode || '',
    maintenanceTypeCode,
    maintenanceType: MAINTENANCE_TYPE_CODES[maintenanceTypeCode] || maintenanceTypeCode || '',
    maintenanceReasonCode,
    benefitStatusCode,
  };
}

/**
 * Extracts REF (Reference Identification) segments from a member loop.
 * @param {Array<{ segmentId: string, elements: Array<string> }>} loopSegments - The member loop segments.
 * @returns {object} The extracted reference data.
 */
function extractREF(loopSegments) {
  const refs = loopSegments.filter((seg) => seg.segmentId === 'REF');
  const refData = {};

  for (const ref of refs) {
    const qualifier = getElement(ref.elements, 1);
    const value = getElement(ref.elements, 2);
    const description = getElement(ref.elements, 3);

    switch (qualifier) {
      case '0F':
        refData.subscriberNumber = value;
        break;
      case '1L':
        refData.groupPolicyNumber = value;
        break;
      case '17':
        refData.clientReportingCategory = value;
        break;
      case '23':
        refData.clientNumber = value;
        break;
      case '3H':
        refData.caseNumber = value;
        break;
      case '6O':
        refData.crossReferenceNumber = value;
        break;
      case 'ABB':
        refData.personalIdNumber = value;
        break;
      case 'DX':
        refData.departmentNumber = value;
        break;
      case 'ZZ':
        refData.mutuallyDefined = value;
        if (description) {
          refData.mutuallyDefinedDescription = description;
        }
        break;
      default:
        if (!refData.otherReferences) {
          refData.otherReferences = [];
        }
        refData.otherReferences.push({ qualifier, value, description });
        break;
    }
  }

  return refData;
}

/**
 * Extracts DMG (Demographic Information) segment data from a member loop.
 * @param {Array<{ segmentId: string, elements: Array<string> }>} loopSegments - The member loop segments.
 * @returns {object} The extracted demographic data.
 */
function extractDMG(loopSegments) {
  const dmg = loopSegments.find((seg) => seg.segmentId === 'DMG');
  if (!dmg) {
    return {};
  }

  const dateTimePeriodFormatQualifier = getElement(dmg.elements, 1);
  const dateOfBirth = getElement(dmg.elements, 2);
  const genderCode = getElement(dmg.elements, 3);
  const maritalStatusCode = getElement(dmg.elements, 4);
  const raceEthnicityCode = getElement(dmg.elements, 5);
  const citizenshipStatusCode = getElement(dmg.elements, 6);

  const parsedDOB = parseEDIDate(dateOfBirth);
  const age = calculateAge(dateOfBirth);

  return {
    dateTimePeriodFormatQualifier,
    dateOfBirth: parsedDOB || dateOfBirth,
    rawDateOfBirth: dateOfBirth,
    genderCode,
    gender: GENDER_CODES[genderCode] || genderCode || '',
    maritalStatusCode,
    raceEthnicityCode,
    citizenshipStatusCode,
    age,
  };
}

/**
 * Extracts NM1 (Individual or Organizational Name) segments from a member loop.
 * @param {Array<{ segmentId: string, elements: Array<string> }>} loopSegments - The member loop segments.
 * @returns {object} The extracted name data.
 */
function extractNM1(loopSegments) {
  const nm1Segments = loopSegments.filter((seg) => seg.segmentId === 'NM1');
  const nameData = {};

  for (const nm1 of nm1Segments) {
    const entityIdCode = getElement(nm1.elements, 1);
    const entityTypeQualifier = getElement(nm1.elements, 2);
    const lastName = getElement(nm1.elements, 3);
    const firstName = getElement(nm1.elements, 4);
    const middleName = getElement(nm1.elements, 5);
    const prefix = getElement(nm1.elements, 6);
    const suffix = getElement(nm1.elements, 7);
    const idCodeQualifier = getElement(nm1.elements, 8);
    const idCode = getElement(nm1.elements, 9);

    const nameEntry = {
      entityIdCode,
      entityTypeQualifier,
      lastName,
      firstName,
      middleName,
      prefix,
      suffix,
      idCodeQualifier,
      idCode,
    };

    switch (entityIdCode) {
      case 'IL':
        // Insured or Subscriber
        nameData.member = nameEntry;
        break;
      case '70':
        // Prior Incorrect Insured
        nameData.priorIncorrect = nameEntry;
        break;
      case '31':
        // Postal Mailing Address
        nameData.postalAddress = nameEntry;
        break;
      case '36':
        // Employer
        nameData.employer = nameEntry;
        break;
      case '74':
        // Corrected Insured
        nameData.correctedInsured = nameEntry;
        break;
      case 'QD':
        // Responsible Party
        nameData.responsibleParty = nameEntry;
        break;
      default:
        if (!nameData.otherNames) {
          nameData.otherNames = [];
        }
        nameData.otherNames.push(nameEntry);
        break;
    }
  }

  return nameData;
}

/**
 * Extracts N3 (Address Information) segment data from a member loop.
 * @param {Array<{ segmentId: string, elements: Array<string> }>} loopSegments - The member loop segments.
 * @returns {object} The extracted address line data.
 */
function extractN3(loopSegments) {
  const n3 = loopSegments.find((seg) => seg.segmentId === 'N3');
  if (!n3) {
    return {};
  }

  return {
    addressLine1: getElement(n3.elements, 1),
    addressLine2: getElement(n3.elements, 2),
  };
}

/**
 * Extracts N4 (Geographic Location) segment data from a member loop.
 * @param {Array<{ segmentId: string, elements: Array<string> }>} loopSegments - The member loop segments.
 * @returns {object} The extracted geographic location data.
 */
function extractN4(loopSegments) {
  const n4 = loopSegments.find((seg) => seg.segmentId === 'N4');
  if (!n4) {
    return {};
  }

  return {
    city: getElement(n4.elements, 1),
    state: getElement(n4.elements, 2),
    zipCode: getElement(n4.elements, 3),
    countryCode: getElement(n4.elements, 4),
  };
}

/**
 * Extracts HD (Health Coverage) segments from a member loop.
 * @param {Array<{ segmentId: string, elements: Array<string> }>} loopSegments - The member loop segments.
 * @returns {Array<object>} An array of extracted health coverage data objects.
 */
function extractHD(loopSegments) {
  const hdSegments = loopSegments.filter((seg) => seg.segmentId === 'HD');
  const coverages = [];

  for (const hd of hdSegments) {
    const maintenanceTypeCode = getElement(hd.elements, 1);
    const maintenanceReasonCode = getElement(hd.elements, 2);
    const insuranceLineCode = getElement(hd.elements, 3);
    const planCoverageDescription = getElement(hd.elements, 4);
    const coverageLevelCode = getElement(hd.elements, 5);

    coverages.push({
      maintenanceTypeCode,
      maintenanceType: MAINTENANCE_TYPE_CODES[maintenanceTypeCode] || maintenanceTypeCode || '',
      maintenanceReasonCode,
      insuranceLineCode,
      insuranceLine: INSURANCE_LINE_CODES[insuranceLineCode] || insuranceLineCode || '',
      planCoverageDescription,
      coverageLevelCode,
    });
  }

  return coverages;
}

/**
 * Extracts DTP (Date or Time Period) segments from a member loop.
 * @param {Array<{ segmentId: string, elements: Array<string> }>} loopSegments - The member loop segments.
 * @returns {Array<object>} An array of extracted date/time period data objects.
 */
function extractDTP(loopSegments) {
  const dtpSegments = loopSegments.filter((seg) => seg.segmentId === 'DTP');
  const dates = [];

  for (const dtp of dtpSegments) {
    const qualifier = getElement(dtp.elements, 1);
    const formatQualifier = getElement(dtp.elements, 2);
    const dateValue = getElement(dtp.elements, 3);

    let parsedDate = '';
    let startDate = '';
    let endDate = '';

    if (formatQualifier === 'D8' && dateValue) {
      parsedDate = parseEDIDate(dateValue);
    } else if (formatQualifier === 'RD8' && dateValue) {
      // Date range: CCYYMMDD-CCYYMMDD
      const parts = dateValue.split('-');
      if (parts.length === 2) {
        startDate = parseEDIDate(parts[0]);
        endDate = parseEDIDate(parts[1]);
      }
    }

    dates.push({
      qualifier,
      qualifierDescription: DTP_QUALIFIERS[qualifier] || qualifier || '',
      formatQualifier,
      rawDate: dateValue,
      date: parsedDate,
      startDate,
      endDate,
    });
  }

  return dates;
}

/**
 * Extracts ICM (Income) segment data from a member loop if present.
 * @param {Array<{ segmentId: string, elements: Array<string> }>} loopSegments - The member loop segments.
 * @returns {object} The extracted income data.
 */
function extractICM(loopSegments) {
  const icm = loopSegments.find((seg) => seg.segmentId === 'ICM');
  if (!icm) {
    return {};
  }

  return {
    frequencyCode: getElement(icm.elements, 1),
    wageAmount: getElement(icm.elements, 2),
    workHoursCount: getElement(icm.elements, 3),
    locationIdCode: getElement(icm.elements, 4),
  };
}

/**
 * Builds a structured member object from a member loop's extracted data.
 * @param {Array<{ segmentId: string, elements: Array<string> }>} loopSegments - The member loop segments.
 * @param {string} subElementSeparator - The sub-element separator character.
 * @returns {object} The structured member object.
 */
function buildMemberFromLoop(loopSegments, subElementSeparator) {
  const insData = extractINS(loopSegments);
  const refData = extractREF(loopSegments);
  const dmgData = extractDMG(loopSegments);
  const nm1Data = extractNM1(loopSegments);
  const n3Data = extractN3(loopSegments);
  const n4Data = extractN4(loopSegments);
  const hdData = extractHD(loopSegments);
  const dtpData = extractDTP(loopSegments);
  const icmData = extractICM(loopSegments);

  // Determine member name from NM1 IL (Insured/Subscriber) segment
  const memberName = nm1Data.member || {};
  const firstName = memberName.firstName || '';
  const lastName = memberName.lastName || '';
  const middleName = memberName.middleName || '';
  const memberId = memberName.idCode || refData.subscriberNumber || uuidv4();

  // Build demographics object
  const demographics = {
    dateOfBirth: dmgData.dateOfBirth || '',
    gender: dmgData.gender || '',
    genderCode: dmgData.genderCode || '',
    age: dmgData.age,
    maritalStatusCode: dmgData.maritalStatusCode || '',
    raceEthnicityCode: dmgData.raceEthnicityCode || '',
    citizenshipStatusCode: dmgData.citizenshipStatusCode || '',
    address: {
      line1: n3Data.addressLine1 || '',
      line2: n3Data.addressLine2 || '',
      city: n4Data.city || '',
      state: n4Data.state || '',
      zipCode: n4Data.zipCode || '',
      countryCode: n4Data.countryCode || '',
    },
  };

  // Build coverage string from HD segments
  let coverageDescription = '';
  if (hdData.length > 0) {
    const coverageDescriptions = hdData.map((hd) => {
      const parts = [];
      if (hd.insuranceLine) {
        parts.push(hd.insuranceLine);
      } else if (hd.insuranceLineCode) {
        parts.push(hd.insuranceLineCode);
      }
      if (hd.planCoverageDescription) {
        parts.push(hd.planCoverageDescription);
      }
      return parts.join(' - ');
    }).filter((desc) => desc.length > 0);

    coverageDescription = coverageDescriptions.join('; ');
  }

  // Extract effective and termination dates from DTP segments
  let effectiveDate = '';
  let terminationDate = '';

  for (const dtp of dtpData) {
    if (dtp.qualifier === '356' || dtp.qualifier === '348' || dtp.qualifier === '338') {
      if (dtp.date) {
        effectiveDate = effectiveDate || dtp.date;
      }
      if (dtp.startDate) {
        effectiveDate = effectiveDate || dtp.startDate;
      }
    }
    if (dtp.qualifier === '357' || dtp.qualifier === '349' || dtp.qualifier === '339') {
      if (dtp.date) {
        terminationDate = terminationDate || dtp.date;
      }
      if (dtp.endDate) {
        terminationDate = terminationDate || dtp.endDate;
      }
    }
    if (dtp.qualifier === '303') {
      if (dtp.date && !effectiveDate) {
        effectiveDate = dtp.date;
      }
    }
  }

  // Extract income if available
  let income = null;
  if (icmData.wageAmount) {
    const parsedWage = parseFloat(icmData.wageAmount);
    if (!isNaN(parsedWage)) {
      income = parsedWage;
    }
  }

  return {
    id: uuidv4(),
    memberId,
    firstName,
    lastName,
    middleName,
    fullName: [firstName, middleName, lastName].filter(Boolean).join(' '),
    demographics,
    coverage: coverageDescription,
    coverageDetails: hdData,
    dates: dtpData,
    effectiveDate,
    terminationDate,
    income,
    insData,
    references: refData,
    names: nm1Data,
    eligibilityStatus: 'Pending',
    status: 'Pending',
    rawSegments: loopSegments.map((seg) => seg.elements.join(DEFAULT_ELEMENT_SEPARATOR)),
  };
}

/**
 * Parses raw EDI 834 file content and extracts structured member data.
 *
 * Processes ISA/GS/ST envelope segments, validates control numbers and segment counts,
 * then extracts member loops (2000/2100/2300) including demographics (INS, REF, DMG, NM1, N3, N4)
 * and coverage data (HD, DTP).
 *
 * @param {string} rawContent - The raw EDI 834 file content string.
 * @returns {{
 *   success: boolean,
 *   members: Array<object>,
 *   envelope: { isa: object|null, gs: object|null, st: object|null },
 *   validation: { valid: boolean, errors: Array<string> },
 *   metadata: { totalSegments: number, memberCount: number, parsedAt: string },
 *   errors: Array<string>
 * }} The parsing result containing members, envelope data, validation results, and metadata.
 */
export function parseEDI834(rawContent) {
  const result = {
    success: false,
    members: [],
    envelope: {
      isa: null,
      gs: null,
      st: null,
    },
    validation: {
      valid: false,
      errors: [],
    },
    metadata: {
      totalSegments: 0,
      memberCount: 0,
      parsedAt: new Date().toISOString(),
    },
    errors: [],
  };

  // Validate input
  if (!rawContent || typeof rawContent !== 'string') {
    result.errors.push('No content provided for parsing.');
    return result;
  }

  const trimmedContent = rawContent.trim();
  if (trimmedContent.length === 0) {
    result.errors.push('Empty content provided for parsing.');
    return result;
  }

  try {
    // Detect separators
    const segmentTerminator = detectSegmentTerminator(trimmedContent);
    const elementSeparator = detectElementSeparator(trimmedContent);
    const subElementSeparator = detectSubElementSeparator(
      trimmedContent,
      elementSeparator,
      segmentTerminator
    );

    // Split into segments
    const rawSegments = splitSegments(trimmedContent, segmentTerminator);

    if (rawSegments.length === 0) {
      result.errors.push('No segments found in the provided content.');
      return result;
    }

    // Parse each segment
    const parsedSegments = rawSegments.map((seg) => parseSegment(seg, elementSeparator));

    result.metadata.totalSegments = parsedSegments.length;

    // Extract envelope data
    result.envelope.isa = extractISA(parsedSegments);
    result.envelope.gs = extractGS(parsedSegments);
    result.envelope.st = extractST(parsedSegments);

    // Validate envelope
    const envelopeValidation = validateEnvelope(parsedSegments);
    result.validation = envelopeValidation;

    if (!envelopeValidation.valid) {
      result.errors.push(...envelopeValidation.errors);
    }

    // Group member loops
    const memberLoops = groupMemberLoops(parsedSegments);

    // Build member objects from each loop
    for (const loop of memberLoops) {
      try {
        const member = buildMemberFromLoop(loop, subElementSeparator);
        result.members.push(member);
      } catch (loopError) {
        const errorMessage = loopError instanceof Error
          ? loopError.message
          : 'Unknown error processing member loop.';
        result.errors.push(`Error processing member loop: ${errorMessage}`);
      }
    }

    result.metadata.memberCount = result.members.length;

    // Consider parsing successful if we extracted at least some data
    // even if there are validation warnings
    result.success = result.members.length > 0 || (envelopeValidation.valid && parsedSegments.length > 0);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown parsing error.';
    result.errors.push(`EDI 834 parsing failed: ${errorMessage}`);
    result.success = false;
  }

  return result;
}

/**
 * Validates raw EDI 834 content without fully parsing member data.
 * Performs a lightweight check on the envelope structure and segment format.
 *
 * @param {string} rawContent - The raw EDI 834 file content string.
 * @returns {{ valid: boolean, errors: Array<string>, segmentCount: number }} The validation result.
 */
export function validateEDI834(rawContent) {
  const validationResult = {
    valid: false,
    errors: [],
    segmentCount: 0,
  };

  if (!rawContent || typeof rawContent !== 'string') {
    validationResult.errors.push('No content provided for validation.');
    return validationResult;
  }

  const trimmedContent = rawContent.trim();
  if (trimmedContent.length === 0) {
    validationResult.errors.push('Empty content provided for validation.');
    return validationResult;
  }

  try {
    const segmentTerminator = detectSegmentTerminator(trimmedContent);
    const elementSeparator = detectElementSeparator(trimmedContent);

    const rawSegments = splitSegments(trimmedContent, segmentTerminator);

    if (rawSegments.length === 0) {
      validationResult.errors.push('No segments found in the provided content.');
      return validationResult;
    }

    validationResult.segmentCount = rawSegments.length;

    const parsedSegments = rawSegments.map((seg) => parseSegment(seg, elementSeparator));

    // Check that it starts with ISA
    if (parsedSegments.length > 0 && parsedSegments[0].segmentId !== 'ISA') {
      validationResult.errors.push(
        `Expected first segment to be ISA, found "${parsedSegments[0].segmentId}".`
      );
    }

    // Validate envelope
    const envelopeValidation = validateEnvelope(parsedSegments);
    if (!envelopeValidation.valid) {
      validationResult.errors.push(...envelopeValidation.errors);
    }

    // Check for at least one INS segment (member data)
    const hasINS = parsedSegments.some((seg) => seg.segmentId === 'INS');
    if (!hasINS) {
      validationResult.errors.push('No INS (Insured Benefit) segments found. File may not contain member data.');
    }

    validationResult.valid = validationResult.errors.length === 0;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown validation error.';
    validationResult.errors.push(`EDI 834 validation failed: ${errorMessage}`);
  }

  return validationResult;
}

/**
 * Generates a sample EDI 834 content string for testing purposes.
 *
 * @param {object} [options] - Optional configuration for the sample.
 * @param {number} [options.memberCount=1] - Number of member loops to generate.
 * @returns {string} A sample EDI 834 content string.
 */
export function generateSampleEDI834(options = {}) {
  const memberCount = (options && typeof options.memberCount === 'number' && options.memberCount > 0)
    ? options.memberCount
    : 1;

  const segments = [];

  // ISA segment
  segments.push(
    'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*^*00501*000000001*0*P*:'
  );

  // GS segment
  segments.push('GS*HP*SENDER*RECEIVER*20240101*1200*1*X*005010X220A1');

  // ST segment
  segments.push('ST*834*0001*005010X220A1');

  // BGN segment
  segments.push('BGN*00*12345*20240101*1200****2');

  // Generate member loops
  for (let i = 0; i < memberCount; i++) {
    const memberNum = String(i + 1).padStart(3, '0');

    // INS segment (2000 loop)
    segments.push(`INS*Y*18*021**A***FT`);

    // REF segment
    segments.push(`REF*0F*SUB${memberNum}`);

    // REF segment - SSN
    segments.push(`REF*1L*GRP${memberNum}`);

    // DTP segment - Maintenance Effective
    segments.push('DTP*303*D8*20240101');

    // DTP segment - Eligibility Begin
    segments.push('DTP*356*D8*20240101');

    // NM1 segment (2100 loop - Member Name)
    segments.push(`NM1*IL*1*DOE${memberNum}*JOHN${memberNum}*M***34*${memberNum}00000001`);

    // N3 segment (Address)
    segments.push(`N3*${100 + i} MAIN ST*APT ${i + 1}`);

    // N4 segment (City/State/Zip)
    segments.push(`N4*ANYTOWN*CA*90210*US`);

    // DMG segment (Demographics)
    segments.push(`DMG*D8*19900115*M`);

    // HD segment (2300 loop - Health Coverage)
    segments.push('HD*021**HLT*MEDICAID PLAN*EMP');

    // DTP segment - Benefit Begin
    segments.push('DTP*348*D8*20240101');
  }

  // Calculate total segments (ST through SE inclusive)
  const transactionSegmentCount = segments.length - 2 + 1; // -2 for ISA and GS, +1 for SE itself

  // SE segment
  segments.push(`SE*${transactionSegmentCount}*0001`);

  // GE segment
  segments.push('GE*1*1');

  // IEA segment
  segments.push('IEA*1*000000001');

  return segments.join('~') + '~';
}

export {
  detectSegmentTerminator,
  detectElementSeparator,
  detectSubElementSeparator,
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
};