import * as React from 'react';
import { toast } from 'sonner';

// Get the API base URL from environment or use the default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export interface UploadedFile {
  id: string;
  url: string;
  filename: string;
}

interface UseMongoDBUploadProps {
  onUploadBegin?: () => void;
  onUploadProgress?: (progress: number) => void;
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadError?: (error: unknown) => void;
}

export function useMongoDBUpload({
  onUploadBegin,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
}: UseMongoDBUploadProps = {}) {
  const [uploadedFile, setUploadedFile] = React.useState<UploadedFile>();
  const [uploadingFile, setUploadingFile] = React.useState<File>();
  const [progress, setProgress] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState(false);

  async function uploadFile(file: File): Promise<UploadedFile | undefined> {
    if (!file) return;

    setIsUploading(true);
    setUploadingFile(file);
    onUploadBegin?.();

    try {
      // Create form data
      const formData = new FormData();
      formData.append('image', file);

      // Get auth token from localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      // Track upload progress
      let progressInterval: number | null = null;
      try {
        // Simulate progress until we get the real result
        let simulatedProgress = 0;
        progressInterval = window.setInterval(() => {
          simulatedProgress += 5;
          if (simulatedProgress > 95) {
            simulatedProgress = 95; // Cap at 95% until actual completion
          }
          setProgress(simulatedProgress);
          onUploadProgress?.(simulatedProgress);
        }, 100);

        // Upload to our backend
        const response = await fetch(`${API_BASE_URL}/api/upload-image`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        // Clear the progress interval
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload image');
        }

        const data = await response.json();
        
        // Set progress to 100% on completion
        setProgress(100);
        onUploadProgress?.(100);

        // Make sure the URL is absolute
        const url = data.url.startsWith('http') 
          ? data.url 
          : `${API_BASE_URL}${data.url}`;

        const uploadedFileData: UploadedFile = {
          id: data.id,
          url,
          filename: data.filename,
        };

        setUploadedFile(uploadedFileData);
        onUploadComplete?.(uploadedFileData);

        return uploadedFileData;
      } finally {
        if (progressInterval) {
          clearInterval(progressInterval);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      
      // Show error toast
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to upload image. Please try again.');
      }
      
      onUploadError?.(error);
      return undefined;
    } finally {
      setProgress(0);
      setIsUploading(false);
      setUploadingFile(undefined);
    }
  }

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadFile,
    uploadingFile,
  };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
} 