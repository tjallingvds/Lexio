'use client';

import { createPlatePlugin } from '@udecode/plate/react';

import { FixedToolbar } from '@/components/plate-ui/fixed-toolbar';
import { FixedToolbarButtons } from '@/components/plate-ui/fixed-toolbar-buttons';
import { EditorHeader } from '@/components/plate-ui/editor-header';

export const FixedToolbarPlugin = createPlatePlugin({
  key: 'fixed-toolbar',
  render: {
    beforeEditable: () => (
      <>
        <EditorHeader />
        <FixedToolbar>
          <FixedToolbarButtons />
        </FixedToolbar>
      </>
    ),
  },
});
