'use client';

import React from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

import { PlateEditor } from '@/components/editor/plate-editor';
import { AiChat } from '@/components/plate-ui/ai-chat';

export function ResizableEditor() {
  const [chatOpen, setChatOpen] = React.useState(true);

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel 
        defaultSize={70} 
        minSize={30}
        className="h-full"
      >
        <PlateEditor />
      </ResizablePanel>
      
      <ResizableHandle withHandle />
      
      <ResizablePanel 
        defaultSize={30} 
        minSize={20}
        maxSize={50}
        className="h-full"
      >
        <AiChat />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
} 