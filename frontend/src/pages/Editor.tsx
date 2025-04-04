import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchDocument } from '@/lib/api';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ResizableEditor } from '@/components/editor/resizable-editor';
import { SettingsProvider } from '@/components/editor/settings';
import { Toaster } from 'sonner';

export default function Editor() {
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      const loadDocument = async () => {
        setLoading(true);
        try {
          const document = await fetchDocument(parseInt(id));
          if (!document) {
            setError('Document not found');
          }
          // In a real app, you'd load the document content into the editor
        } catch (error) {
          setError('Failed to load document');
          console.error(error);
        } finally {
          setLoading(false);
        }
      };
      
      loadDocument();
    }
  }, [id]);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full" data-registry="plate">
        <AppSidebar className="h-full border-r border-gray-200 dark:border-gray-800" />
        <Separator orientation="vertical" className="h-full" />
        <div className="flex-1 overflow-hidden flex flex-col bg-white">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              Loading document...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">
              {error}
            </div>
          ) : (
            <SettingsProvider>
              <ResizableEditor />
            </SettingsProvider>
          )}
        </div>

        <Toaster />
      </div>
    </SidebarProvider>
  );
} 