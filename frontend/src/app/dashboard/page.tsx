'use client';

import { Toaster } from 'sonner';
import { FileUp, Pencil, Mic } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Document, fetchDocuments } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Plus as PlusIcon } from 'lucide-react';
import { createAndOpenDocument } from '@/lib/document-utils';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      loadDocuments();
    };

    window.addEventListener('focus', handleFocus);
    
    loadDocuments();
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // New handler for document creation
  const handleCreateDocument = async () => {
    setIsCreating(true);
    try {
      const documentId = await createAndOpenDocument();
      if (documentId) {
        // Navigate only after document is created and IDs are stored
        navigate(`/editor/${documentId}?new=true`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar className="h-full border-r border-gray-200 dark:border-gray-800" />
        <Separator orientation="vertical" className="h-full" />
        <div className="flex-1 overflow-auto bg-white">
          <div className="flex flex-col items-center justify-center p-8 max-w-4xl mx-auto h-full">
            <div className="w-full space-y-8 mt-16">
              <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold">What will you discover today?</h1>
                <p className="text-gray-500">Ask a question, drag and drop a file or chose an option to get started</p>
              </div>

              <div className="relative w-full">
                <Input 
                  className="w-full p-4 pl-4 pr-10 rounded-md border border-gray-300" 
                  placeholder="Ask Minerva a question..." 
                />
                <div className="absolute right-3 top-3">
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <span className="sr-only">Submit</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
                      <path d="M12 5v14m-7-7h14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="border rounded-lg p-6 flex flex-col items-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                    <Pencil className="h-5 w-5 text-gray-700" />
                  </div>
                  <h3 className="font-medium">Write</h3>
                  <p className="text-sm text-gray-500 text-center">Write and cite with Minerva AI</p>
                </div>
                
                <div className="border rounded-lg p-6 flex flex-col items-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                    <FileUp className="h-5 w-5 text-gray-700" />
                  </div>
                  <h3 className="font-medium">Import</h3>
                  <p className="text-sm text-gray-500 text-center">Chat with docs and videos</p>
                </div>
                
                <div className="border rounded-lg p-6 flex flex-col items-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                    <Mic className="h-5 w-5 text-gray-700" />
                  </div>
                  <h3 className="font-medium">Record</h3>
                  <p className="text-sm text-gray-500 text-center">Record and chat with audio</p>
                </div>
              </div>
            </div>

            <div className="mt-auto pb-4 flex gap-4 text-sm text-gray-500">
              <a href="#" className="hover:underline">Changelog</a>
              <a href="#" className="hover:underline">User guide</a>
              <a href="#" className="hover:underline">Minerva University</a>
            </div>

            <div className="mt-8">
              <h2 className="text-2xl font-bold mb-4">Your Documents</h2>
              <div className="flex justify-between items-center mb-6">
                <Button onClick={handleCreateDocument} disabled={isCreating}>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  {isCreating ? 'Creating...' : 'New Document'}
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8">Loading documents...</div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">You don't have any documents yet.</p>
                  <Button onClick={handleCreateDocument} disabled={isCreating}>
                    {isCreating ? 'Creating...' : 'Create your first document'}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map((doc) => (
                    <Link 
                      key={doc.id} 
                      to={`/editor/${doc.id}`}
                      className="block p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                    >
                      <h3 className="font-medium text-lg mb-2">{doc.title}</h3>
                      <p className="text-sm text-gray-500">
                        Updated {new Date(doc.updated_at).toLocaleDateString()}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <Toaster position="top-right" />
      </div>
    </SidebarProvider>
  );
} 