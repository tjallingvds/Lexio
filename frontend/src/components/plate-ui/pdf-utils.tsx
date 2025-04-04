'use client';

/**
 * Simplified PDF text extraction utility using our LangChain backend
 */
export async function extractTextFromPdf(file: File): Promise<{
  text: string, 
  pdf_id?: string, 
  vector_storage?: boolean,
  token_estimate?: number,
  word_count?: number
}> {
  console.log(`Extracting text from PDF: ${file.name}`);
  
  try {
    // Use server-side extraction with LangChain processing
    const formData = new FormData();
    formData.append('pdf', file);
    
    const response = await fetch('/api/extract-pdf', {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // Check for API key related errors
      if (data.error && (data.error.includes("API key") || data.error.includes("OpenAI"))) {
        console.error("OpenAI API key error:", data.error);
        throw new Error("OpenAI API key error: " + data.error);
      }
      throw new Error(data.error || "Error extracting text from PDF");
    }
    
    if (response.ok && data.text) {
      console.log(`Extraction successful: ${data.text.length} chars, PDF ID: ${data.pdf_id}`);
      console.log(`Vector storage status: ${data.vector_storage}, API key present: ${data.api_key_present}`);
      console.log(`Token estimate: ${data.token_estimate}, Word count: ${data.word_count}`);
      
      // If vector storage failed but we have raw text, we can still return it
      if (!data.vector_storage && data.api_key_present === false) {
        console.warn("PDF processed but vector storage skipped - OpenAI API key not found");
      }
      
      return {
        text: data.text,
        pdf_id: data.pdf_id,
        vector_storage: data.vector_storage,
        token_estimate: data.token_estimate,
        word_count: data.word_count
      };
    }
    
    // If server extraction fails, fallback to simple client-side extraction
    const text = await extractTextWithFileReader(file);
    // Calculate tokens when using fallback
    const words = text.split(/\s+/).length;
    return { 
      text,
      token_estimate: Math.round(words * 1.3),
      word_count: words
    };
  } catch (error) {
    console.error("Error in extraction:", error);
    // Re-throw API key related errors so they can be handled by the caller
    if (error instanceof Error && error.message.includes("API key")) {
      throw error;
    }
    
    // Otherwise fallback to client-side extraction
    const text = await extractTextWithFileReader(file);
    // Calculate tokens when using fallback
    const words = text.split(/\s+/).length;
    return { 
      text,
      token_estimate: Math.round(words * 1.3),
      word_count: words
    };
  }
}

/**
 * Basic file reader approach as fallback
 */
export async function extractTextWithFileReader(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string || "";
        resolve(text || "No text could be extracted");
      } catch (error) {
        console.error("Error reading file:", error);
        resolve("Error reading PDF");
      }
    };
    
    reader.onerror = () => {
      resolve("Failed to read PDF file");
    };
    
    reader.readAsText(file);
  });
}

/**
 * Clean up extracted text
 */
export function sanitizePdfContent(text: string): string {
  if (!text) return "";
  
  // Simple cleanup
  let cleaned = text
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
    
  return cleaned || "No readable text found";
}

/**
 * Query the vector database for similar content
 */
export async function queryPdfContent(query: string, limit: number = 5): Promise<any> {
  try {
    const response = await fetch('/api/pdf-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit
      }),
    });
    
    return await response.json();
  } catch (error) {
    console.error("Error querying PDF content:", error);
    return { success: false, error: "Failed to query PDF content" };
  }
}

/**
 * Retrieve the full content of a specific PDF
 */
export async function getPdfContent(pdfId: string): Promise<string> {
  try {
    const response = await fetch(`/api/pdf-content/${pdfId}`, {
      method: 'GET',
    });
    
    const data = await response.json();
    
    if (response.ok && data.text) {
      return data.text;
    }
    
    return "";
  } catch (error) {
    console.error("Error retrieving PDF content:", error);
    return "";
  }
} 