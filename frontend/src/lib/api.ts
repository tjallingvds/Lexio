const API_URL = 'http://localhost:5001/api';

export interface Document {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

// Document cache with expiration to prevent loading incorrect content
const documentCache: {[key: string]: {document: Document, timestamp: number}} = {};
const CACHE_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes

export async function fetchDocuments(): Promise<Document[]> {
  try {
    const response = await fetch(`${API_URL}/documents`);
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }
    const data = await response.json();
    return data.documents;
  } catch (error) {
    console.error('Error fetching documents:', error);
    return [];
  }
}

export async function fetchDocument(id: string): Promise<Document | null> {
  try {
    // Check cache first to prevent incorrect document loading
    const cachedEntry = documentCache[id];
    const now = Date.now();
    
    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_EXPIRATION_MS)) {
      console.log(`Using cached document for ID: ${id}`);
      return cachedEntry.document;
    }
    
    console.log(`Cache miss or expired for document ID: ${id}, fetching from server`);
    const response = await fetch(`${API_URL}/documents/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch document');
    }
    const data = await response.json();
    
    // Cache the document for future requests
    if (data.document) {
      documentCache[id] = {
        document: data.document,
        timestamp: now
      };
    }
    
    return data.document;
  } catch (error) {
    console.error(`Error fetching document ${id}:`, error);
    return null;
  }
}

export async function createDocument(title: string, content: string = ''): Promise<Document | null> {
  try {
    console.log('API createDocument called with:', { title, contentLength: content.length });
    
    const response = await fetch(`${API_URL}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, content }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create document, server response:', response.status, errorText);
      throw new Error(`Failed to create document: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Document created successfully, received:', data.document);
    return data.document;
  } catch (error) {
    console.error('Error creating document:', error);
    return null;
  }
}

export async function updateDocument(id: string, title?: string, content?: string): Promise<Document | null> {
  try {
    // Validate inputs
    if (!id) {
      console.error('updateDocument called with invalid ID');
      return null;
    }
    
    console.log('updateDocument called with:', { 
      id, 
      title: title ? (title.length > 20 ? title.substring(0, 20) + '...' : title) : undefined,
      contentProvided: !!content,
      contentLength: content ? content.length : 0
    });
    
    // If no title or content provided, nothing to update
    if (title === undefined && content === undefined) {
      console.warn('updateDocument called without title or content, nothing to update');
      return null;
    }
    
    const requestBody = { 
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
    };
    
    console.log('Request body keys:', Object.keys(requestBody));
    
    const response = await fetch(`${API_URL}/documents/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to update document ${id}:`, response.status, errorText);
      throw new Error(`Failed to update document: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Document updated successfully:', data.document.id);
    
    // Update cache with the latest document
    if (data.document) {
      documentCache[id] = {
        document: data.document,
        timestamp: Date.now()
      };
    }
    
    return data.document;
  } catch (error) {
    console.error('Error updating document:', error);
    return null;
  }
}

export async function deleteDocument(id: string): Promise<boolean> {
  try {
    if (!id) {
      console.error('deleteDocument called with invalid ID');
      return false;
    }
    
    console.log('Deleting document with ID:', id);
    
    const response = await fetch(`${API_URL}/documents/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to delete document ${id}:`, response.status, errorText);
      throw new Error(`Failed to delete document: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Document deleted successfully, response:', data);
    return data.success;
  } catch (error) {
    console.error('Error deleting document:', error);
    return false;
  }
} 