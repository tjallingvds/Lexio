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
import { SaveIndicator } from '@/components/editor/save-indicator';

// Save states for tracking
export enum SaveState {
  Saved = 'saved',
  Saving = 'saving',
  Unsaved = 'unsaved',
  Failed = 'failed'
}

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
    const [saveState, setSaveState] = useState<SaveState>(SaveState.Saved);
    const pendingSave = useRef<Value | null>(null);
    const saveQueue = useRef<Value[]>([]);
    const isSaving = useRef(false);
    const lastSavedContent = useRef<string>('');
    const currentDocumentId = useRef<string | null>(null);
    
    console.log('PlateEditor rendering with document ID:', id, 'isNewDocument:', isNewDocument);
    
    // Create editor
    const editor = useCreateEditor();
    
    // Flag to track if we've loaded real content
    const hasLoadedRealContent = useRef(false);
    
    // Process save queue
    const processSaveQueue = useCallback(async (isManualSave = false) => {
      if (isSaving.current || saveQueue.current.length === 0) {
        return;
      }
      
      // Get the most reliable ID
      let effectiveId = id;
      if (!effectiveId) {
        // Try all possible sources for the document ID
        effectiveId = propDocumentId || getIdFromPath() || getIdFromLocalStorage() || getIdFromGlobalVar();
        console.log("EMERGENCY ID EXTRACTION in processSaveQueue:", effectiveId);
      }
      
      // Ensure we're saving to the correct document
      if (currentDocumentId.current && effectiveId !== currentDocumentId.current) {
        console.error(`Document ID mismatch! Expected: ${currentDocumentId.current}, Got: ${effectiveId}`);
        
        // Handle the ID mismatch - reload the correct document
        if (currentDocumentId.current) {
          console.warn(`Document ID mismatch detected - saving cancelled. Current: ${currentDocumentId.current}, Attempted: ${effectiveId}`);
          setSaveState(SaveState.Failed);
          toast.error("Document ID mismatch detected. Please reload the page.");
          return;
        }
      }
      
      isSaving.current = true;
      setSaveState(SaveState.Saving);
      
      // Take the latest content from the queue
      const contentToSave = saveQueue.current[saveQueue.current.length - 1];
      saveQueue.current = []; // Clear the queue since we're taking the latest
      
      if (!effectiveId) {
        console.error('Cannot save - no document ID available after multiple attempts');
        if (isManualSave) {
          toast.error('Cannot save - document ID not found');
        }
        setSaveState(SaveState.Failed);
        isSaving.current = false;
        return;
      }
      
      try {
        console.log('Saving content to document ID:', effectiveId);
        const contentString = JSON.stringify(contentToSave);
        
        // Store this as the last saved content
        lastSavedContent.current = contentString;
        
        // Try to get current title to preserve it
        let currentTitle;
        try {
          // First try to find the title in the DOM
          const titleInput = document.querySelector('.editor-header-title') as HTMLInputElement;
          if (titleInput && titleInput.value) {
            currentTitle = titleInput.value;
          } else {
            // If not found in DOM, try to load from server
            const document = await fetchDocument(effectiveId);
            if (document && document.title) {
              currentTitle = document.title;
            }
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
          setSaveState(SaveState.Saved);
          
          // Share save state globally
          if (typeof window !== 'undefined') {
            (window as any).__documentSaveState = SaveState.Saved;
          }
          
          // Only show success toast for manual saves
          if (isManualSave) {
            toast.success('Document saved');
          }
        } else {
          console.error('Failed to save content, no result returned for document ID:', effectiveId);
          setSaveState(SaveState.Failed);
          if (isManualSave) {
            toast.error('Failed to save document');
          }
        }
      } catch (error) {
        console.error('Error saving content to document ID:', effectiveId, error);
        if (isManualSave) {
          toast.error('Failed to save content');
        }
        setSaveState(SaveState.Failed);
      } finally {
        isSaving.current = false;
        
        // Process any new items that were added to the queue while we were saving
        if (saveQueue.current.length > 0) {
          processSaveQueue(isManualSave);
        }
      }
    }, [id, getIdFromPath, propDocumentId, getIdFromLocalStorage, getIdFromGlobalVar]);
    
    // Queue content for saving
    const queueContentForSave = useCallback((contentValue: Value, isManualSave = false) => {
      // For auto-saves, check if content has actually changed
      if (!isManualSave) {
        const contentString = JSON.stringify(contentValue);
        if (contentString === lastSavedContent.current) {
          console.log('Content unchanged, skipping save');
          return;
        }
      }
      
      saveQueue.current.push(contentValue);
      setSaveState(SaveState.Unsaved);
      
      // Share save state globally
      if (typeof window !== 'undefined') {
        (window as any).__documentSaveState = SaveState.Unsaved;
      }
      
      // Start processing the queue if not already processing
      if (!isSaving.current) {
        processSaveQueue(isManualSave);
      }
    }, [processSaveQueue]);
    
    // Save content function - now queues save operations
    const saveContent = useCallback(async (contentValue: Value, isManualSave = false) => {
      queueContentForSave(contentValue, isManualSave);
    }, [queueContentForSave]);
    
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
      
      // Ensure we create a standard, clean empty paragraph
      const emptyContent = [{
        type: 'p',
        children: [{ text: '' }],
      }];
      
      if (editor) {
        // Make sure we're not inheriting any unexpected cached content
        console.log('Setting editor children to empty content');
        
        // Clear the editor completely before setting empty content
        if (editor.children && editor.children.length > 0) {
          editor.children = [];
        }
        
        // Apply our empty content template
        editor.children = emptyContent;
        setContent(emptyContent);
        
        // Reset the flag since we're now using empty content
        hasLoadedRealContent.current = false;
        
        // Also save this empty content to avoid issues later
        if (effectiveId) {
          console.log('Saving empty content to document ID:', effectiveId);
          // Ensure we're using the latest editor instance by getting children directly
          const contentToSave = editor.children;
          lastSavedContent.current = JSON.stringify(contentToSave);
          saveContent(contentToSave, false);
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
      
      // Set the current document ID as soon as we know it
      if (effectiveId) {
        currentDocumentId.current = effectiveId;
        console.log('Set current document ID reference:', effectiveId);
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
                  
                  // ENHANCED VALIDATION: Check for playground content signatures before using
                  const contentString = JSON.stringify(parsedContent);
                  const playgroundSignatures = [
                    'playground',
                    'example content',
                    'sample text',
                    'template'
                  ];
                  
                  const hasPlaygroundContent = playgroundSignatures.some(signature => 
                    contentString.toLowerCase().includes(signature.toLowerCase())
                  );
                  
                  if (hasPlaygroundContent) {
                    console.error('Detected playground content in loaded document, refusing to use it');
                    initializeWithEmptyContent();
                    return;
                  }
                  
                  // Validate the content structure to ensure it's not corrupted
                  const isValidContent = Array.isArray(parsedContent) && 
                                        parsedContent.length > 0 && 
                                        parsedContent.every(node => typeof node === 'object' && node.type);
                  
                  if (isValidContent) {
                    // Update the editor content only if valid
                    if (editor) {
                      console.log('Setting editor children:', parsedContent);
                      editor.children = parsedContent;
                      setContent(parsedContent);
                      lastSavedContent.current = JSON.stringify(parsedContent);
                      hasLoadedRealContent.current = true; // Mark that we've loaded real content
                    } else {
                      console.error('Editor reference not available when loading content');
                      initializeWithEmptyContent(); // Fall back to empty content
                    }
                  } else {
                    console.error('Invalid content structure, falling back to empty content');
                    initializeWithEmptyContent();
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
        initializeWithEmptyContent(); // Initialize with empty content rather than showing nothing
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
        // Only send content to AI chat after we're sure it's been loaded from the server
        if (editor.children && !isLoading && !firstLoad.current) {
          // Make sure we're not sending playground content
          const contentString = JSON.stringify(editor.children);
          const playgroundSignatures = [
            'playground',
            'example content',
            'sample text',
            'template'
          ];
          
          const hasPlaygroundContent = playgroundSignatures.some(signature => 
            contentString.toLowerCase().includes(signature.toLowerCase())
          );
          
          if (!hasPlaygroundContent) {
            console.log('Sending loaded document content to AI chat');
            window.postMessage(
              { 
                type: 'editor-content', 
                content: contentString
              }, 
              window.location.origin
            );
          }
        }
      }
    }, [editor, id, isLoading, firstLoad]);
    
    // Add document ID change detection
    useEffect(() => {
      // If we already have a current document ID and it suddenly changes, that's suspicious
      if (currentDocumentId.current && id && currentDocumentId.current !== id) {
        console.error(`Document ID changed unexpectedly from ${currentDocumentId.current} to ${id}`);
        toast.error("Document ID changed unexpectedly. Please reload the page.");
      }
    }, [id]);
    
    // Override the useState hook for content to add protection
    const safeSetContent = (newContent: Value | null) => {
      // Skip if the content is null or undefined (shouldn't happen)
      if (!newContent) return;
      
      // If we have a playground signature, prevent the content from being set
      const contentString = JSON.stringify(newContent);
      const playgroundSignatures = [
        'playground',
        'example content',
        'sample text',
        'template'
      ];
      
      const hasPlaygroundContent = playgroundSignatures.some(signature => 
        contentString.toLowerCase().includes(signature.toLowerCase())
      );
      
      if (hasPlaygroundContent) {
        console.warn('Blocked attempt to set playground content');
        return;
      }
      
      // Otherwise proceed with setting content
      setContent(newContent);
    };
    
    // Modify handleEditorChange to use safeSetContent
    const handleEditorChange = useCallback(
      (options: { editor: any; value: Value }) => {
        const { value } = options;
        
        // Log every change for debugging
        console.log('Editor onChange triggered with value:', value);
        
        // Extra protection: If we've loaded real content, check for suspicious changes
        if (hasLoadedRealContent.current) {
          const contentString = JSON.stringify(value);
          const playgroundSignatures = [
            'playground',
            'example content',
            'sample text',
            'template'
          ];
          
          const hasPlaygroundContent = playgroundSignatures.some(signature => 
            contentString.toLowerCase().includes(signature.toLowerCase())
          );
          
          if (hasPlaygroundContent) {
            console.error('CRITICAL: Blocked attempt to replace real content with playground content');
            // Restore last known good content if available
            if (lastSavedContent.current) {
              try {
                const lastGoodContent = JSON.parse(lastSavedContent.current);
                if (editor) {
                  console.log('Restoring last good content');
                  editor.children = lastGoodContent;
                  setContent(lastGoodContent);
                }
              } catch (e) {
                console.error('Error restoring content:', e);
              }
            }
            return;
          }
        }
        
        // Use safe function instead of directly setting content
        safeSetContent(value);
        
        // Store the pending save content
        pendingSave.current = value;
        
        // Check if content has changed from last saved content
        const contentString = JSON.stringify(value);
        if (contentString !== lastSavedContent.current) {
          // Mark as unsaved immediately
          setSaveState(SaveState.Unsaved);
          
          // Share save state globally
          if (typeof window !== 'undefined') {
            (window as any).__documentSaveState = SaveState.Unsaved;
          }
          
          // Use debounce to avoid too frequent saves
          const debouncedSave = debounce(() => {
            console.log('Debounced save running for value:', pendingSave.current);
            if (pendingSave.current) {
              saveContent(pendingSave.current, false); // Not a manual save
              
              // Send content to AI chat via window messaging
              window.postMessage(
                { 
                  type: 'editor-content', 
                  content: JSON.stringify(pendingSave.current)
                }, 
                window.location.origin
              );
              
              // Clear pending save
              pendingSave.current = null;
            }
          }, 1000);
          
          debouncedSave();
          
          // Make sure to cancel the debounced function on component unmount
          return () => {
            // If we have a pending save that's being cancelled, queue it now
            if (pendingSave.current) {
              console.log('Saving pending content before cancel');
              saveContent(pendingSave.current, false);
              pendingSave.current = null;
            }
            debouncedSave.cancel();
          };
        }
        
        // No cleanup needed if no changes
        return undefined;
      },
      [saveContent]
    );

    // Force immediate save
    const forceSave = useCallback(() => {
      if (!editor || !id) {
        console.error('Cannot forceSave - editor or ID not available');
        toast.error('Cannot save - editor not ready');
        return;
      }
      
      console.log('forceSave triggered for document ID:', id);
      const currentContent = editor.children;
      
      // Clear queue and immediately save this content
      saveQueue.current = [currentContent];
      processSaveQueue(true); // This is a manual save
      
      // Call the provided callback if any
      if (onForceSave) {
        onForceSave();
      }
    }, [editor, id, onForceSave, processSaveQueue]);

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
      forceSave
    }), [forceSave]);
    
    // Manual save function - calls the Force Save
    const manualSave = useCallback(() => {
      forceSave();
    }, [forceSave]);
    
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
            saveContent(editor.children, true);
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
        console.log('Exposing forceSave method globally');
        (window as any).__forceSave = forceSave;
        
        // Also expose the save state
        (window as any).__documentSaveState = saveState;
      }
      
      return () => {
        if (typeof window !== 'undefined') {
          delete (window as any).__forceSave;
          delete (window as any).__documentSaveState;
        }
      };
    }, [editor, forceSave, saveState]);

    // Save before unload to prevent data loss
    useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (saveState === SaveState.Unsaved) {
          // Force save content before page unload
          if (editor && pendingSave.current) {
            queueContentForSave(pendingSave.current, true);
          } else if (editor && editor.children) {
            queueContentForSave(editor.children, true);
          }
          
          // Standard way to show "unsaved changes" dialog
          e.preventDefault();
          e.returnValue = '';
          return '';
        }
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }, [editor, saveState, queueContentForSave]);

    // Add a function to watch for unwanted content and reset if needed
    useEffect(() => {
      if (!editor || !content) return;
      
      // Check if content looks like unexpected "playground" content
      const contentString = JSON.stringify(content);
      
      // Look for playground signatures (add more if you discover specific patterns)
      const playgroundSignatures = [
        'playground',
        'example content',
        'sample text',
        'template'
      ];
      
      const hasPlaygroundContent = playgroundSignatures.some(signature => 
        contentString.toLowerCase().includes(signature.toLowerCase())
      );
      
      if (hasPlaygroundContent) {
        console.warn('Detected potential playground content, resetting to empty document');
        initializeWithEmptyContent();
      }
    }, [content, editor, initializeWithEmptyContent]);

    if (isLoading) {
      return <div className="flex items-center justify-center h-full">Loading document...</div>;
    }

    return (
      <div className="h-full flex flex-col">
        <DndProvider backend={HTML5Backend}>
          <Plate 
            editor={editor}
            onChange={handleEditorChange}
            initialValue={content || undefined}
          >
            <div className="flex flex-col h-full">
              {/* The FixedToolbarPlugin adds header and toolbar here */}
              
              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto">
                <EditorContainer>
                  <Editor variant="demo" />
                </EditorContainer>
              </div>
            </div>
            
            <SettingsDialog />
          </Plate>
        </DndProvider>
        
        <SaveIndicator saveState={saveState} className="fixed bottom-2 right-2 z-10 flex items-center" />
        <Toaster position="top-right" />
      </div>
    );
  }
);
