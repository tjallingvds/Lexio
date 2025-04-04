import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import Home from '@/pages/Home';
import Editor from '@/pages/Editor';
import AllDocuments from '@/app/all-documents/page';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/dashboard" element={<Navigate to="/home" replace />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="/all-documents" element={<AllDocuments />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
