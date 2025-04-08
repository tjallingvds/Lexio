'use client';

/**
 * PDF text extraction utility using OpenAI's PDF processing capabilities
 */
export async function extractTextFromPdf(file: File): Promise<{
  text: string, 
  pdf_id?: string, 
  vector_storage?: boolean,
  token_estimate?: number,
  word_count?: number,
  summary?: string
}> {
  console.log(`Extracting text from PDF: ${file.name} (size: ${file.size} bytes)`);
  
  try {
    // Use server-side extraction with OpenAI processing
    const formData = new FormData();
    formData.append('pdf', file);
    
    // Add a timestamp to help prevent caching issues
    formData.append('timestamp', Date.now().toString());
    
    // Set a longer timeout for larger files (3 minutes)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out after 3 minutes')), 180000);
    });
    
    // Create the fetch request
    const fetchPromise = fetch('/api/extract-pdf', {
      method: 'POST',
      body: formData,
    });
    
    // Race the fetch against the timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
    
    // Check for HTTP errors
    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error || `Server error: ${response.status}`;
      console.error("PDF extraction failed:", errorMessage);
      throw new Error(errorMessage);
    }
    
    // Process the response
    const data = await response.json();
    
    if (data.success && data.text) {
      console.log(`Extraction successful: ${data.text.length} chars, PDF ID: ${data.pdf_id}`);
      
      if (data.summary) {
        console.log(`PDF summary: ${data.summary}`);
      }
      
      return {
        text: data.text,
        pdf_id: data.pdf_id,
        vector_storage: data.vector_storage,
        token_estimate: data.token_estimate,
        word_count: data.word_count,
        summary: data.summary
      };
    } else {
      throw new Error(data.error || "No text extracted from PDF");
    }
  } catch (error) {
    console.error("Error extracting PDF:", error);
    throw error; // Re-throw to let caller handle the error
  }
}

/**
 * Clean up and standardize extracted PDF text
 */
export function sanitizePdfContent(text: string): string {
  if (!text) return '';
  
  // Remove excessive whitespace
  let cleaned = text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
  
  // Ensure reasonable length
  if (cleaned.length > 500000) {
    cleaned = cleaned.slice(0, 500000) + '\n\n[Content truncated due to size]';
  }
  
  return cleaned;
}

/**
 * Retrieve the full content of a specific PDF
 */
export async function getPdfContent(pdfId: string): Promise<string> {
  try {
    console.log(`Retrieving content for PDF ID: ${pdfId}`);
    
    const response = await fetch(`/api/pdf-content/${pdfId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
    });
    
    const data = await response.json();
    
    if (response.ok && data.text) {
      console.log(`Retrieved PDF content successfully: ${data.text.length} characters`);
      return data.text;
    } else {
      console.error("Error retrieving PDF content:", data.error || "Unknown error");
      return "";
    }
  } catch (error) {
    console.error("Exception retrieving PDF content:", error);
    return "";
  }
}

/**
 * Query PDF content for relevant information
 */
export async function queryPdfContent(query: string, limit: number = 5): Promise<{
  success: boolean;
  results: Array<any>;
  error?: string;
}> {
  try {
    const response = await fetch('/api/pdf-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, limit }),
    });
    
    const data = await response.json();
    
    if (data.success && data.results) {
      return data;
    } else {
      console.error("PDF query error:", data.error);
      return { success: false, results: [], error: data.error || "Failed to query PDF" };
    }
  } catch (error) {
    console.error("Exception during PDF query:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, results: [], error: errorMessage };
  }
} 