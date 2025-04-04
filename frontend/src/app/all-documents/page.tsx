'use client';

import { Toaster } from 'sonner';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

export default function Page() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar className="h-full border-r border-gray-200 dark:border-gray-800" />
        <Separator orientation="vertical" className="h-full" />
        <div className="flex-1 overflow-auto bg-white">
          <div className="p-8">
            <h1 className="text-3xl font-bold">All Documents</h1>
            <p className="mt-4">Your documents will appear here.</p>
          </div>
        </div>
        <Toaster />
      </div>
    </SidebarProvider>
  );
} 