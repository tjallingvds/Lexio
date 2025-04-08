'use client';

import type { PlateEditor } from '@udecode/plate/react';

import {
  type NodeEntry,
  type Path,
  type TElement,
  PathApi,
} from '@udecode/plate';
import { insertCallout } from '@udecode/plate-callout';
import { CalloutPlugin } from '@udecode/plate-callout/react';
import { insertCodeBlock } from '@udecode/plate-code-block';
import { CodeBlockPlugin } from '@udecode/plate-code-block/react';
import { insertDate } from '@udecode/plate-date';
import { DatePlugin } from '@udecode/plate-date/react';
import { insertToc } from '@udecode/plate-heading';
import { TocPlugin } from '@udecode/plate-heading/react';
import { INDENT_LIST_KEYS, ListStyleType } from '@udecode/plate-indent-list';
import { IndentListPlugin } from '@udecode/plate-indent-list/react';
import { insertColumnGroup, toggleColumnGroup } from '@udecode/plate-layout';
import { ColumnItemPlugin, ColumnPlugin } from '@udecode/plate-layout/react';
import { LinkPlugin, triggerFloatingLink } from '@udecode/plate-link/react';
import { insertEquation, insertInlineEquation } from '@udecode/plate-math';
import {
  EquationPlugin,
  InlineEquationPlugin,
} from '@udecode/plate-math/react';
import {
  insertAudioPlaceholder,
  insertFilePlaceholder,
  insertMedia,
  insertVideoPlaceholder,
} from '@udecode/plate-media';
import {
  AudioPlugin,
  FilePlugin,
  ImagePlugin,
  MediaEmbedPlugin,
  VideoPlugin,
} from '@udecode/plate-media/react';
import { SuggestionPlugin } from '@udecode/plate-suggestion/react';
import {
  TableCellPlugin,
  TablePlugin,
  TableRowPlugin,
} from '@udecode/plate-table/react';
import { toast } from 'sonner';

// Create a temporary MongoDBUploader for transforms
class MongoDBUploader {
  static async uploadImage(file: File): Promise<string | null> {
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('image', file);
      
      // Get token
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return null;
      }
      
