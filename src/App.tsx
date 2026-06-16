import AdminPage from '@/admin/AdminPage';
import CoverLetterPage from '@/cover-letter/CoverLetterPage';
import LandingPage from '@/landing/LandingPage';
import NotFoundPage from '@/landing/NotFoundPage';
import { Toaster } from 'sonner';

function App() {
  const pathname = window.location.pathname;
  const isAdminPreviewRoute = pathname.startsWith('/admin/preview');
  const isAdminRoute = pathname.startsWith('/admin') && !isAdminPreviewRoute;
  const isLetterRoute = pathname === '/letter' || isAdminPreviewRoute;
  const isHomeRoute = pathname === '/';

  return (
    <>
      {isAdminRoute ? (
        <AdminPage />
      ) : isLetterRoute ? (
        <CoverLetterPage />
      ) : isHomeRoute ? (
        <LandingPage />
      ) : (
        <NotFoundPage />
      )}
      {isAdminRoute ? <Toaster /> : null}
    </>
  );
}

export default App;
