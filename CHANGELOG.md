# Changelog

All notable changes to the Medicaid Enrollment Portal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-09-15

### Added

#### File Processing Pipeline
- EDI 834 file upload via drag-and-drop or file browser
- Multiple upload sources: Web Upload, Mock API ingestion, and Mock SFTP transfer
- EDI 834 envelope validation for ISA, GS, ST, SE, GE, and IEA segments with control number and segment count checks
- EDI 834 parsing with extraction of member data from INS, NM1, DMG, N3, N4, HD, DTP, REF, and ICM segments
- Auto-detection of segment terminators (`~`, `\n`) and element separators (`*`) from the ISA segment
- Content hash and metadata-based duplicate file detection
- Visual processing timeline through Upload → Validate → Parse → Eligibility → Categorize → Enrollment → Integration stages
- Retry failed files from the beginning of the pipeline
- File detail view with metadata, processing timeline, validation results, and parsed member summary

#### Member Management
- Member search by name, member ID, or last 4 digits of SSN with status and state filters
- Member detail view with demographics, coverage information, eligibility status, and enrollment history
- SSN masking in the UI (e.g., `***-**-1234`)
- Member categorization with enrollment history tracking

#### Eligibility Engine
- Configurable per-state eligibility rules with wildcard (`*`) support for all states
- Multiple criteria support: age, income, residency state, coverage type, and citizenship status
- Comparison operators: `>=`, `<=`, `>`, `<`, `==`, `!=`, and `exists`
- Automatic rule version incrementing on updates
- Real-time eligibility determination during file processing pipeline
- Rule configuration CRUD interface with add, edit, delete, and reset to defaults

#### Enrollment Management
- Automatic enrollment record creation for all processed members
- Enrollment status tracking: Eligible, Ineligible, and Pending with history timeline
- Plan details including coverage type, effective dates, and termination dates
- Enrollment detail view with tabs for details, member info, and history

#### Integration Management
- Three mock downstream endpoints: State Medicaid System, CMS Federal Hub, and EHR System
- Detailed transmission logs with status, response codes, and payload preview
- Configurable retry policy with max retries, delay, and exponential backoff
- Endpoint health monitoring with success rate indicators
- Bulk transmission of all eligible members to downstream systems
- Simulated data-at-rest and data-in-transit encryption using base64 encoding (demo only)
- Enable/disable toggle for individual endpoints

#### Audit & Compliance
- Comprehensive audit trail logging of all system actions with timestamps and user attribution
- Categorized error tracking: Validation, Parsing, Eligibility, Categorization, Enrollment, Integration, and Duplicate File errors
- Severity level classification: Critical, High, Medium, and Low
- JSON and CSV export of audit and error logs
- Contextual troubleshooting hints for each error type
- Searchable and filterable audit log viewer with detail modal
- Error log viewer with severity indicators and type breakdown

#### Role-Based Access Control (RBAC)
- Four roles: Enrollment Team, IT, Compliance, and Admin
- Enrollment Team permissions: file upload, member viewing, enrollment processing, data export
- IT permissions: system status, audit logs, settings management, file operations
- Compliance permissions: audit logs, compliance reports, encryption status, data export
- Admin permissions: full access to all features including user management and log clearing
- Role switching from the header dropdown at any time
- Simulated login page with role selection for demonstration
- `ProtectedRoute` component for route-level permission guards
- `AuthContext` with `hasPermission()` checks used throughout the UI

#### Dashboard
- Summary statistics for file processing, member eligibility, enrollment, and integration
- Processing status visual progress bars with file breakdown
- Eligibility overview with rate calculation and distribution display
- Recent files table with quick access to file details
- Error summary with type breakdown and recent error list
- Pipeline summary with aggregated counts across all stages
- Quick action buttons for upload, members, and audit logs

#### Settings & Data Management
- localStorage usage monitoring with per-key size breakdown
- Full application data export and import as JSON
- Audit log export as JSON
- Seed demo data generation with configurable member count
- Reset options for eligibility rules, integration configuration, pipeline data, or all data
- Danger zone with confirmation modals for destructive actions

#### UI Components
- `DataTable` — sortable, paginated data table with row selection and empty state
- `SearchBar` — debounced search input with filter dropdowns and active filter pills
- `StatusBadge` — color-coded status badge for Eligible, Ineligible, Pending, Completed, Failed, etc.
- `StatsCard` — dashboard statistics card with trend indicator and icon
- `AlertMessage` — dismissible alert/notification banner with auto-dismiss support
- `Modal` — reusable modal dialog with overlay, close on escape/overlay click, and action buttons
- `LoadingSpinner` — animated loading indicator with size variants and optional message
- `Header` — application header with role switcher dropdown and notification bell
- `Sidebar` — collapsible navigation sidebar with permission-filtered links
- `MainLayout` — responsive layout wrapper with sidebar offset

#### Infrastructure
- React 18 with Vite 5 build tooling
- Zustand state management with localStorage persistence across six independent stores
- React Router v6 with `createBrowserRouter` and route-level auth guards
- Tailwind CSS 3 with custom color palette (primary, success, warning, error)
- Vitest test runner with React Testing Library and jsdom environment
- ESLint 8 with React, React Hooks, and React Refresh plugins
- Vercel deployment configuration with SPA rewrite rules
- Environment variable support via `.env` with `VITE_` prefix

#### Testing
- EDI 834 parser tests covering segment parsing, envelope validation, member extraction, date parsing, and edge cases
- File validator tests covering extension validation, size limits, MIME types, EDI 834 format validation, and duplicate detection
- Processing pipeline tests covering end-to-end processing, stage status updates, failure handling, retry logic, and statistics
- Audit store tests covering action logging, error logging, filtering, clearing, and export
- Eligibility store tests covering rule CRUD, eligibility determination with multiple operators, state-specific rules, and edge cases
- FileUpload component tests covering rendering, source selection, file selection, upload processing, loading states, error handling, and drag-and-drop
- DashboardPage tests covering stats rendering, navigation, role-based visibility, empty states, and data display

[1.0.0]: https://github.com/example/medicaid-enrollment-portal/releases/tag/v1.0.0