      // Get API URL from env or use default
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      
      // Upload the image
      const response = await fetch(`${apiUrl}/api/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to upload image');
        return null;
      }
      
      const data = await response.json();
      
      // Ensure the URL is absolute
      const url = data.url.startsWith('http') 
        ? data.url 
        : `${apiUrl}${data.url}`;
        
      toast.success('Image uploaded successfully');
      return url;
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Failed to upload image. Please try again.');
      return null;
    }
  }
}

export const STRUCTURAL_TYPES: string[] = [
  ColumnPlugin.key,
  ColumnItemPlugin.key,
  TablePlugin.key,
  TableRowPlugin.key,
  TableCellPlugin.key,
];

const ACTION_THREE_COLUMNS = 'action_three_columns';

const insertList = (editor: PlateEditor, type: string) => {
  editor.tf.insertNodes(
    editor.api.create.block({
      indent: 1,
      listStyleType: type,
    }),
    { select: true }
  );
};

const insertBlockMap: Record<
  string,
  (editor: PlateEditor, type: string) => void
> = {
  [INDENT_LIST_KEYS.todo]: insertList,
  [ListStyleType.Decimal]: insertList,
  [ListStyleType.Disc]: insertList,
  [ACTION_THREE_COLUMNS]: (editor) =>
    insertColumnGroup(editor, { columns: 3, select: true }),
  [AudioPlugin.key]: (editor) =>
    insertAudioPlaceholder(editor, { select: true }),
  [CalloutPlugin.key]: (editor) => insertCallout(editor, { select: true }),
  [CodeBlockPlugin.key]: (editor) => insertCodeBlock(editor, { select: true }),
  [EquationPlugin.key]: (editor) => insertEquation(editor, { select: true }),
  [FilePlugin.key]: (editor) => insertFilePlaceholder(editor, { select: true }),
  [ImagePlugin.key]: (editor) => {
    // Create a file picker for images
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;
    
    // When files are selected
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      
      // Show loading indicator
      const loadingToastId = toast.loading('Uploading image...');
      
      try {
        // First create a temporary URL for the placeholder
        const tempUrl = URL.createObjectURL(files[0]);
        
        // Insert the image with the temporary URL
        editor.tf.insertNodes({
          type: ImagePlugin.key,
          children: [{ text: '' }],
          url: tempUrl,
        });
        
        // Get all nodes of the image type
        const imageNodes = editor.tf.nodes({
          match: { type: ImagePlugin.key, url: tempUrl }
        });
        
        // Get the first matching node
        const imageEntry = Array.from(imageNodes)[0];
        
        if (!imageEntry) {
          toast.dismiss(loadingToastId);
          toast.error('Failed to create image placeholder');
          return;
        }
        
        // Upload the file to MongoDB
        const url = await MongoDBUploader.uploadImage(files[0]);
        
        if (url) {
          // If upload successful, update the node with the proper URL
          editor.tf.setNodes(
            { url },
            { at: imageEntry[1] }
          );
          
          // Revoke the temporary URL to free memory
          URL.revokeObjectURL(tempUrl);
          
          toast.dismiss(loadingToastId);
          toast.success('Image uploaded successfully');
        } else {
          // If upload failed, remove the node
          editor.tf.removeNodes({
            at: imageEntry[1]
          });
          
          // Revoke the temporary URL to free memory
          URL.revokeObjectURL(tempUrl);
          
          toast.dismiss(loadingToastId);
          toast.error('Failed to upload image');
        }
      } catch (error) {
        console.error('Error handling image upload:', error);
        toast.dismiss(loadingToastId);
        toast.error('An error occurred while uploading the image');
      }
    };
    
    // Trigger the file picker
    input.click();
  },
  [MediaEmbedPlugin.key]: (editor) =>
    insertMedia(editor, {
      select: true,
      type: MediaEmbedPlugin.key,
    }),
  [TablePlugin.key]: (editor) =>
    editor.getTransforms(TablePlugin).insert.table({}, { select: true }),
  [TocPlugin.key]: (editor) => insertToc(editor, { select: true }),
  [VideoPlugin.key]: (editor) =>
    insertVideoPlaceholder(editor, { select: true }),
};

const insertInlineMap: Record<
  string,
  (editor: PlateEditor, type: string) => void
> = {
  [DatePlugin.key]: (editor) => insertDate(editor, { select: true }),
  [InlineEquationPlugin.key]: (editor) =>
    insertInlineEquation(editor, '', { select: true }),
  [LinkPlugin.key]: (editor) => triggerFloatingLink(editor, { focused: true }),
};

export const insertBlock = (editor: PlateEditor, type: string) => {
  editor.tf.withoutNormalizing(() => {
    const block = editor.api.block();

    if (!block) return;
    if (type in insertBlockMap) {
      insertBlockMap[type](editor, type);
    } else {
      editor.tf.insertNodes(editor.api.create.block({ type }), {
        at: PathApi.next(block[1]),
        select: true,
      });
    }
    if (getBlockType(block[0]) !== type) {
      editor.getApi(SuggestionPlugin).suggestion.withoutSuggestions(() => {
        editor.tf.removeNodes({ previousEmptyBlock: true });
      });
    }
  });
};

export const insertInlineElement = (editor: PlateEditor, type: string) => {
  if (insertInlineMap[type]) {
    insertInlineMap[type](editor, type);
  }
};

const setList = (
  editor: PlateEditor,
  type: string,
  entry: NodeEntry<TElement>
) => {
  editor.tf.setNodes(
    editor.api.create.block({
      indent: 1,
      listStyleType: type,
    }),
    {
      at: entry[1],
    }
  );
};

const setBlockMap: Record<
  string,
  (editor: PlateEditor, type: string, entry: NodeEntry<TElement>) => void
> = {
  [INDENT_LIST_KEYS.todo]: setList,
  [ListStyleType.Decimal]: setList,
  [ListStyleType.Disc]: setList,
  [ACTION_THREE_COLUMNS]: (editor) => toggleColumnGroup(editor, { columns: 3 }),
};

export const setBlockType = (
  editor: PlateEditor,
  type: string,
  { at }: { at?: Path } = {}
) => {
  editor.tf.withoutNormalizing(() => {
    const setEntry = (entry: NodeEntry<TElement>) => {
      const [node, path] = entry;

      if (node[IndentListPlugin.key]) {
        editor.tf.unsetNodes([IndentListPlugin.key, 'indent'], { at: path });
      }
      if (type in setBlockMap) {
        return setBlockMap[type](editor, type, entry);
      }
      if (node.type !== type) {
        editor.tf.setNodes({ type }, { at: path });
      }
    };

    if (at) {
      const entry = editor.api.node<TElement>(at);

      if (entry) {
        setEntry(entry);

        return;
      }
    }

    const entries = editor.api.blocks({ mode: 'lowest' });

    entries.forEach((entry) => setEntry(entry));
  });
};

export const getBlockType = (block: TElement) => {
  if (block[IndentListPlugin.key]) {
    if (block[IndentListPlugin.key] === ListStyleType.Decimal) {
      return ListStyleType.Decimal;
    } else if (block[IndentListPlugin.key] === INDENT_LIST_KEYS.todo) {
      return INDENT_LIST_KEYS.todo;
    } else {
      return ListStyleType.Disc;
    }
  }

  return block.type;
};
