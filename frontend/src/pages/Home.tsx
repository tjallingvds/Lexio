import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Document, fetchDocuments } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { PlusIcon, PanelLeftIcon, SendIcon, AtSignIcon } from 'lucide-react';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

function HomeHeader() {
  const { toggleSidebar, state } = useSidebar();
  
  return (
    <div className="flex items-center border-b px-4 py-2 bg-white h-[41px]">
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebar}
          className="h-6 w-6"
          aria-label={state === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <PanelLeftIcon className="h-3.5 w-3.5" />
        </Button>
        <h3 className="font-medium">Home</h3>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar className="h-full border-r border-gray-200 dark:border-gray-800" />
        <Separator orientation="vertical" className="h-full" />
        <div className="flex-1 overflow-auto flex flex-col bg-white">
          <HomeHeader />
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
            <div className="max-w-2xl w-full mx-auto">
              <h1 className="text-3xl font-bold text-center mb-4">Ready to write your next paper?</h1>
              <p className="text-center text-gray-600 mb-6">Mention the topic, drag and drop a file or chose an option to get started</p>
              
              <div className="border rounded-lg mb-6 p-3">
                <div className="flex items-center mb-1.5 justify-between">
                  <Button variant="ghost" size="sm" className="text-gray-500 flex items-center gap-1.5 text-xs">
                    <AtSignIcon className="h-3 w-3" />
                    Add context
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0">
                    <SendIcon className="h-4 w-4 text-gray-500" />
                  </Button>
                </div>
                <textarea 
                  className="w-full min-h-[80px] text-base resize-none border-0 focus:outline-none p-1" 
                  placeholder="Ask a question..."
                  rows={4}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Link to="/editor" className="border rounded-lg p-4 hover:shadow-md transition-all">
                  <div className="mb-1">
                    <PlusIcon className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium text-sm mb-0.5">Write</h3>
                  <p className="text-xs text-gray-500">Write and cite with AI</p>
                </Link>
                
                <div className="border rounded-lg p-4 hover:shadow-md transition-all">
                  <div className="mb-1">
                    <PlusIcon className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium text-sm mb-0.5">Import</h3>
                  <p className="text-xs text-gray-500">Chat with docs and videos</p>
                </div>
                
                <div className="border rounded-lg p-4 hover:shadow-md transition-all">
                  <div className="mb-1">
                    <PlusIcon className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium text-sm mb-0.5">Record</h3>
                  <p className="text-xs text-gray-500">Record and chat with audio</p>
                </div>
              </div>
              
              <div className="flex justify-center mt-6 gap-4 text-xs text-gray-400">
                <a href="#" className="hover:text-gray-600">Changelog</a>
                <a href="#" className="hover:text-gray-600">User guide</a>
                <a href="#" className="hover:text-gray-600">Careers</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
} 