# Medicaid Enrollment Portal

A comprehensive React-based web application for processing EDI 834 enrollment files through a simulated Medicaid enrollment pipeline. The portal provides end-to-end file processing, member eligibility determination, enrollment management, downstream system integration, and full audit trail capabilities.

## Features

### File Processing Pipeline
- **EDI 834 File Upload** — Drag-and-drop or browse to upload EDI 834 enrollment files
- **Multiple Upload Sources** — Web upload, Mock API ingestion, and Mock SFTP transfer
- **Format Validation** — Validates EDI 834 envelope segments (ISA, GS, ST, SE, GE, IEA), control numbers, and segment counts
- **EDI 834 Parsing** — Extracts member data from INS, NM1, DMG, N3, N4, HD, DTP, REF, and ICM segments
- **Duplicate Detection** — Content hash and metadata-based duplicate file detection
- **Processing Timeline** — Visual pipeline progress through Upload → Validate → Parse → Eligibility → Categorize → Enrollment → Integration stages
- **Retry Failed Files** — Re-process failed files from the beginning of the pipeline

### Member Management
- **Member Search** — Search by name, member ID, or last 4 of SSN with status and state filters
- **Member Detail View** — Demographics, coverage information, eligibility status, and enrollment history
- **SSN Masking** — Sensitive identifiers are masked in the UI (e.g., `***-**-1234`)

### Eligibility Engine
- **Configurable Rules** — Per-state eligibility rules with wildcard (`*`) support for all states
- **Multiple Criteria** — Age, income, residency state, coverage type, and citizenship status
- **Operators** — Supports `>=`, `<=`, `>`, `<`, `==`, `!=`, and `exists` operators
- **Rule Versioning** — Automatic version incrementing on rule updates
- **Real-time Determination** — Eligibility evaluated during file processing pipeline

### Enrollment Management
- **Enrollment Records** — Automatic enrollment creation for processed members
- **Status Tracking** — Eligible, Ineligible, and Pending status with history timeline
- **Plan Details** — Coverage type, effective dates, and termination dates

### Integration Management
- **Mock Downstream Endpoints** — State Medicaid System, CMS Federal Hub, and EHR System
- **Transmission Logs** — Detailed logs with status, response codes, and payload preview
- **Retry Policy** — Configurable max retries, delay, and exponential backoff
- **Endpoint Health** — Success rate monitoring and health status indicators
- **Bulk Transmission** — Transmit all eligible members to downstream systems
- **Mock Encryption** — Simulated data-at-rest and data-in-transit encryption (base64 demo)

### Audit & Compliance
- **Audit Trail** — Comprehensive logging of all system actions with timestamps and user attribution
- **Error Logs** — Categorized error tracking (Validation, Parsing, Eligibility, Integration)
- **Severity Levels** — Critical, High, Medium, and Low severity classification
- **Export** — JSON and CSV export of audit and error logs
- **Troubleshooting** — Contextual troubleshooting hints for each error type

### Role-Based Access Control (RBAC)
- **Enrollment Team** — Upload files, view members, process enrollments, export data
- **IT** — System status, audit logs, settings management, file operations
- **Compliance** — Audit logs, compliance reports, encryption status, data export
- **Admin** — Full access to all features including user management
- **Role Switching** — Switch roles at any time from the header dropdown

### Dashboard
- **Summary Statistics** — File processing, member eligibility, enrollment, and integration stats
- **Processing Status** — Visual progress bars for file processing breakdown
- **Eligibility Overview** — Eligibility rate and distribution charts
- **Recent Files** — Quick access to recently uploaded files
- **Error Summary** — Recent errors with type breakdown
- **Pipeline Summary** — Aggregated counts across all pipeline stages

### Settings & Data Management
- **Storage Usage** — localStorage usage monitoring with per-key breakdown
- **Export/Import** — Full application data export and import as JSON
- **Seed Demo Data** — Generate sample members, rules, and enrollments for demonstration
- **Reset Options** — Reset eligibility rules, integration config, pipeline data, or all data
- **Danger Zone** — Destructive actions with confirmation modals

