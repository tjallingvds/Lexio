'use client';

import { createPlatePlugin } from '@udecode/plate/react';
import { useEditorRef } from '@udecode/plate/react';

import { FixedToolbar } from '@/components/plate-ui/fixed-toolbar';
import { FixedToolbarButtons } from '@/components/plate-ui/fixed-toolbar-buttons';
import { EditorHeader } from '@/components/plate-ui/editor-header';

export const FixedToolbarPlugin = createPlatePlugin({
  key: 'fixed-toolbar',
  render: {
    beforeEditable: () => {
      // Try to get document ID from global window object or sessionStorage
      let documentId = null;
      try {
        if (typeof window !== 'undefined') {
          // Try window global first
          if ((window as any).__currentDocumentId) {
            documentId = (window as any).__currentDocumentId;
          }
          // Then try sessionStorage
          else if (sessionStorage.getItem('current_document_id')) {
            documentId = sessionStorage.getItem('current_document_id');
          }
        }
      } catch (e) {
        console.error('Error getting document ID for toolbar:', e);
      }
      
      return (
        <>
          <EditorHeader documentId={documentId} />
          <FixedToolbar>
            <FixedToolbarButtons />
          </FixedToolbar>
        </>
      );
    },
  },
});
