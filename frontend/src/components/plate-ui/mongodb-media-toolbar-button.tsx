'use client';

import React, { useCallback, useState } from 'react';
import { isUrl } from '@udecode/plate';
import {
  AudioPlugin,
  FilePlugin,
  ImagePlugin,
  VideoPlugin,
} from '@udecode/plate-media/react';
import { useEditorRef } from '@udecode/plate/react';
import {
  AudioLinesIcon,
  FileUpIcon,
  FilmIcon,
  ImageIcon,
  LinkIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFilePicker } from 'use-file-picker';
import { useMongoDBUpload } from '@/lib/mongodb-upload';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useOpenState,
} from './dropdown-menu';
import { FloatingInput } from './input';
import { Spinner } from './spinner';
import {
  ToolbarButton,
  ToolbarSplitButton,
  ToolbarSplitButtonPrimary,
  ToolbarSplitButtonSecondary,
} from './toolbar';

const MEDIA_CONFIG = {
  [ImagePlugin.key]: {
    accept: ['image/*'],
    icon: <ImageIcon className="size-4" />,
    title: 'Insert Image',
    tooltip: 'Image',
  }
};

export function MongoDBImageButton() {
  const editor = useEditorRef();
  const openState = useOpenState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const { uploadFile } = useMongoDBUpload();
  
  const handleImageUpload = async (file: File) => {
    // Display loading state
    setUploading(true);
    const tempUrl = URL.createObjectURL(file);
    
    try {
      // Insert image with temporary URL
      editor.tf.insertNodes({
        type: ImagePlugin.key,
        children: [{ text: '' }],
        url: tempUrl,
      });
      
      // Try to upload to MongoDB
      const uploadedFile = await uploadFile(file);
      
      // Find images with the temporary URL
      const imageNodes = Array.from(
        editor.api.nodes({
          match: { type: ImagePlugin.key, url: tempUrl }
        })
      );
      
      if (uploadedFile && uploadedFile.url && imageNodes.length > 0) {
        const [, path] = imageNodes[0];
        
        // Update the image URL with the MongoDB URL
        editor.tf.setNodes(
          { url: uploadedFile.url },
          { at: path }
        );
        
        // Free up the blob URL
        URL.revokeObjectURL(tempUrl);
        toast.success('Image uploaded successfully');
      } else {
        toast.error('Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };
  
  const { openFilePicker } = useFilePicker({
    accept: ['image/*'],
    multiple: false,
    onFilesSelected: ({ plainFiles }) => {
      if (plainFiles.length > 0) {
        handleImageUpload(plainFiles[0]);
      }
    },
  });

  return (
    <>
      <ToolbarButton 
        tooltip="Image"
        onClick={() => openFilePicker()}
        disabled={uploading}
      >
        {uploading ? <Spinner className="size-4" /> : <ImageIcon className="size-4" />}
      </ToolbarButton>

      <AlertDialog
        open={dialogOpen}
        onOpenChange={(value) => {
          setDialogOpen(value);
        }}
      >
        <AlertDialogContent className="gap-6">
          <ImageUrlDialogContent setOpen={setDialogOpen} />
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ImageUrlDialogContent({
  setOpen,
}: {
  setOpen: (value: boolean) => void;
}) {
  const editor = useEditorRef();
  const [url, setUrl] = useState('');

  const embedImage = useCallback(() => {
    if (!isUrl(url)) return toast.error('Invalid URL');

    setOpen(false);
    editor.tf.insertNodes({
      children: [{ text: '' }],
      type: ImagePlugin.key,
      url,
    });
  }, [url, editor, setOpen]);

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Insert Image</AlertDialogTitle>
      </AlertDialogHeader>

      <AlertDialogDescription className="group relative w-full">
        <FloatingInput
          id="url"
          className="w-full"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') embedImage();
          }}
          label="Image URL"
          placeholder=""
          type="url"
          autoFocus
        />
      </AlertDialogDescription>

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => {
            e.preventDefault();
            embedImage();
          }}
        >
          Insert
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
} 