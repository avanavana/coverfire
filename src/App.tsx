import AdminPage from '@/admin/AdminPage';
import CoverLetterPage from '@/cover-letter/CoverLetterPage';
import { Toaster } from 'sonner';

function App() {
  const isAdminRoute = window.location.pathname.startsWith('/admin');

  return (
    <>
      {isAdminRoute ? <AdminPage /> : <CoverLetterPage />}
      {isAdminRoute ? <Toaster /> : null}
    </>
  );
}

export default App;
