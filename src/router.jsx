import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { FileUploadPage } from './pages/FileUploadPage';
import { FileDetailPage } from './pages/FileDetailPage';
import { MembersPage } from './pages/MembersPage';
import { MemberDetailPage } from './pages/MemberDetailPage';
import { EligibilityPage } from './pages/EligibilityPage';
import { EnrollmentsPage } from './pages/EnrollmentsPage';
import { EnrollmentDetailPage } from './pages/EnrollmentDetailPage';
import { IntegrationPage } from './pages/IntegrationPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * Application router configuration using createBrowserRouter.
 * Defines all routes with authentication and permission guards.
 *
 * Public routes:
 *   - /login
 *
 * Authenticated routes (wrapped in MainLayout + ProtectedRoute):
 *   - / (redirects to /dashboard)
 *   - /dashboard
 *   - /upload
 *   - /files
 *   - /files/:fileId
 *   - /members
 *   - /members/:memberId
 *   - /eligibility
 *   - /enrollments
 *   - /enrollments/:enrollmentId
 *   - /integration
 *   - /audit
 *   - /settings
 *   - * (404)
 *
 * @type {import('react-router-dom').Router}
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <MainLayout>
        <LoginPage />
      </MainLayout>
    ),
  },
  {
    path: '/',
    element: (
      <MainLayout>
        <ProtectedRoute permission="view_dashboard">
          <DashboardPage />
        </ProtectedRoute>
      </MainLayout>
    ),
  },
  {
    path: '/dashboard',
    element: <Navigate to="/" replace />,
  },
  {
    path: '/upload',
    element: (
      <MainLayout>
        <ProtectedRoute permission="upload_files">
          <FileUploadPage />
        </ProtectedRoute>
      </MainLayout>
    ),
  },
  {
    path: '/files',
    element: (
      <MainLayout>
        <ProtectedRoute permission="view_files">
          <FileUploadPage />
        </ProtectedRoute>
      </MainLayout>
    ),
  },
  {
    path: '/files/:fileId',
    element: (
      <MainLayout>
        <ProtectedRoute permission="view_files">
          <FileDetailPage />
        </ProtectedRoute>
      </MainLayout>
    ),
  },
  {
    path: '/members',
    element: (
      <MainLayout>
        <ProtectedRoute permission="view_members">
          <MembersPage />
        </ProtectedRoute>
      </MainLayout>
    ),
  },
  {
    path: '/members/:memberId',
    element: (
      <MainLayout>
        <ProtectedRoute permission="view_members">
          <MemberDetailPage />
        </ProtectedRoute>
      </MainLayout>
    ),
  },
  {
    path: '/eligibility',
    element: (
      <MainLayout>
        <ProtectedRoute permission="view_members">
          <EligibilityPage />
        </ProtectedRoute>
      </MainLayout>
    ),
  },
  {
    path: '/enrollments',
    element: (
      <MainLayout>
        <ProtectedRoute permission="process_enrollment">
          <EnrollmentsPage />
        </ProtectedRoute>
      </MainLayout>
    ),
  },
  {
    path: '/enrollments/:enrollmentId',
    element: (
      <MainLayout>
        <ProtectedRoute permission="process_enrollment">
          <EnrollmentDetailPage />
        </ProtectedRoute>
      </MainLayout>
    ),
  },
  {
    path: '/integration',
    element: (
      <MainLayout>
        <ProtectedRoute permission="view_system_status">
          <IntegrationPage />
        </ProtectedRoute>
      </MainLayout>
    ),
  },
  {
    path: '/audit',
    element: (
      <MainLayout>
        <ProtectedRoute permission="view_audit_logs">
          <AuditPage />
        </ProtectedRoute>
      </MainLayout>
    ),
  },
  {
    path: '/settings',
    element: (
      <MainLayout>
        <ProtectedRoute permission="manage_settings">
          <SettingsPage />
        </ProtectedRoute>
      </MainLayout>
    ),
  },
  {
    path: '*',
    element: (
      <MainLayout>
        <NotFoundPage />
      </MainLayout>
    ),
  },
]);

export default router;