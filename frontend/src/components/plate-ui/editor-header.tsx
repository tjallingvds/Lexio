'use client';

import * as React from 'react';
import { useEffect, useState, KeyboardEvent } from 'react';
import { PanelLeftIcon, Save } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { updateDocument, fetchDocument } from '@/lib/api';
import { useEditorRef } from '@udecode/plate/react';

export function EditorHeader() {
  const { toggleSidebar, state } = useSidebar();
  const { id } = useParams();
  const [title, setTitle] = useState('Untitled Document');
  const [loading, setLoading] = useState(false);
  const editor = useEditorRef();
  
  useEffect(() => {
    if (id) {
      const loadDocument = async () => {
        try {
          const document = await fetchDocument(id);
          if (document) {
            setTitle(document.title);
          }
        } catch (error) {
          console.error('Error loading document:', error);
        }
      };
      
      loadDocument();
    }
  }, [id]);
  
  const handleTitleChange = (e: React.FormEvent<HTMLHeadingElement>) => {
    const newTitle = e.currentTarget.textContent;
    if (newTitle) {
      setTitle(newTitle);
    }
  };

  // Prevent new lines in title
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLHeadingElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur(); // Remove focus to trigger save
    }
  };
  
  const saveDocument = async (showToast = false) => {
    if (!id) return;
    
    setLoading(true);
    try {
      // Get the current editor content if available
      let contentString = '';
      
      if (editor && editor.children) {
        console.log('Saving editor content from header:', editor.children);
        contentString = JSON.stringify(editor.children);
      } else {
        console.warn('Editor reference not available for saving');
      }
      
      // Save both title and content
      const result = await updateDocument(id, title, contentString);
      
      if (result) {
        if (showToast) {
          toast.success('Document saved');
        }
        console.log('Save successful:', result);
      } else {
        console.error('No result returned from update');
        if (showToast) {
          toast.error('Error saving document');
        }
      }
    } catch (error) {
      console.error('Error saving document:', error);
      if (showToast) {
        toast.error('Failed to save document');
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex items-center justify-between border-b px-4 py-2 bg-white h-[41px]">
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
        
        {/* Title with transform approach to fix direction issues */}
        <input
          type="text"
          className="font-medium border-none outline-none bg-transparent p-0 m-0 max-w-[300px] whitespace-nowrap overflow-hidden text-ellipsis"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => saveDocument(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          style={{
            direction: 'ltr',
            textAlign: 'left'
          }}
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => saveDocument(true)}
        disabled={loading}
        className="text-xs"
      >
        <Save className="h-3.5 w-3.5 mr-1" />
        Save
      </Button>
    </div>
  );
} 