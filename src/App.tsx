import AdminPage from '@/admin/AdminPage';
import { Toaster } from '@/components/ui/sonner';
import CoverLetterPage from '@/cover-letter/CoverLetterPage';
import LandingPage from '@/landing/LandingPage';
import NotFoundPage from '@/landing/NotFoundPage';

function App() {
  const pathname = window.location.pathname;
  const isAdminRoute = pathname.startsWith('/admin');
  const isLetterRoute = pathname === '/letter';
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
      {isAdminRoute || isLetterRoute ? <Toaster /> : null}
    </>
  );
}

export default App;
