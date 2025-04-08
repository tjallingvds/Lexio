'use client';

import React, { useState } from 'react';
import { ImagePlugin } from '@udecode/plate-media/react';
import { useEditorRef } from '@udecode/plate/react';
import { ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ToolbarButton } from './toolbar';
import { Spinner } from './spinner';

// Get the API base URL from environment or use the default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export function MongoDBImageButton() {
  const editor = useEditorRef();
  const [uploading, setUploading] = useState(false);
  
  const handleImageUpload = (file: File) => {
    if (!file) return;
    
    // Display loading state
    setUploading(true);
    const loadingToast = toast.loading('Uploading image...');
    
    // Create form data
    const formData = new FormData();
    formData.append('image', file);
    
    // Get auth token
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Authentication required. Please log in again.');
      setUploading(false);
      toast.dismiss(loadingToast);
      return;
    }
    
    // Upload to MongoDB backend
    fetch(`${API_BASE_URL}/api/upload-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.error || 'Failed to upload image');
        });
      }
      return response.json();
    })
    .then(data => {
      // Ensure the URL is absolute
      const url = data.url.startsWith('http') 
        ? data.url 
        : `${API_BASE_URL}${data.url}`;
      
      // Insert the image node with the MongoDB URL
      editor.tf.insertNodes({
        type: ImagePlugin.key,
        children: [{ text: '' }],
        url: url
      });
      
      toast.dismiss(loadingToast);
      toast.success('Image uploaded successfully');
    })
    .catch(error => {
      console.error('Upload error:', error);
      toast.dismiss(loadingToast);
      toast.error(error.message || 'Failed to upload image');
    })
    .finally(() => {
      setUploading(false);
    });
  };
  
  const openFilePicker = () => {
    if (uploading) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        handleImageUpload(files[0]);
      }
    };
    
    input.click();
  };

  return (
    <ToolbarButton 
      tooltip="Insert Image"
      onClick={openFilePicker}
      disabled={uploading}
    >
      {uploading ? <Spinner className="size-4" /> : <ImageIcon className="size-4" />}
    </ToolbarButton>
  );
} 