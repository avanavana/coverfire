import AdminPage from '@/admin/AdminPage';
import CoverLetterPage from '@/cover-letter/CoverLetterPage';

function App() {
  if (window.location.pathname.startsWith('/admin')) {
    return <AdminPage />;
  }

  return <CoverLetterPage />;
}

export default App;
