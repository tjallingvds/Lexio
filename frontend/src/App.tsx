import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useState, useEffect } from 'react';

import Home from '@/pages/Home';
import Editor from '@/pages/Editor';
import AllDocuments from '@/app/all-documents/page';
import NewDocument from '@/pages/NewDocument';
import Login from '@/pages/Login';
import Register from '@/pages/Register';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  // Check authentication on mount and when location changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, [location]);

  // Protected route component
  const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    // If authentication is still being determined, show nothing
    if (isAuthenticated === null) {
      return null;
    }

    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }

    // If authenticated, render children
    return <>{children}</>;
  };

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected routes */}
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route 
          path="/home" 
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard" 
          element={<Navigate to="/home" replace />} 
        />
        <Route 
          path="/editor" 
          element={
            <ProtectedRoute>
              <NewDocument />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/editor/:id" 
          element={
            <ProtectedRoute>
              <Editor />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/all-documents" 
          element={
            <ProtectedRoute>
              <AllDocuments />
            </ProtectedRoute>
          } 
        />
      </Routes>
      <Toaster position="top-right" />
    </>
  );
}

export default App;
