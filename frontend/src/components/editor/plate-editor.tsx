'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import debounce from 'lodash/debounce';
import { useParams, useLocation } from 'react-router-dom';
import { toast, Toaster } from 'sonner';

import { Plate } from '@udecode/plate/react';
import { Value } from '@udecode/plate';

import { useCreateEditor } from '@/components/editor/use-create-editor';
import { SettingsDialog } from '@/components/editor/settings';
import { Editor, EditorContainer } from '@/components/plate-ui/editor';
import { updateDocument, fetchDocument } from '@/lib/api';

export interface PlateEditorProps {
  onForceSave?: () => void;
  documentId?: string | null;
}

export const PlateEditor = React.forwardRef<{ forceSave?: () => void }, PlateEditorProps>(
  function PlateEditorComponent({ onForceSave, documentId: propDocumentId }, ref) {
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
    
    // Check localStorage for last created document ID as a fallback
    const getIdFromLocalStorage = () => {
      try {
        return localStorage.getItem('last_created_document_id');
      } catch (e) {
        console.error('Failed to get document ID from localStorage:', e);
        return null;
      }
    };
    
    // Check for globally stored document ID as another fallback
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
    // This ensures we always have the most reliable ID available
    const id = propDocumentId || routeId || getIdFromPath() || getIdFromLocalStorage() || getIdFromGlobalVar();
    
    console.log("PlateEditor: propDocumentId=", propDocumentId, "params=", params, "routeId=", routeId, "extracted id=", getIdFromPath(), "localStorage id=", getIdFromLocalStorage(), "global id=", getIdFromGlobalVar(), "final id=", id);
    
    // Share ID globally as soon as we have it
    useEffect(() => {
      if (id) {
        console.log('Sharing document ID globally from PlateEditor:', id);
        try {
          // Set global variable
          if (typeof window !== 'undefined') {
            (window as any).__currentDocumentId = id;
          }
          
          // Store in sessionStorage for persistence
          sessionStorage.setItem('current_document_id', id);
          
          // Also update localStorage for longer-term storage
          localStorage.setItem('last_created_document_id', id);
        } catch (e) {
          console.error('Failed to share document ID globally:', e);
        }
      }
    }, [id]);
    
    const location = useLocation();
    const isNewDocument = new URLSearchParams(location.search).get('new') === 'true';
    const [isLoading, setIsLoading] = useState(true);
    const [content, setContent] = useState<Value | null>(null);
    const firstLoad = useRef(true);
    const initialSaveDone = useRef(false);
    
    console.log('PlateEditor rendering with document ID:', id, 'isNewDocument:', isNewDocument);
    
    // Create editor
    const editor = useCreateEditor();
    
    // Save content function
    const saveContent = useCallback(async (contentValue: Value) => {
      // Final ID check with emergency extraction if still not found
      let effectiveId = id;
      
      if (!effectiveId) {
        // Try all possible sources for the document ID
        effectiveId = propDocumentId || getIdFromPath() || getIdFromLocalStorage() || getIdFromGlobalVar();
        console.log("EMERGENCY ID EXTRACTION in saveContent:", effectiveId);
      }
      
      if (!effectiveId) {
        console.error('Cannot save - no document ID available after multiple attempts');
        toast.error('Cannot save - document ID not found');
        return;
      }
      
      try {
        console.log('Saving content to document ID:', effectiveId);
        const contentString = JSON.stringify(contentValue);
        
        // Try to get current title to preserve it
        let currentTitle;
        try {
          // First try to load the current title from the document
          const document = await fetchDocument(effectiveId);
          if (document && document.title) {
            currentTitle = document.title;
          }
        } catch (err) {
          console.error('Error fetching current title:', err);
        }
        
        // Use the proper endpoint to update content
        const result = await updateDocument(
          effectiveId, 
          currentTitle, // Pass the current title to preserve it
          contentString
        );
        
        if (result) {
          console.log('Content saved successfully to document ID:', effectiveId, result);
        } else {
          console.error('Failed to save content, no result returned for document ID:', effectiveId);
        }
      } catch (error) {
        console.error('Error saving content to document ID:', effectiveId, error);
        toast.error('Failed to save content');
      }
    }, [id, getIdFromPath, propDocumentId, getIdFromLocalStorage, getIdFromGlobalVar]);
    
    // Helper function to initialize with empty content
    const initializeWithEmptyContent = useCallback(() => {
      // Get the most reliable ID
      let effectiveId = id;
      if (!effectiveId) {
        // Try all possible sources for the document ID
        effectiveId = propDocumentId || getIdFromPath() || getIdFromLocalStorage() || getIdFromGlobalVar();
        console.log("EMERGENCY ID EXTRACTION in initializeWithEmptyContent:", effectiveId);
      }
      
      console.log('Initializing with empty content for document ID:', effectiveId);
      
      const emptyContent = [{
        type: 'p',
        children: [{ text: '' }],
      }];
      
      if (editor) {
        console.log('Setting editor children to empty content');
        editor.children = emptyContent;
        setContent(emptyContent);
        
        // Also save this empty content to avoid issues later
        if (effectiveId) {
          console.log('Saving empty content to document ID:', effectiveId);
          // Ensure we're using the latest editor instance by getting children directly
          const contentToSave = editor.children;
          saveContent(contentToSave);
        } else {
          console.error('Cannot save empty content - no document ID available');
        }
      } else {
        console.error('Cannot initialize with empty content - editor is not available');
      }
    }, [editor, id, saveContent, getIdFromPath, propDocumentId, getIdFromLocalStorage, getIdFromGlobalVar]);
    
    // Load the document content when the component mounts
    useEffect(() => {
      // Get the most reliable ID
      let effectiveId = id;
      if (!effectiveId) {
        // Try all possible sources for the document ID
        effectiveId = propDocumentId || getIdFromPath() || getIdFromLocalStorage() || getIdFromGlobalVar();
        console.log("EMERGENCY ID EXTRACTION in document loading:", effectiveId);
      }
      
      if (effectiveId && firstLoad.current) {
        console.log('Starting to load document with ID:', effectiveId);
        const loadContent = async () => {
          try {
            setIsLoading(true);
            console.log('Fetching document with ID:', effectiveId);
            const document = await fetchDocument(effectiveId);
            console.log('Loaded document:', document);
            
            if (document) {
              if (document.content) {
                try {
                  // Try to parse the content if it's a JSON string
                  console.log('Attempting to parse document content:', document.content.substring(0, 100) + '...');
                  const parsedContent = JSON.parse(document.content);
                  console.log('Parsed content successfully:', parsedContent);
                  
                  // Update the editor content
                  if (editor) {
                    console.log('Setting editor children:', parsedContent);
                    editor.children = parsedContent;
                    setContent(parsedContent);
                  } else {
                    console.error('Editor reference not available when loading content');
                  }
                } catch (parseError) {
                  console.error('Error parsing JSON content:', parseError);
                  // If not valid JSON, use a fallback
                  console.log('Falling back to empty content due to parse error');
                  initializeWithEmptyContent();
                }
              } else {
                // If document exists but content is empty, initialize with empty paragraph
                console.log('Document has no content, initializing with empty paragraph');
                initializeWithEmptyContent();
              }
            } else {
              console.error('Document not found for ID:', effectiveId);
              toast.error('Document not found');
              initializeWithEmptyContent();
            }
          } catch (error) {
            console.error('Error loading document content for ID:', effectiveId, error);
            toast.error('Failed to load document content');
            initializeWithEmptyContent();
          } finally {
            setIsLoading(false);
            firstLoad.current = false;
          }
        };
        
        loadContent();
      } else if (!effectiveId) {
        console.log('Skipping document load - no ID available. Setting isLoading to false.');
        setIsLoading(false);
      } else if (!firstLoad.current) {
        console.log('Skipping document load - not first load. ID:', effectiveId);
        setIsLoading(false);
      }
      // We run this effect only once when the component mounts
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    // Monitor for changes in the editor and save
    useEffect(() => {
      if (editor && id) {
        // Send initial content to AI chat
        if (editor.children) {
          window.postMessage(
            { 
              type: 'editor-content', 
              content: JSON.stringify(editor.children)
            }, 
            window.location.origin
          );
        }
      }
    }, [editor, id]);
    
    // Handle editor content changes
    const handleEditorChange = useCallback(
      (options: { editor: any; value: Value }) => {
        const { value } = options;
        
        // Log every change for debugging
        console.log('Editor onChange triggered with value:', value);
        
        // Use debounce to avoid too frequent saves
        const debouncedSave = debounce(() => {
          console.log('Debounced save running for value:', value);
          setContent(value);
          saveContent(value);
          
          // Send content to AI chat via window messaging
          window.postMessage(
            { 
              type: 'editor-content', 
              content: JSON.stringify(value)
            }, 
            window.location.origin
          );
        }, 1000);
        
        debouncedSave();
        
        // Make sure to cancel the debounced function on component unmount
        return () => {
          debouncedSave.cancel();
        };
      },
      [id, saveContent, getIdFromLocalStorage, getIdFromGlobalVar]
    );

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
      forceSave: () => {
        if (editor && id) {
          console.log('forceSave triggered via ref for document ID:', id);
          const currentContent = editor.children;
          saveContent(currentContent);
          toast.success('Document saved');
          
          // Also call the onForceSave prop if provided
          if (onForceSave) {
            onForceSave();
          }
        } else {
          console.error('Cannot forceSave - editor or ID not available');
          toast.error('Cannot save - editor not ready');
        }
      }
    }), [editor, id, saveContent, onForceSave]);
    
    // Manual save function - implement directly
    const manualSave = useCallback(() => {
      if (editor && editor.children && id) {
        console.log('Manual save triggered with content length:', editor.children.length);
        const currentContent = editor.children;
        saveContent(currentContent);
        toast.success('Document saved');
      } else {
        console.error('Manual save failed - missing editor, content or document ID');
        toast.error('Could not save - editor not ready');
      }
    }, [editor, id, saveContent]);
    
    // Add a keyboard shortcut for saving (Cmd+S or Ctrl+S)
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
          e.preventDefault();
          manualSave();
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [manualSave]);

    // Special handler for new documents to ensure content is saved
    useEffect(() => {
      // Get the most reliable ID
      let effectiveId = id;
      if (!effectiveId) {
        // Try all possible sources for the document ID
        effectiveId = propDocumentId || getIdFromPath() || getIdFromLocalStorage() || getIdFromGlobalVar();
        console.log("EMERGENCY ID EXTRACTION in new document handler:", effectiveId);
      }
      
      // Only run this effect for new documents that haven't been saved yet
      if (effectiveId && isNewDocument && editor && !initialSaveDone.current) {
        console.log('Detected new document, ensuring content is saved initially for ID:', effectiveId);
        
        // Short delay to ensure editor is fully initialized
        const timer = setTimeout(() => {
          if (editor.children) {
            console.log('Performing initial save for new document:', effectiveId);
            saveContent(editor.children);
            initialSaveDone.current = true;
            
            // Store document ID in localStorage for fallback
            try {
              localStorage.setItem('last_created_document_id', effectiveId);
              console.log('Stored document ID in localStorage:', effectiveId);
              
              // Also store in sessionStorage for cross-navigation persistence
              sessionStorage.setItem('current_document_id', effectiveId);
              console.log('Stored document ID in sessionStorage:', effectiveId);
              
              // Update the global variable
              if (typeof window !== 'undefined') {
                (window as any).__currentDocumentId = effectiveId;
                console.log('Updated global document ID variable:', effectiveId);
              }
            } catch (e) {
              console.error('Failed to store document ID in storage:', e);
            }
            
            // Remove the 'new' flag from URL to prevent re-saves on refresh
            if (window.history) {
              const newUrl = window.location.pathname;
              window.history.replaceState({}, '', newUrl);
            }
          } else {
            console.error('Editor not properly initialized for new document');
          }
        }, 500);
        
        return () => clearTimeout(timer);
      }
    }, [id, isNewDocument, editor, saveContent, getIdFromPath, propDocumentId, getIdFromLocalStorage, getIdFromGlobalVar]);

    // Expose forceSave method globally for header to use
    useEffect(() => {
      if (typeof window !== 'undefined' && editor) {
        const getFinalId = () => {
          // Use all available methods to get the ID, in order of reliability
          let finalId = id;
          if (!finalId) {
            finalId = propDocumentId || getIdFromPath() || getIdFromLocalStorage() || getIdFromGlobalVar();
            console.log("EMERGENCY ID EXTRACTION in global forceSave:", finalId);
          }
          return finalId;
        };
        
        console.log('Exposing forceSave method globally');
        (window as any).__forceSave = () => {
          const finalId = getFinalId();
          if (!finalId) {
            console.error('Global forceSave: Cannot save - no document ID available');
            toast.error('Cannot save - document ID not found');
            return;
          }
          
          console.log('Global forceSave called for document ID:', finalId);
          const currentContent = editor.children;
          
          // Get current title from document if available
          let currentTitle;
          try {
            // Try to find the title input field in the EditorHeader
            const titleInput = document.querySelector('.editor-header-title') as HTMLInputElement;
            if (titleInput && titleInput.value) {
              currentTitle = titleInput.value;
              console.log('Found document title for saving:', currentTitle);
            }
          } catch (e) {
            console.error('Error getting document title:', e);
          }
          
          // Use the current title if available, otherwise just save content
          if (currentTitle) {
            // Save both title and content
            updateDocument(finalId, currentTitle, JSON.stringify(currentContent))
              .then(result => {
                if (result) {
                  console.log('Content and title saved successfully');
                  toast.success('Document saved');
                } else {
                  console.error('Failed to save document');
                  toast.error('Failed to save document');
                }
              })
              .catch(err => {
                console.error('Error saving document:', err);
                toast.error('Failed to save document');
              });
          } else {
            // Just save content
            saveContent(currentContent);
            toast.success('Document saved');
          }
        };
      }
      
      return () => {
        if (typeof window !== 'undefined') {
          delete (window as any).__forceSave;
        }
      };
    }, [editor, id, saveContent, getIdFromPath, propDocumentId, getIdFromLocalStorage, getIdFromGlobalVar]);

    if (isLoading) {
      return <div className="flex items-center justify-center h-full">Loading document...</div>;
    }

    return (
      <div className="bg-white h-full">
        <DndProvider backend={HTML5Backend}>
          <Plate 
            editor={editor}
            onChange={handleEditorChange}
          >
            <EditorContainer>
              <Editor variant="demo" />
            </EditorContainer>

            <SettingsDialog />
          </Plate>
        </DndProvider>
        <Toaster />
      </div>
    );
  }
);