## Tech Stack

- **Framework** — [React 18](https://react.dev/) with [Vite 5](https://vitejs.dev/)
- **Language** — JavaScript (JSX)
- **Routing** — [React Router v6](https://reactrouter.com/) with `createBrowserRouter`
- **State Management** — [Zustand](https://zustand-demo.pmnd.rs/) with localStorage persistence
- **Styling** — [Tailwind CSS 3](https://tailwindcss.com/) with custom color palette
- **Testing** — [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) + [jsdom](https://github.com/jsdom/jsdom)
- **Utilities** — [uuid](https://github.com/uuidjs/uuid) for ID generation, [prop-types](https://github.com/facebook/prop-types) for runtime type checking
- **Linting** — [ESLint 8](https://eslint.org/) with React, React Hooks, and React Refresh plugins

## Folder Structure

```
medicaid-enrollment-portal/
├── public/
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── audit/
│   │   │   ├── AuditLogViewer.jsx      # Audit trail viewer with search, filters, and export
│   │   │   └── ErrorLogViewer.jsx      # Error log viewer with severity indicators
│   │   ├── common/
│   │   │   ├── AlertMessage.jsx        # Dismissible alert/notification banner
│   │   │   ├── DataTable.jsx           # Sortable, paginated data table with selection
│   │   │   ├── LoadingSpinner.jsx      # Animated loading indicator
│   │   │   ├── Modal.jsx              # Reusable modal dialog
│   │   │   ├── SearchBar.jsx          # Debounced search with filter dropdowns
│   │   │   ├── StatsCard.jsx          # Dashboard statistics card with trend indicator
│   │   │   └── StatusBadge.jsx        # Color-coded status badge
│   │   ├── eligibility/
│   │   │   ├── EligibilityResults.jsx  # Eligibility determination results table
│   │   │   └── EligibilityRuleConfig.jsx # Rule configuration CRUD interface
│   │   ├── enrollments/
│   │   │   ├── EnrollmentDetail.jsx    # Enrollment detail view with tabs
│   │   │   └── EnrollmentList.jsx      # Enrollment records table with search
│   │   ├── files/
│   │   │   ├── FileDetails.jsx         # File detail view with processing timeline
│   │   │   ├── FileList.jsx            # File list with actions (view, retry, delete)
│   │   │   ├── FileUpload.jsx          # Drag-and-drop file upload with source selector
│   │   │   └── FileUpload.test.jsx     # FileUpload component tests
│   │   ├── integration/
│   │   │   └── IntegrationPanel.jsx    # Integration management with endpoint health
│   │   ├── layout/
│   │   │   ├── Header.jsx             # App header with role switcher and notifications
│   │   │   ├── MainLayout.jsx         # Main layout wrapper with sidebar offset
│   │   │   └── Sidebar.jsx            # Navigation sidebar with permission filtering
│   │   └── members/
│   │       ├── MemberDetail.jsx        # Member detail view with demographics and history
│   │       └── MemberSearch.jsx        # Member search with filters and inline detail modal
│   ├── contexts/
│   │   └── AuthContext.jsx             # Authentication context with ProtectedRoute
│   ├── pages/
│   │   ├── AuditPage.jsx              # Audit logs page with tabs
│   │   ├── DashboardPage.jsx          # Main dashboard with summary stats
│   │   ├── DashboardPage.test.jsx     # Dashboard page tests
│   │   ├── EligibilityPage.jsx        # Eligibility rules and results page
│   │   ├── EnrollmentDetailPage.jsx   # Enrollment detail page wrapper
│   │   ├── EnrollmentsPage.jsx        # Enrollments list page
│   │   ├── FileDetailPage.jsx         # File detail page wrapper
│   │   ├── FileUploadPage.jsx         # File upload and history page
│   │   ├── IntegrationPage.jsx        # Integration management page
│   │   ├── LoginPage.jsx              # Simulated login with role selection
│   │   ├── MemberDetailPage.jsx       # Member detail page wrapper
│   │   ├── MembersPage.jsx            # Members search page
│   │   ├── NotFoundPage.jsx           # 404 page
│   │   └── SettingsPage.jsx           # Settings and data management page
│   ├── services/
│   │   ├── edi834Parser.js            # EDI 834 parser with segment extraction
│   │   ├── edi834Parser.test.js       # EDI 834 parser tests
│   │   ├── fileValidator.js           # File validation and duplicate detection
│   │   ├── fileValidator.test.js      # File validator tests
│   │   ├── mockEndpoints.js           # Mock API and SFTP upload endpoints
│   │   ├── processingPipeline.js      # End-to-end file processing orchestrator
│   │   ├── processingPipeline.test.js # Processing pipeline tests
│   │   └── sampleData.js             # Sample data generation for demos
│   ├── stores/
│   │   ├── auditStore.js              # Audit and error log state management
│   │   ├── auditStore.test.js         # Audit store tests
│   │   ├── authStore.js               # Authentication and RBAC state management
│   │   ├── eligibilityStore.js        # Eligibility rules and determination engine
│   │   ├── eligibilityStore.test.js   # Eligibility store tests
│   │   ├── enrollmentStore.js         # Enrollment records state management
│   │   ├── fileStore.js               # File records state management
│   │   ├── integrationStore.js        # Integration logs and config state management
│   │   └── memberStore.js             # Member records state management
│   ├── test/
│   │   └── setup.js                   # Test setup with localStorage mocks
│   ├── utils/
│   │   ├── constants.js               # Application constants and configuration
│   │   ├── encryption.js              # Mock encryption utilities (base64 demo)
│   │   ├── helpers.js                 # Utility functions (formatting, debounce, storage)
│   │   └── localStorage.js           # localStorage persistence utilities
│   ├── App.jsx                        # Root app component with RouterProvider
│   ├── index.css                      # Tailwind CSS base styles
│   ├── main.jsx                       # Application entry point
│   └── router.jsx                     # Route configuration with auth guards
├── .env.example                       # Environment variable template
├── .gitignore
├── eslint.config.js                   # ESLint flat config
├── index.html                         # HTML entry point
├── package.json
├── postcss.config.js                  # PostCSS with Tailwind plugin
├── tailwind.config.js                 # Tailwind configuration with custom colors
├── vercel.json                        # Vercel SPA rewrite rules
├── vite.config.js                     # Vite build configuration
└── vitest.config.js                   # Vitest test configuration
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd medicaid-enrollment-portal

# Install dependencies
npm install
```

### Environment Variables

Copy the example environment file and configure as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `VITE_APP_TITLE` | `Medicaid Enrollment Portal` | Application title displayed in the browser tab and header |
| `VITE_DEFAULT_ROLE` | `applicant` | Default user role for the application |
| `VITE_STORAGE_PREFIX` | `medicaid_` | Prefix used for localStorage keys to avoid collisions |
| `VITE_MAX_FILE_SIZE_MB` | `10` | Maximum file upload size in megabytes |

### Development

```bash
# Start the development server
npm run dev
```

The application will be available at [http://localhost:5173](http://localhost:5173).

### Build

```bash
# Create a production build
npm run build
```

The output will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

## Testing

The project uses [Vitest](https://vitest.dev/) as the test runner with [React Testing Library](https://testing-library.com/) for component tests and [jsdom](https://github.com/jsdom/jsdom) as the DOM environment.

### Run Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch
```

### Test Coverage

Tests cover the following areas:

- **EDI 834 Parser** (`edi834Parser.test.js`) — Segment parsing, envelope validation, member extraction, date parsing, and edge cases
- **File Validator** (`fileValidator.test.js`) — Extension validation, size limits, MIME types, EDI 834 format validation, and duplicate detection
- **Processing Pipeline** (`processingPipeline.test.js`) — End-to-end pipeline processing, stage status updates, failure handling, retry logic, and statistics
- **Audit Store** (`auditStore.test.js`) — Action logging, error logging, filtering, clearing, and export
- **Eligibility Store** (`eligibilityStore.test.js`) — Rule CRUD, eligibility determination with multiple operators, state-specific rules, and edge cases
- **File Upload Component** (`FileUpload.test.jsx`) — Rendering, source selection, file selection, upload processing, loading states, error handling, and drag-and-drop
- **Dashboard Page** (`DashboardPage.test.jsx`) — Stats rendering, navigation, role-based visibility, empty states, and data display

### Test Setup

Tests use a custom setup file (`src/test/setup.js`) that:
- Imports `@testing-library/jest-dom` for DOM matchers
- Mocks `localStorage` and `sessionStorage` with in-memory implementations
- Clears mocks and storage between tests

## Architecture

### State Management

The application uses [Zustand](https://zustand-demo.pmnd.rs/) for state management with six independent stores:

| Store | Purpose |
|---|---|
| `authStore` | User authentication, role management, and permission checking |
| `fileStore` | Uploaded file records with status tracking |
| `memberStore` | Member records with demographics and eligibility status |
| `eligibilityStore` | Eligibility rules configuration and determination engine |
| `enrollmentStore` | Enrollment records with history tracking |
| `integrationStore` | Integration logs, endpoint configuration, and transmission management |
| `auditStore` | Audit trail and error log management |

All stores persist their state to `localStorage` with the configurable `VITE_STORAGE_PREFIX` to avoid key collisions.

### Processing Pipeline

The file processing pipeline orchestrates seven stages:

1. **Upload** — File metadata validation, duplicate detection, and storage
2. **Validate** — EDI 834 format validation (envelope segments, control numbers, segment counts)
3. **Parse** — EDI 834 content parsing to extract member data from segment loops
4. **Eligibility** — Member eligibility determination against configurable per-state rules
5. **Categorize** — Member record creation/update in the member store with history tracking
6. **Enrollment** — Enrollment record creation for each processed member
7. **Integration** — Simulated transmission of eligible member data to downstream endpoints

Each stage emits status updates via an optional callback, enabling real-time progress tracking in the UI.

### EDI 834 Parser

The parser supports the following EDI 834 segments:

- **Envelope** — ISA, GS, ST, SE, GE, IEA with control number validation
- **Member Loop (2000)** — INS (subscriber/relationship), REF (reference numbers)
- **Name Loop (2100)** — NM1 (member/employer names), N3/N4 (address), DMG (demographics)
- **Coverage Loop (2300)** — HD (health coverage), DTP (date periods), ICM (income)

The parser auto-detects segment terminators (`~`, `\n`) and element separators (`*`) from the ISA segment.

### Authentication & RBAC

Authentication is simulated for demonstration purposes. The RBAC system maps four roles to specific permission sets:

- **EnrollmentTeam** — File upload, member viewing, enrollment processing, data export
- **IT** — System status, audit logs, settings management, file deletion
- **Compliance** — Audit logs, compliance reports, encryption status, data export
- **Admin** — All permissions including user management and log clearing

The `AuthContext` provides `hasPermission()` checks used by `ProtectedRoute` components and throughout the UI to conditionally render features.

### Mock Integration

Downstream system integration is simulated with:

- **Mock Endpoints** — Three configurable endpoints with enable/disable toggles
- **Simulated Transmission** — ~80% success rate with random failure scenarios (500, 503, 408, 422)
- **Mock Encryption** — Base64 encoding to simulate data-in-transit encryption
- **Retry Policy** — Configurable max retries with exponential backoff

## Deployment

### Vercel

The project includes a `vercel.json` configuration for SPA routing. Deploy directly from the repository:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Static Hosting

Build the project and serve the `dist/` directory with any static file server. Ensure all routes are rewritten to `index.html` for client-side routing.

```bash
npm run build
```

## License

Private