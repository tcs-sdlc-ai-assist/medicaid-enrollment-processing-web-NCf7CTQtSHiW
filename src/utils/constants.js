const STORAGE_PREFIX = import.meta.env.VITE_STORAGE_PREFIX || 'medicaid_';
const MAX_FILE_SIZE_MB = Number(import.meta.env.VITE_MAX_FILE_SIZE_MB) || 10;

export const MEMBER_STATUS = Object.freeze({
  ELIGIBLE: 'Eligible',
  INELIGIBLE: 'Ineligible',
  PENDING: 'Pending',
});

export const FILE_STATUS = Object.freeze({
  UPLOADED: 'Uploaded',
  VALIDATING: 'Validating',
  PARSING: 'Parsing',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
});

export const USER_ROLES = Object.freeze({
  ENROLLMENT_TEAM: 'EnrollmentTeam',
  IT: 'IT',
  COMPLIANCE: 'Compliance',
  ADMIN: 'Admin',
});

export const STORAGE_KEYS = Object.freeze({
  AUTH_TOKEN: `${STORAGE_PREFIX}auth_token`,
  USER_PROFILE: `${STORAGE_PREFIX}user_profile`,
  USER_ROLE: `${STORAGE_PREFIX}user_role`,
  APPLICATIONS: `${STORAGE_PREFIX}applications`,
  FILES: `${STORAGE_PREFIX}files`,
  MEMBERS: `${STORAGE_PREFIX}members`,
  SETTINGS: `${STORAGE_PREFIX}settings`,
  THEME: `${STORAGE_PREFIX}theme`,
});

export const EDI_SEGMENT_TERMINATORS = Object.freeze({
  SEGMENT: '~',
  ELEMENT: '*',
  SUB_ELEMENT: ':',
  NEWLINE: '\n',
});

export const MOCK_API_DELAY_MS = 800;

export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const SUPPORTED_FILE_EXTENSIONS = Object.freeze([
  '.edi',
  '.x12',
  '.834',
  '.csv',
  '.txt',
  '.json',
  '.xml',
]);