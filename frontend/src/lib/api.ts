/**
 * API client for handling HTTP requests with error handling
 */

// Get the API base URL from environment or use the default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Types for authentication and API responses
export interface User {
  id: string;
  name: string;
  email: string;
  [key: string]: any;
}

export interface AuthResponse {
  user: User;
  access_token: string;
}

// Generic API request handler with error handling
async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  // Get the token if available
  const token = localStorage.getItem('token');
  
  // Set headers
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  
  // Add authentication header if token exists
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  try {
    // Make the request
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    // Get the response text
    const text = await response.text();
    
    // Try to parse the response as JSON
    let data;
    try {
      // Only try to parse if there's content
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      console.error('Error parsing JSON response:', error);
      throw new Error('Invalid response from server. Please try again.');
    }
    
    // Check if the response was successful
    if (!response.ok) {
      const errorMessage = data.error || 'Something went wrong';
      throw new Error(errorMessage);
    }
    
    return data as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error. Please check your connection.');
  }
}

// Authentication methods
export const auth = {
  /**
   * Log in a user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  
  /**
   * Register a new user
   */
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },
  
  /**
   * Get the current user's profile
   */
  async getCurrentUser(): Promise<{ user: User }> {
    return apiRequest<{ user: User }>('/api/auth/me');
  },
  
  /**
   * Log out the current user
   */
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  
  /**
   * Check if a user is authenticated
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  },
};

// Export default API
export default {
  auth,
};

export interface Document {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

// Document cache with expiration to prevent loading incorrect content
const documentCache: {[key: string]: {document: Document, timestamp: number}} = {};
const CACHE_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes

// Helper function to get auth headers
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}

export async function fetchDocuments(): Promise<Document[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/documents`, {
      headers: getAuthHeaders()
    });
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
    const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
      headers: getAuthHeaders()
    });
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
    
    const response = await fetch(`${API_BASE_URL}/api/documents`, {
      method: 'POST',
      headers: getAuthHeaders(),
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
    
    const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
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
    
    const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
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