'use client';

/**
 * Very simple PDF to text extraction utility
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  console.log(`Extracting text from PDF: ${file.name}`);
  
  try {
    // Try server-side extraction first
    const formData = new FormData();
    formData.append('pdf', file);
    
    const response = await fetch('/api/extract-pdf', {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    
    if (response.ok && data.text) {
      console.log(`Extraction successful: ${data.text.length} chars`);
      return data.text;
    }
    
    // Fallback to simple client-side extraction
    return await extractTextWithFileReader(file);
  } catch (error) {
    console.error("Error in extraction:", error);
    return await extractTextWithFileReader(file);
  }
}

/**
 * Basic file reader approach to extract text
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