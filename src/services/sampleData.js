import { v4 as uuidv4 } from 'uuid';
import { generateSampleEDI834 } from './edi834Parser';
import { MEMBER_STATUS } from '../utils/constants';
import { useFileStore } from '../stores/fileStore';
import { useMemberStore } from '../stores/memberStore';
import { useEligibilityStore } from '../stores/eligibilityStore';
import { useEnrollmentStore } from '../stores/enrollmentStore';
import { useAuditStore } from '../stores/auditStore';

/**
 * Sample first names for generating mock member data.
 * @type {Array<string>}
 */
const SAMPLE_FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John',
  'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth',
  'William', 'Barbara', 'Richard', 'Susan', 'Joseph',
  'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen',
  'Daniel', 'Lisa', 'Matthew', 'Nancy', 'Anthony',
];

/**
 * Sample last names for generating mock member data.
 * @type {Array<string>}
 */
const SAMPLE_LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones',
  'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris',
];

/**
 * Sample street names for generating mock addresses.
 * @type {Array<string>}
 */
const SAMPLE_STREETS = [
  'Main St', 'Oak Ave', 'Elm St', 'Maple Dr', 'Cedar Ln',
  'Pine Rd', 'Birch Blvd', 'Walnut Way', 'Cherry Ct', 'Spruce Pl',
  'Willow St', 'Ash Ave', 'Poplar Dr', 'Hickory Ln', 'Sycamore Rd',
];

/**
 * Sample cities with corresponding state codes and zip codes.
 * @type {Array<{ city: string, state: string, zip: string }>}
 */
const SAMPLE_LOCATIONS = [
  { city: 'Los Angeles', state: 'CA', zip: '90001' },
  { city: 'New York', state: 'NY', zip: '10001' },
  { city: 'Chicago', state: 'IL', zip: '60601' },
  { city: 'Houston', state: 'TX', zip: '77001' },
  { city: 'Phoenix', state: 'AZ', zip: '85001' },
  { city: 'Philadelphia', state: 'PA', zip: '19101' },
  { city: 'San Antonio', state: 'TX', zip: '78201' },
  { city: 'San Diego', state: 'CA', zip: '92101' },
  { city: 'Dallas', state: 'TX', zip: '75201' },
  { city: 'Austin', state: 'TX', zip: '78701' },
  { city: 'Jacksonville', state: 'FL', zip: '32099' },
  { city: 'Columbus', state: 'OH', zip: '43085' },
  { city: 'Charlotte', state: 'NC', zip: '28201' },
  { city: 'Indianapolis', state: 'IN', zip: '46201' },
  { city: 'Denver', state: 'CO', zip: '80201' },
];

/**
 * Sample coverage plan descriptions.
 * @type {Array<string>}
 */
const SAMPLE_PLANS = [
  'MEDICAID STANDARD',
  'MEDICAID PLUS',
  'MEDICAID BASIC',
  'MEDICAID FAMILY',
  'MEDICAID CHILD',
  'MEDICAID EXPANSION',
];

/**
 * Sample gender codes.
 * @type {Array<string>}
 */
const SAMPLE_GENDERS = ['M', 'F'];

/**
 * Picks a random element from an array.
 * @param {Array<*>} arr - The array to pick from.
 * @returns {*} A random element from the array.
 */
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a random integer between min (inclusive) and max (inclusive).
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} A random integer.
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random date of birth string in CCYYMMDD format for a person
 * within the specified age range.
 * @param {number} [minAge=1] - The minimum age.
 * @param {number} [maxAge=85] - The maximum age.
 * @returns {string} A date string in CCYYMMDD format.
 */
