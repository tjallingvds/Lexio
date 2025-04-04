'use client';

import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createAndOpenDocument } from '@/lib/document-utils';

import { SettingsProvider } from '@/components/editor/settings';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ResizableEditor } from '@/components/editor/resizable-editor';

export default function Page() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [creationAttempted, setCreationAttempted] = useState(false);

  useEffect(() => {
    // Use the same consistent approach as our utility function
    const initDocument = async () => {
      setCreationAttempted(true);
      try {
        const newDocId = await createAndOpenDocument();
        
        if (newDocId) {
          setDocumentId(newDocId);
          setLoading(false);
        } else {
          // If document creation failed, go back home
          toast.error('Failed to create document');
          navigate('/home');
        }
      } catch (error) {
        console.error('Error creating document:', error);
        toast.error('Failed to create document');
        navigate('/home');
      }
    };

    initDocument();
  }, [navigate]);

  // Only show loading state until we've attempted to create a document
  if (loading && !creationAttempted) {
    return (
      <SidebarProvider>
        <div className="flex h-screen w-full" data-registry="plate">
          <AppSidebar className="h-full border-r border-gray-200 dark:border-gray-800" />
          <Separator orientation="vertical" className="h-full" />
          <div className="flex-1 overflow-auto flex items-center justify-center">
            Creating new document...
          </div>
          <Toaster />
        </div>
      </SidebarProvider>
    );
  }

  // Show editor once document is created
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full" data-registry="plate">
        <AppSidebar className="h-full border-r border-gray-200 dark:border-gray-800" />
        <Separator orientation="vertical" className="h-full" />
        <div className="flex-1 overflow-auto">
          <SettingsProvider>
            {/* Pass document ID directly to ensure it's available */}
            <ResizableEditor documentId={documentId} />
          </SettingsProvider>
        </div>

        <Toaster />
      </div>
    </SidebarProvider>
  );
}
