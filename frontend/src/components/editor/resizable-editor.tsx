'use client';

import React, { useRef } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

import { PlateEditor } from '@/components/editor/plate-editor';
import { AiChat } from '@/components/plate-ui/ai-chat';
import { toast } from 'sonner';

interface ResizableEditorProps {
  documentId?: string | null;
}

export function ResizableEditor({ documentId }: ResizableEditorProps) {
  const [chatOpen, setChatOpen] = React.useState(true);
  const editorRef = useRef<{ forceSave?: () => void }>(null);

  // Handler to force save document
  const handleForceSave = () => {
    if (editorRef.current && editorRef.current.forceSave) {
      console.log('Triggering force save from ResizableEditor with document ID:', documentId);
      editorRef.current.forceSave();
    } else {
      console.error('Force save not available - editor ref not properly set up');
      toast.error('Cannot save right now');
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel 
        defaultSize={70} 
        minSize={30}
        className="h-full flex flex-col bg-white"
      >
        <PlateEditor ref={editorRef} onForceSave={handleForceSave} documentId={documentId} />
      </ResizablePanel>
      
      <ResizableHandle withHandle />
      
      <ResizablePanel 
        defaultSize={30} 
        minSize={20}
        maxSize={50}
        className="h-full flex flex-col"
      >
        <AiChat />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
} 