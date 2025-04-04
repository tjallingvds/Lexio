'use client';

import * as React from 'react';
import { PanelLeftIcon } from 'lucide-react';

import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function EditorHeader() {
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
        <h3 className="font-medium" contentEditable suppressContentEditableWarning>
          Playground
        </h3>
      </div>
    </div>
  );
} 