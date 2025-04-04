import { Toaster } from 'sonner';

import { SettingsProvider } from '@/components/editor/settings';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ResizableEditor } from '@/components/editor/resizable-editor';

export default function Page() {
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
