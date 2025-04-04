'use client';

import * as React from 'react';
import { FileUp, Trash2, BookOpen, Loader2, Bookmark, FolderOpen, SearchIcon, BookmarkIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@udecode/cn';
import { sanitizePdfContent, extractTextFromPdf, extractTextWithFileReader } from '@/components/plate-ui/pdf-utils';
import { useRef, useEffect, useState } from 'react';
import { FileText, FolderIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type PdfDocument = {
  id: string;
  name: string;
  size: number;
  date: Date;
  file?: File;
  content?: string;
  preview?: string;
  pdf_id?: string;
};

const PDF_LIBRARY_STORAGE_KEY = 'pdf_library';

const savePdfLibrary = (pdfs: PdfDocument[]): void => {
  try {
    localStorage.setItem(PDF_LIBRARY_STORAGE_KEY, JSON.stringify(pdfs));
  } catch (e) {
    console.error('Failed to save PDF library:', e);
  }
};

const loadPdfLibrary = (): PdfDocument[] => {
  try {
    const savedLibrary = localStorage.getItem(PDF_LIBRARY_STORAGE_KEY);
    
    if (savedLibrary) {
      const parsedLibrary = JSON.parse(savedLibrary);
      
      // Convert string timestamps back to Date objects
      return parsedLibrary.map((pdf: any) => ({
        ...pdf,
        date: new Date(pdf.date),
      }));
    }
  } catch (e) {
    console.error('Failed to load PDF library:', e);
  }
  
  // Default empty library
  return [];
};

export interface PdfLibraryProps {
  onSelect: (pdf: PdfDocument) => void;
}

export function PdfLibrary({ onSelect }: PdfLibraryProps) {
  const [pdfs, setPdfs] = useState<PdfDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load saved PDFs from localStorage
    const loadedPdfs = loadPdfLibrary();
    setPdfs(loadedPdfs);
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.includes('pdf')) {
      toast.error("Invalid file type. Please upload a PDF file");
      return;
    }

    // Validate file size (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("File too large. PDF must be smaller than 10MB");
      return;
    }

    // Show loading toast
    toast.loading(`Processing ${file.name}...`);
    
    // Create new PDF document
    const newPdf: PdfDocument = {
      id: Date.now().toString(),
      name: file.name,
      size: file.size,
      date: new Date(),
      file: file,
    };

    // Add to state and save to localStorage
    const updatedPdfs = [...pdfs, newPdf];
    setPdfs(updatedPdfs);
    savePdfLibrary(updatedPdfs);

    // Process the PDF to extract text using the improved backend
    (async () => {
      try {
        const result = await extractTextFromPdf(file);
        
        if (result.text) {
          // Process was successful
          const pdfWithContent = updatedPdfs.find(p => p.id === newPdf.id);
          if (pdfWithContent) {
            pdfWithContent.content = result.text;
            pdfWithContent.pdf_id = result.pdf_id; // Store backend PDF ID
            pdfWithContent.preview = result.text.slice(0, 150).replace(/\n/g, ' ') + '...';
            
            // Update state and save
            setPdfs([...updatedPdfs]);
            savePdfLibrary([...updatedPdfs]);
            
            // Calculate token count properly based on word count
            const tokenEstimate = Math.round(result.text.split(/\s+/).length * 1.3);
            toast.success(`${file.name} processed successfully (approx. ${tokenEstimate} tokens)`);
          }
        } else {
          toast.error("Failed to extract content from PDF");
        }
      } catch (error) {
        console.error("Error processing PDF:", error);
        toast.error("Error processing PDF");
      }
    })();

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeletePdf = (id: string) => {
    const updatedPdfs = pdfs.filter(pdf => pdf.id !== id);
    setPdfs(updatedPdfs);
    savePdfLibrary(updatedPdfs);

    toast.success("PDF removed from library");
  };

  const filteredPdfs = pdfs.filter(pdf => 
    pdf.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background text-foreground p-4 rounded-md border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center">
          <BookOpen className="mr-2 h-5 w-5" />
          PDF Library
        </h2>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="icon"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="ml-auto"
              >
                <FileUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Upload PDF</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept="application/pdf"
        />
      </div>
      
      <div className="mb-4 relative">
        <SearchIcon className="h-4 w-4 absolute left-2 top-3 text-muted-foreground" />
        <Input
          placeholder="Search PDFs..."
          className="pl-8"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      {pdfs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <FolderIcon className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-sm mb-4">Your PDF library is empty</p>
          <Button 
            variant="secondary" 
            className="text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="h-3 w-3 mr-2" />
            Upload your first PDF
          </Button>
        </div>
      ) : (
        <ScrollArea className="flex-1 -mx-4 px-4">
          <ul className="space-y-2">
            {filteredPdfs.map((pdf) => (
              <li 
                key={pdf.id} 
                className="p-3 rounded-md border border-border flex items-start hover:bg-accent/50 transition-colors"
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-start">
                    <FileText className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate" title={pdf.name}>
                        {pdf.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(pdf.size)} • {formatDate(pdf.date)}
                      </p>
                      {pdf.preview && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                          "{pdf.preview}"
                        </p>
                      )}
                      {pdf.content ? (
                        <div className="flex items-center mt-1">
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-2 py-0.5 rounded-full">
                            Content Extracted ({Math.round(pdf.content.split(/\s+/).length * 1.3)} tokens)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center mt-1">
                          <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 px-2 py-0.5 rounded-full">
                            Not Processed
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onSelect(pdf)}
                        >
                          <BookmarkIcon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Use in Chat</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                          onClick={() => handleDeletePdf(pdf.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Helper function to format date
function formatDate(date: Date): string {
  return date.toLocaleDateString();
} 