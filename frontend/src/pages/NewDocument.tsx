import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { createAndOpenDocument } from '@/lib/document-utils';

export default function NewDocument() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(true);
  
  useEffect(() => {
    // Automatically create a document when this component mounts
    const createDoc = async () => {
      try {
        const documentId = await createAndOpenDocument();
        if (documentId) {
          // Use the terminal-style approach - direct navigation with ID
          navigate(`/editor/${documentId}?new=true`);
        } else {
          // If document creation failed, go back to home
          toast.error('Failed to create document');
          navigate('/home');
        }
      } catch (error) {
        console.error('Error creating document:', error);
        toast.error('Failed to create document');
        navigate('/home');
      } finally {
        setIsCreating(false);
      }
    };

    createDoc();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Creating new document...</h2>
        <p>Please wait while we set up your new document.</p>
      </div>
      <Toaster />
    </div>
  );
} 