function randomDateOfBirth(minAge = 1, maxAge = 85) {
  const age = randomInt(minAge, maxAge);
  const now = new Date();
  const birthYear = now.getFullYear() - age;
  const birthMonth = randomInt(1, 12);
  const birthDay = randomInt(1, 28);

  const yearStr = String(birthYear);
  const monthStr = String(birthMonth).padStart(2, '0');
  const dayStr = String(birthDay).padStart(2, '0');

  return `${yearStr}${monthStr}${dayStr}`;
}

/**
 * Generates a random date string in ISO format (YYYY-MM-DD) within the past year.
 * @returns {string} An ISO date string.
 */
function randomRecentDate() {
  const now = new Date();
  const daysAgo = randomInt(0, 365);
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generates a random date string in CCYYMMDD format within the past year.
 * @returns {string} A date string in CCYYMMDD format.
 */
function randomRecentDateEDI() {
  const now = new Date();
  const daysAgo = randomInt(0, 365);
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Generates a random income value between 0 and 80000.
 * @returns {number} A random income value.
 */
function randomIncome() {
  return Math.round(Math.random() * 80000 * 100) / 100;
}

/**
 * Generates a random subscriber number string.
 * @param {number} index - The member index for uniqueness.
 * @returns {string} A subscriber number string.
 */
function generateSubscriberNumber(index) {
  return `SUB${String(index + 1).padStart(6, '0')}`;
}

/**
 * Generates a random SSN-like identifier (not a real SSN).
 * @returns {string} A 9-digit string.
 */
function generateMockSSN() {
  const part1 = String(randomInt(100, 999));
  const part2 = String(randomInt(10, 99));
  const part3 = String(randomInt(1000, 9999));
  return `${part1}${part2}${part3}`;
}

/**
 * Generates a valid EDI 834 file string with sample member data.
 * Uses the generateSampleEDI834 function from the parser for basic generation,
 * but provides a more detailed version with varied member data.
 *
 * @param {object} [options] - Optional configuration.
 * @param {number} [options.memberCount=5] - Number of members to include.
 * @returns {string} A valid EDI 834 content string.
 */
export function generateSampleEDI834File(options = {}) {
  const memberCount = (options && typeof options.memberCount === 'number' && options.memberCount > 0)
    ? options.memberCount
    : 5;

  const segments = [];

  // ISA segment
  segments.push(
    'ISA*00*          *00*          *ZZ*MEDICAID_SEND  *ZZ*MEDICAID_RECV  *240315*0800*^*00501*000000100*0*P*:'
  );

  // GS segment
  segments.push('GS*HP*MEDICAID_SEND*MEDICAID_RECV*20240315*0800*100*X*005010X220A1');

  // ST segment
  segments.push('ST*834*0001*005010X220A1');

  // BGN segment
  segments.push('BGN*00*SAMPLE12345*20240315*0800****2');

  // Generate member loops with varied data
  for (let i = 0; i < memberCount; i++) {
    const firstName = SAMPLE_FIRST_NAMES[i % SAMPLE_FIRST_NAMES.length];
    const lastName = SAMPLE_LAST_NAMES[i % SAMPLE_LAST_NAMES.length];
    const middleInitial = String.fromCharCode(65 + (i % 26));
    const location = SAMPLE_LOCATIONS[i % SAMPLE_LOCATIONS.length];
    const gender = SAMPLE_GENDERS[i % SAMPLE_GENDERS.length];
    const dob = randomDateOfBirth(2, 75);
    const effectiveDate = randomRecentDateEDI();
    const subscriberNum = generateSubscriberNumber(i);
    const ssn = generateMockSSN();
    const streetNum = 100 + i * 10;
    const street = SAMPLE_STREETS[i % SAMPLE_STREETS.length];
    const plan = SAMPLE_PLANS[i % SAMPLE_PLANS.length];

    // INS segment (2000 loop)
    segments.push('INS*Y*18*021**A***FT');

    // REF segments
    segments.push(`REF*0F*${subscriberNum}`);
    segments.push(`REF*1L*GRP${String(i + 1).padStart(4, '0')}`);

    // DTP segment - Maintenance Effective
    segments.push(`DTP*303*D8*${effectiveDate}`);

    // DTP segment - Eligibility Begin
    segments.push(`DTP*356*D8*${effectiveDate}`);

    // NM1 segment (2100 loop - Member Name)
    segments.push(`NM1*IL*1*${lastName}*${firstName}*${middleInitial}***34*${ssn}`);

    // N3 segment (Address)
    segments.push(`N3*${streetNum} ${street}`);

    // N4 segment (City/State/Zip)
    segments.push(`N4*${location.city}*${location.state}*${location.zip}*US`);

    // DMG segment (Demographics)
    segments.push(`DMG*D8*${dob}*${gender}`);

    // HD segment (2300 loop - Health Coverage)
    segments.push(`HD*021**HLT*${plan}*EMP`);

    // DTP segment - Benefit Begin
    segments.push(`DTP*348*D8*${effectiveDate}`);
  }

  // Calculate total segments (ST through SE inclusive)
  const transactionSegmentCount = segments.length - 2 + 1; // -2 for ISA and GS, +1 for SE itself

  // SE segment
  segments.push(`SE*${transactionSegmentCount}*0001`);

  // GE segment
  segments.push('GE*1*100');

  // IEA segment
  segments.push('IEA*1*000000100');

  return segments.join('~') + '~';
}

/**
 * Generates an array of mock member objects with realistic sample data.
 *
 * @param {number} [count=10] - The number of members to generate.
 * @returns {Array<object>} An array of mock member objects.
 */
export function generateSampleMembers(count = 10) {
  const memberCount = (typeof count === 'number' && count > 0) ? count : 10;
  const members = [];

  for (let i = 0; i < memberCount; i++) {
    const firstName = SAMPLE_FIRST_NAMES[i % SAMPLE_FIRST_NAMES.length];
    const lastName = SAMPLE_LAST_NAMES[i % SAMPLE_LAST_NAMES.length];
    const location = SAMPLE_LOCATIONS[i % SAMPLE_LOCATIONS.length];
    const gender = SAMPLE_GENDERS[i % SAMPLE_GENDERS.length];
    const plan = SAMPLE_PLANS[i % SAMPLE_PLANS.length];
    const dob = randomDateOfBirth(2, 75);
    const income = randomIncome();
    const effectiveDate = randomRecentDate();
    const subscriberNum = generateSubscriberNumber(i);

    // Parse DOB to ISO format
    const dobYear = dob.substring(0, 4);
    const dobMonth = dob.substring(4, 6);
    const dobDay = dob.substring(6, 8);
    const dobISO = `${dobYear}-${dobMonth}-${dobDay}`;

    // Calculate age
    const birthDate = new Date(dobISO);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Determine eligibility status based on index for variety
    let eligibilityStatus;
    if (i % 5 === 0) {
      eligibilityStatus = MEMBER_STATUS.INELIGIBLE;
    } else if (i % 3 === 0) {
      eligibilityStatus = MEMBER_STATUS.PENDING;
    } else {
      eligibilityStatus = MEMBER_STATUS.ELIGIBLE;
    }

    const memberId = subscriberNum;
    const id = uuidv4();
    const now = new Date().toISOString();

    const member = {
      id,
      memberId,
      firstName,
      lastName,
      middleName: '',
      fullName: `${firstName} ${lastName}`,
      demographics: {
        dateOfBirth: dobISO,
        gender: gender === 'M' ? 'Male' : 'Female',
        genderCode: gender,
        age: age >= 0 ? age : 0,
        maritalStatusCode: '',
        raceEthnicityCode: '',
        citizenshipStatusCode: '',
        address: {
          line1: `${100 + i * 10} ${SAMPLE_STREETS[i % SAMPLE_STREETS.length]}`,
          line2: '',
          city: location.city,
          state: location.state,
          zipCode: location.zip,
          countryCode: 'US',
        },
      },
      coverage: `Health - ${plan}`,
      coverageDetails: [
        {
          maintenanceTypeCode: '021',
          maintenanceType: 'Addition',
          maintenanceReasonCode: '',
          insuranceLineCode: 'HLT',
          insuranceLine: 'Health',
          planCoverageDescription: plan,
          coverageLevelCode: 'EMP',
        },
      ],
      dates: [
        {
          qualifier: '356',
          qualifierDescription: 'Eligibility Begin',
          formatQualifier: 'D8',
          rawDate: effectiveDate.replace(/-/g, ''),
          date: effectiveDate,
          startDate: '',
          endDate: '',
        },
      ],
      effectiveDate,
      terminationDate: '',
      income,
      insData: {
        subscriberIndicator: 'Y',
        isSubscriber: true,
        relationshipCode: '18',
        relationship: 'Self',
        maintenanceTypeCode: '021',
        maintenanceType: 'Addition',
        maintenanceReasonCode: '',
        benefitStatusCode: 'A',
      },
      references: {
        subscriberNumber: subscriberNum,
        groupPolicyNumber: `GRP${String(i + 1).padStart(4, '0')}`,
      },
      names: {
        member: {
          entityIdCode: 'IL',
          entityTypeQualifier: '1',
          lastName,
          firstName,
          middleName: '',
          prefix: '',
          suffix: '',
          idCodeQualifier: '34',
          idCode: generateMockSSN(),
        },
      },
      eligibilityStatus,
      status: eligibilityStatus,
      history: [
        {
          id: uuidv4(),
          action: 'Member Added',
          status: eligibilityStatus,
          timestamp: now,
          details: null,
        },
      ],
      enrollmentHistory: [
        {
          id: uuidv4(),
          action: 'Member Added',
          status: eligibilityStatus,
          timestamp: now,
          details: null,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    members.push(member);
  }

  return members;
}

/**
 * Generates default eligibility rules for multiple states.
 * Includes wildcard rules and state-specific rules for CA, NY, TX, FL, and IL.
 *
 * @returns {Array<object>} An array of eligibility rule objects.
 */
export function generateSampleRules() {
  const now = new Date().toISOString().split('T')[0];

  return [
    // Wildcard rules (apply to all states)
    {
      id: uuidv4(),
      state: '*',
      criteria: { field: 'age', operator: '>=', value: 0 },
      effectiveDate: '2024-01-01',
      version: 1,
      createdBy: 'system',
    },
    {
      id: uuidv4(),
      state: '*',
      criteria: { field: 'income', operator: '<=', value: 50000 },
      effectiveDate: '2024-01-01',
      version: 1,
      createdBy: 'system',
    },
    // California rules
    {
      id: uuidv4(),
      state: 'CA',
      criteria: { field: 'age', operator: '>=', value: 0 },
      effectiveDate: '2024-01-01',
      version: 1,
      createdBy: 'system',
    },
    {
      id: uuidv4(),
      state: 'CA',
      criteria: { field: 'income', operator: '<=', value: 55000 },
      effectiveDate: '2024-01-01',
      version: 1,
      createdBy: 'system',
    },
    // New York rules
    {
      id: uuidv4(),
      state: 'NY',
      criteria: { field: 'age', operator: '>=', value: 0 },
      effectiveDate: '2024-01-01',
      version: 1,
      createdBy: 'system',
    },
    {
      id: uuidv4(),
      state: 'NY',
      criteria: { field: 'income', operator: '<=', value: 60000 },
      effectiveDate: '2024-01-01',
      version: 1,
      createdBy: 'system',
    },
    // Texas rules
    {
      id: uuidv4(),
      state: 'TX',
      criteria: { field: 'age', operator: '>=', value: 0 },
      effectiveDate: '2024-01-01',
      version: 1,
      createdBy: 'system',
    },
    {
      id: uuidv4(),
      state: 'TX',
      criteria: { field: 'income', operator: '<=', value: 45000 },
      effectiveDate: '2024-01-01',
      version: 1,
      createdBy: 'system',
    },
    // Florida rules
    {
      id: uuidv4(),
      state: 'FL',
      criteria: { field: 'age', operator: '>=', value: 0 },
      effectiveDate: '2024-01-01',
      version: 1,
      createdBy: 'system',
    },
    {
      id: uuidv4(),
      state: 'FL',
      criteria: { field: 'income', operator: '<=', value: 48000 },
      effectiveDate: '2024-01-01',
      version: 1,
      createdBy: 'system',
    },
    // Illinois rules
    {
      id: uuidv4(),
      state: 'IL',
      criteria: { field: 'age', operator: '>=', value: 0 },
      effectiveDate: '2024-01-01',
      version: 1,
      createdBy: 'system',
    },
    {
      id: uuidv4(),
      state: 'IL',
      criteria: { field: 'income', operator: '<=', value: 52000 },
      effectiveDate: '2024-01-01',
      version: 1,
      createdBy: 'system',
    },
  ];
}

/**
 * Populates stores with demo data if they are currently empty.
 * Seeds members, eligibility rules, and creates corresponding enrollment records.
 * Also logs the seeding action to the audit store.
 *
 * @param {object} [options] - Optional configuration.
 * @param {number} [options.memberCount=10] - Number of sample members to generate.
 * @param {boolean} [options.force=false] - If true, seeds data even if stores are not empty.
 * @returns {{ seeded: boolean, memberCount: number, ruleCount: number, enrollmentCount: number }} The seeding result.
 */
export function seedInitialData(options = {}) {
  const memberCount = (options && typeof options.memberCount === 'number' && options.memberCount > 0)
    ? options.memberCount
    : 10;
  const force = (options && options.force === true) || false;

  const result = {
    seeded: false,
    memberCount: 0,
    ruleCount: 0,
    enrollmentCount: 0,
  };

  const memberStore = useMemberStore.getState();
  const eligibilityStore = useEligibilityStore.getState();
  const enrollmentStore = useEnrollmentStore.getState();
  const auditStore = useAuditStore.getState();

  const existingMembers = memberStore.members || [];
  const existingEnrollments = enrollmentStore.enrollments || [];

  // Check if stores already have data
  if (!force && existingMembers.length > 0) {
    return result;
  }

  // Seed eligibility rules
  const sampleRules = generateSampleRules();
  eligibilityStore.setRules(sampleRules);
  result.ruleCount = sampleRules.length;

  // Generate and add sample members
  const sampleMembers = generateSampleMembers(memberCount);

  for (const member of sampleMembers) {
    const added = memberStore.addMember(member);
    if (added) {
      result.memberCount++;

      // Create enrollment record for each member
      const enrollmentData = {
        memberId: added.memberId || added.id,
        planId: added.coverage || 'MEDICAID_DEFAULT',
        status: added.eligibilityStatus || MEMBER_STATUS.PENDING,
        effectiveDate: added.effectiveDate || null,
        terminationDate: added.terminationDate || null,
        coverage: added.coverage || '',
        demographics: added.demographics || {},
      };

      const enrollment = enrollmentStore.createEnrollment(enrollmentData);
      if (enrollment) {
        result.enrollmentCount++;
      }
    }
  }

  // Log the seeding action
  auditStore.logAction('Demo Data Seeded', '', 'system', {
    memberCount: result.memberCount,
    ruleCount: result.ruleCount,
    enrollmentCount: result.enrollmentCount,
    seededAt: new Date().toISOString(),
  });

  result.seeded = true;

  return result;
}

export {
  SAMPLE_FIRST_NAMES,
  SAMPLE_LAST_NAMES,
  SAMPLE_LOCATIONS,
  SAMPLE_PLANS,
};