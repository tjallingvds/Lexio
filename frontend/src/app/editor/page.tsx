'use client';

import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import { createDocument } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { SettingsProvider } from '@/components/editor/settings';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ResizableEditor } from '@/components/editor/resizable-editor';

export default function Page() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [documentId, setDocumentId] = useState<string | null>(null);

  useEffect(() => {
    const initDocument = async () => {
      try {
        const doc = await createDocument('Untitled Document', '');
        if (doc) {
          setDocumentId(doc.id);
          toast.success('Document created successfully');
          navigate(`/editor/${doc.id}`);
        } else {
          toast.error('Failed to create document');
        }
      } catch (error) {
        console.error('Error creating document:', error);
        toast.error('Failed to create document');
      } finally {
        setLoading(false);
      }
    };

    initDocument();
  }, [navigate]);

  if (loading) {
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

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full" data-registry="plate">
        <AppSidebar className="h-full border-r border-gray-200 dark:border-gray-800" />
        <Separator orientation="vertical" className="h-full" />
        <div className="flex-1 overflow-auto">
          <SettingsProvider>
            <ResizableEditor />
          </SettingsProvider>
        </div>

        <Toaster />
      </div>
    </SidebarProvider>
  );
}
