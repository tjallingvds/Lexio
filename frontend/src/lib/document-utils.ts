import { toast } from 'sonner';
import { createDocument } from '@/lib/api';

/**
 * Creates a new document and ensures its ID is properly shared across the application
 * before navigating to the editor. This follows the direct terminal approach of creating
 * the document first, then ensuring IDs are available before any navigation.
 * 
 * @param title Optional title for the document. Defaults to "Untitled Document"
 */
export async function createAndOpenDocument(title: string = 'Untitled Document') {
  try {
    // Create initial content - a simple paragraph
    const initialContent = JSON.stringify([
      {
        type: 'p',
        children: [{ text: '' }]
      }
    ]);
    
    console.log('Creating new document with initial content:', initialContent);
    
    // Create the document directly (same as terminal approach)
    const doc = await createDocument(title, initialContent);
    
    if (!doc || !doc.id) {
      console.error('Failed to create document: API returned null or invalid document ID');
      toast.error('Failed to create document');
      return null;
    }
    
    console.log('Document created successfully, ID:', doc.id);
    
    // Synchronously ensure ID is available through all channels before navigation
    // This is the key difference - we ensure IDs are available everywhere
    try {
      // 1. Set global variable
      if (typeof window !== 'undefined') {
        (window as any).__currentDocumentId = doc.id;
      }
      
      // 2. Store in sessionStorage
      sessionStorage.setItem('current_document_id', doc.id);
      
      // 3. Store in localStorage
      localStorage.setItem('last_created_document_id', doc.id);
      
      console.log('Document ID stored in all storage mechanisms:', doc.id);
      
      // 4. Add a small delay to ensure everything is saved before navigation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 5. Verify ID is still accessible
      const verifyId = (window as any).__currentDocumentId || 
                       sessionStorage.getItem('current_document_id') || 
                       localStorage.getItem('last_created_document_id');
      
      if (verifyId !== doc.id) {
        console.warn('Document ID verification failed - ID may not persist through navigation');
      }
      
      toast.success('Document created successfully');
      
      // 6. Return the document ID to be used for navigation
      return doc.id;
    } catch (e) {
      console.error('Failed to store document ID:', e);
      toast.error('Error storing document information');
      return doc.id; // Still return ID even if storage fails
    }
  } catch (error) {
    console.error('Error creating document:', error);
    toast.error('Failed to create document');
    return null;
  }
} 