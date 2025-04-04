'use client';

import * as React from 'react';
import { useEffect, useState, KeyboardEvent, useRef } from 'react';
import { PanelLeftIcon, Save, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { updateDocument, fetchDocument } from '@/lib/api';
import { useEditorRef } from '@udecode/plate/react';
import { SaveState } from '@/components/editor/plate-editor';

interface EditorHeaderProps {
  documentId?: string;
}

export function EditorHeader({ documentId: propDocumentId }: EditorHeaderProps) {
  const { toggleSidebar, state } = useSidebar();
  const params = useParams();
  const routeId = params.id;
  
  // Fallback: Extract ID directly from URL path if route params fail
  const getIdFromPath = () => {
    const path = window.location.pathname;
    // Match the last segment in /editor/DOCUMENT_ID pattern
    const segments = path.split('/').filter(segment => segment.length > 0);
    
    // Make sure we don't treat "editor" as a document ID
    if (segments.length >= 2 && segments[segments.length - 2] === 'editor') {
      const potentialId = segments[segments.length - 1];
      // Make sure this isn't just the word "editor" again
      if (potentialId !== 'editor') {
        return potentialId;
      }
    }
    return null;
  };
  
  // Fallback: Try to get ID from localStorage
  const getIdFromLocalStorage = () => {
    try {
      return localStorage.getItem('last_created_document_id');
    } catch (e) {
      console.error('Failed to get document ID from localStorage:', e);
      return null;
    }
  };
  
  // Fallback: Try to get ID from global window object
  const getIdFromGlobalVar = () => {
    try {
      // First check the window variable
      if (typeof window !== 'undefined' && (window as any).__currentDocumentId) {
        return (window as any).__currentDocumentId;
      }
      
      // Then check sessionStorage which persists across navigation
      const sessionId = sessionStorage.getItem('current_document_id');
      if (sessionId) {
        // Also restore the global var if found in session
        if (typeof window !== 'undefined') {
          (window as any).__currentDocumentId = sessionId;
        }
        console.log('Restored document ID from sessionStorage:', sessionId);
        return sessionId;
      }
      
      return null;
    } catch (e) {
      console.error('Failed to get document ID from global window object or sessionStorage:', e);
      return null;
    }
  };
  
  // Use prop ID first, then route ID, then extracted path ID, then localStorage, then global var
  const id = propDocumentId || routeId || getIdFromPath() || getIdFromLocalStorage() || getIdFromGlobalVar();
  
  console.log("EditorHeader: propDocumentId=", propDocumentId, "params=", params, "routeId=", routeId, "extracted id=", getIdFromPath(), "localStorage id=", getIdFromLocalStorage(), "global id=", getIdFromGlobalVar(), "final id=", id);
  
  const [title, setTitle] = useState('Untitled Document');
  const [loading, setLoading] = useState(false);
  const editor = useEditorRef();
  const firstTitleLoad = useRef(true);
  const [saveState, setSaveState] = useState<SaveState>(SaveState.Saved);
  
  // Monitor global save state
  useEffect(() => {
    const checkSaveState = () => {
      if (typeof window !== 'undefined' && (window as any).__documentSaveState) {
        setSaveState((window as any).__documentSaveState);
      }
    };
    
    // Check initially
    checkSaveState();
    
    // Set up interval to check periodically
    const interval = setInterval(checkSaveState, 500);
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  // Ensure editor reference is valid
  useEffect(() => {
    if (editor) {
      console.log('Editor reference available in header');
    } else {
      console.warn('No editor reference available in header');
    }
  }, [editor]);
  
  useEffect(() => {
    if (id && firstTitleLoad.current) {
      const loadDocument = async () => {
        try {
          console.log('Loading document title for ID:', id);
          const document = await fetchDocument(id);
          if (document) {
            console.log('Document title loaded:', document.title);
            setTitle(document.title);
          } else {
            console.warn('Document not found for ID:', id);
          }
        } catch (error) {
          console.error('Error loading document title:', error);
        } finally {
          firstTitleLoad.current = false;
        }
      };
      
      loadDocument();
    } else {
      console.warn('No document ID available for loading title or not first load');
    }
    // Only run this effect once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
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
    // Final ID check with emergency extraction if still not found
    let effectiveId = id;
    
    if (!effectiveId) {
      // Try all possible sources for the document ID
      effectiveId = routeId || getIdFromPath() || getIdFromLocalStorage() || getIdFromGlobalVar();
      console.log("EMERGENCY ID EXTRACTION in saveDocument:", effectiveId);
    }
    
    if (!effectiveId) {
      console.error('Cannot save - no document ID available after multiple attempts');
      toast.error('Cannot save - document ID not found');
      return;
    }
    
    // Store the document ID in localStorage for future use
    try {
      localStorage.setItem('last_created_document_id', effectiveId);
      console.log('Stored document ID in localStorage:', effectiveId);
    } catch (e) {
      console.error('Failed to store document ID in localStorage:', e);
    }
    
    // Try to use global force save method if available (added by PlateEditor)
    if (typeof window !== 'undefined' && (window as any).__forceSave) {
      console.log('Using global __forceSave method');
      (window as any).__forceSave(); // This will handle showing toast messages
      return;
    }
    
    setLoading(true);
    console.log('Save document triggered, showToast:', showToast, 'Document ID:', effectiveId);
    
    try {
      // Get the current editor content if available
      let contentString = '';
      
      if (editor && editor.children) {
        console.log('Saving editor content from header, editor children:', JSON.stringify(editor.children).substring(0, 100) + '...');
        contentString = JSON.stringify(editor.children);
      } else {
        console.warn('Editor reference not available for saving, using fallback content');
        // Fall back to empty content, but continue to save the title
        contentString = JSON.stringify([{
          type: 'p',
          children: [{ text: '' }],
        }]);
      }
      
      // Save both title and content
      console.log('Calling updateDocument with id:', effectiveId, 'title:', title, 'contentLength:', contentString.length);
      const result = await updateDocument(effectiveId, title, contentString);
      
      if (result) {
        console.log('Save successful, document:', result.id);
        setSaveState(SaveState.Saved);
        if (showToast) {
          // Force toast to show
          toast.success('Document saved successfully');
        }
      } else {
        console.error('No result returned from update for document:', effectiveId);
        setSaveState(SaveState.Failed);
        if (showToast) {
          toast.error('Error saving document');
        }
      }
    } catch (error) {
      console.error('Error saving document:', error);
      setSaveState(SaveState.Failed);
      if (showToast) {
        toast.error('Failed to save document');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Get save indicator based on save state
  const getSaveIndicator = () => {
    switch (saveState) {
      case SaveState.Saved:
        return <Check className="h-3.5 w-3.5 mr-1 text-green-500" />;
      case SaveState.Saving:
        return <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />;
      case SaveState.Failed:
        return <AlertCircle className="h-3.5 w-3.5 mr-1 text-red-500" />;
      case SaveState.Unsaved:
      default:
        return <Save className="h-3.5 w-3.5 mr-1" />;
    }
  };
  
  // Get button text based on save state
  const getSaveButtonText = () => {
    switch (saveState) {
      case SaveState.Saved:
        return "Saved";
      case SaveState.Saving:
        return "Saving...";
      case SaveState.Failed:
        return "Retry";
      case SaveState.Unsaved:
      default:
        return "Save";
    }
  };
  
  return (
    <div className="flex items-center justify-between border-b px-4 py-2 bg-white h-[41px] sticky top-0 z-50">
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
          className="editor-header-title font-medium border-none outline-none bg-transparent p-0 m-0 max-w-[300px] whitespace-nowrap overflow-hidden text-ellipsis"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            // Explicitly save document when title input loses focus
            if (title.trim()) {
              saveDocument(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur(); // Trigger onBlur to save
            }
          }}
          style={{
            direction: 'ltr',
            textAlign: 'left'
          }}
        />
      </div>
      <Button
        variant={saveState === SaveState.Unsaved ? "default" : "ghost"}
        size="sm"
        onClick={() => saveDocument(true)}
        disabled={loading || saveState === SaveState.Saving}
        className={cn(
          "text-xs min-w-[80px]",
          saveState === SaveState.Unsaved && "bg-black hover:bg-gray-800"
        )}
      >
        {getSaveIndicator()}
        {getSaveButtonText()}
      </Button>
    </div>
  );
} 