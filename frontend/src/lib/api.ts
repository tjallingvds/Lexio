const API_URL = 'http://localhost:5000/api';

export interface Document {
  id: number;
  title: string;
  content: string;
  updated_at: string;
}

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

export async function fetchDocument(id: number): Promise<Document | null> {
  try {
    const response = await fetch(`${API_URL}/documents/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch document');
    }
    const data = await response.json();
    return data.document;
  } catch (error) {
    console.error(`Error fetching document ${id}:`, error);
    return null;
  }
}

export async function createDocument(title: string, content: string = ''): Promise<Document | null> {
  try {
    const response = await fetch(`${API_URL}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, content }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create document');
    }
    
    const data = await response.json();
    return data.document;
  } catch (error) {
    console.error('Error creating document:', error);
    return null;
  }
} 