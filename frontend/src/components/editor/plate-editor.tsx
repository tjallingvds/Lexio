'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import debounce from 'lodash/debounce';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Plate } from '@udecode/plate/react';
import { Value } from '@udecode/plate';

import { useCreateEditor } from '@/components/editor/use-create-editor';
import { SettingsDialog } from '@/components/editor/settings';
import { Editor, EditorContainer } from '@/components/plate-ui/editor';
import { updateDocument, fetchDocument } from '@/lib/api';

export function PlateEditor() {
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState<Value | null>(null);
  const firstLoad = useRef(true);
  
  // Create editor
  const editor = useCreateEditor();
  
  // Load the document content when the component mounts
  useEffect(() => {
    if (id && firstLoad.current) {
      const loadContent = async () => {
        try {
          setIsLoading(true);
          const document = await fetchDocument(id);
          console.log('Loaded document:', document);
          
          if (document && document.content) {
            try {
              // Try to parse the content if it's a JSON string
              const parsedContent = JSON.parse(document.content);
              console.log('Parsed content:', parsedContent);
              
              // Update the editor content
              if (editor) {
                editor.children = parsedContent;
                setContent(parsedContent);
              }
            } catch (parseError) {
              console.error('Error parsing JSON content:', parseError);
              // If not valid JSON, use as is
              const fallbackContent = [{
                type: 'p',
                children: [{ text: document.content }],
              }];
              
              // Update the editor content
              if (editor) {
                editor.children = fallbackContent;
                setContent(fallbackContent);
              }
            }
          }
        } catch (error) {
          console.error('Error loading document content:', error);
          toast.error('Failed to load document content');
        } finally {
          setIsLoading(false);
          firstLoad.current = false;
        }
      };
      
      loadContent();
    } else {
      setIsLoading(false);
    }
  }, [id, editor]);
  
  // Monitor for changes in the editor and save
  useEffect(() => {
    if (editor && id) {
      // Function to capture editor's current content
      const captureContent = () => {
        if (editor.children) {
          console.log('Editor content changed:', editor.children);
          setContent(editor.children);
          saveContent(editor.children);
          
          // Send content to AI chat via window messaging
          window.postMessage(
            { 
              type: 'editor-content', 
              content: JSON.stringify(editor.children)
            }, 
            window.location.origin
          );
        }
      };
      
      // Add a listener to document to detect keyup (content changes)
      const handleContentChange = debounce(() => {
        captureContent();
      }, 500);
      
      document.addEventListener('keyup', handleContentChange);
      
      // Initial content update
      if (editor.children) {
        window.postMessage(
          { 
            type: 'editor-content', 
            content: JSON.stringify(editor.children)
          }, 
          window.location.origin
        );
      }
      
      // Remove event listener on cleanup
      return () => {
        document.removeEventListener('keyup', handleContentChange);
        handleContentChange.cancel();
      };
    }
  }, [editor, id]);
  
  // Save content function
  const saveContent = async (contentValue: Value) => {
    if (!id) return;
    
    try {
      console.log('Saving content:', contentValue);
      const contentString = JSON.stringify(contentValue);
      
      // Use the proper endpoint to update content
      const result = await updateDocument(id, undefined, contentString);
      
      if (result) {
        console.log('Content saved successfully:', result);
      } else {
        console.error('Failed to save content, no result returned');
      }
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error('Failed to save content');
    }
  };
  
  // Manual save function 
  const manualSave = useCallback(() => {
    if (editor && editor.children && id) {
      console.log('Manual save triggered with content:', editor.children);
      saveContent(editor.children);
      toast.success('Document saved');
    }
  }, [editor, id]);
  
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

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading document...</div>;
  }

  return (
    <div className="bg-white h-full">
      <DndProvider backend={HTML5Backend}>
        <Plate 
          editor={editor}
          onChange={() => {
            console.log('Plate onChange triggered');
            if (editor && editor.children) {
              console.log('Current editor content:', editor.children);
            }
          }}
        >
          <EditorContainer>
            <Editor variant="demo" />
          </EditorContainer>

          <SettingsDialog />
        </Plate>
      </DndProvider>
    </div>
  );
}
