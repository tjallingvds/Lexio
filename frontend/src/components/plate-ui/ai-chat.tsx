'use client';

import * as React from 'react';
import { 
  SendIcon, 
  PlusIcon, 
  Loader2, 
  Copy, 
  CheckIcon, 
  FileUp, 
  FileText, 
  BookmarkIcon, 
  Library, 
  MessageSquare, 
  BookOpen,
  X,
  Globe,
  ExternalLink
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { useSettings } from '@/components/editor/settings';
import { useMongoDBUpload } from '@/lib/mongodb-upload';
import { toast } from 'sonner';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { PdfLibrary } from './pdf-library';
import { sanitizePdfContent, extractTextFromPdf, queryPdfContent, getPdfContent } from '@/components/plate-ui/pdf-utils';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Bot } from 'lucide-react';
import { cn } from '@udecode/cn';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sources?: Array<{ title: string, url: string, snippet?: string }>;
  metadata?: {
    type?: string;
    pdfId?: string;
    backendPdfId?: string;
    [key: string]: any;
  };
};

// Get document ID from sessionStorage or window variable
const getDocumentId = (): string | null => {
  try {
    // First check sessionStorage
    const sessionId = typeof window !== 'undefined' 
      ? sessionStorage.getItem('current_document_id') 
      : null;
    
    if (sessionId) return sessionId;
    
    // Then check the window variable
    if (typeof window !== 'undefined' && (window as any).__currentDocumentId) {
      return (window as any).__currentDocumentId;
    }
    
    return null;
  } catch (e) {
    console.error('Failed to get document ID:', e);
    return null;
  }
};

// Create a key for storing chat messages for a specific document
const getChatStorageKey = (documentId: string | null): string => {
  return documentId ? `chat_messages_${documentId}` : 'chat_messages_default';
};

// Save messages to localStorage for the current document
const saveMessages = (messages: Message[], documentId: string | null): void => {
  try {
    const storageKey = getChatStorageKey(documentId);
    localStorage.setItem(storageKey, JSON.stringify(messages));
  } catch (e) {
    console.error('Failed to save chat messages:', e);
  }
};

// Load messages from localStorage for the current document
const loadMessages = (documentId: string | null): Message[] => {
  try {
    const storageKey = getChatStorageKey(documentId);
    const savedMessages = localStorage.getItem(storageKey);
    
    if (savedMessages) {
      const parsedMessages = JSON.parse(savedMessages);
      
      // Convert string timestamps back to Date objects and ensure correct types
      return parsedMessages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
        role: msg.role as 'user' | 'assistant' | 'system'
      }));
    }
  } catch (e) {
    console.error('Failed to load chat messages:', e);
  }
  
  // Default welcome message
  return [{
      id: '1',
    role: 'assistant' as const,
      content: 'Hello! I now have improved PDF handling capabilities, reliably extracting content from your documents. Each PDF also gets a helpful summary so you can easily identify it in your library.',
      timestamp: new Date(),
  }];
};

// Define our local PdfDocument type to have all the properties we need
type PdfDocument = {
  id: string;
  name: string;
  size: number;
  date: Date;
  file?: File;
  content?: string;
  preview?: string;
  pdf_id?: string;
  summary?: string;
};

// Add these functions to fix the linter errors
const loadPdfLibrary = (): PdfDocument[] => {
  try {
    const stored = localStorage.getItem('pdf_library');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to load PDF library:', e);
    return [];
  }
};

const savePdfLibrary = (pdfs: PdfDocument[]): void => {
  try {
    localStorage.setItem('pdf_library', JSON.stringify(pdfs));
  } catch (e) {
    console.error('Failed to save PDF library:', e);
  }
};

export function AiChat() {
  const documentId = getDocumentId();
  
  // Local state for UI messages
  const [messages, setMessages] = React.useState<Message[]>(() => loadMessages(documentId));
  
  // Get settings to access the OpenAI API key
  const { keys } = useSettings();
  
  // Remove this:
  // const { messages: apiMessages, input, setInput, handleSubmit, isLoading } = useChat();
  
  // And replace with our own state:
  const [input, setInput] = React.useState<string>('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const [documentContent, setDocumentContent] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [hasInteraction, setHasInteraction] = React.useState(false);
  
  // PDF context state
  const [pdfContent, setPdfContent] = React.useState<string>('');
  const [pdfName, setPdfName] = React.useState<string>('');
  const [isPdfUploading, setIsPdfUploading] = React.useState(false);
  const [pdfDebugInfo, setPdfDebugInfo] = React.useState<string | null>(null);
  const [showDebugInfo, setShowDebugInfo] = React.useState(false);
  
  // Toggle between chat and PDF library
  const [activeView, setActiveView] = React.useState<'chat' | 'library'>('chat');
  
  // PDFs selected for context
  const [selectedPdfs, setSelectedPdfs] = React.useState<PdfDocument[]>([]);
  
  // Web search context
  const [webSearchEnabled, setWebSearchEnabled] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  
  // Use MongoDB upload for handling file uploads
  const { isUploading } = useMongoDBUpload({
    onUploadComplete: (file) => {
      console.log('File uploaded successfully:', file);
    },
    onUploadError: (error) => {
      console.error('File upload error:', error);
      toast.error('Failed to upload file');
    }
  });
  
  // Define MAX_PDF_LENGTH constant near the top of the component
  const MAX_PDF_LENGTH = 100000; // Maximum length of PDF content to include in context (increased from 10000)

  // Handler for selecting a PDF from the library
  const handleSelectPdf = async (pdf: PdfDocument) => {
    try {
      // If the PDF already has backend pdf_id, use it
      if (pdf.pdf_id) {
        // Try to get content from file cache first
        if (pdf.content) {
          handleAddPdfToContext(pdf.id, pdf.name, pdf.content, pdf.pdf_id);
          return;
        }
        
        // Otherwise fetch from backend
        setIsPdfUploading(true);
        const content = await getPdfContent(pdf.pdf_id);
        
        if (content) {
          // Update the PDF in local state with content
          handleAddPdfToContext(pdf.id, pdf.name, content, pdf.pdf_id);
          
          // Update the PDF in the library
          const updatedPdf = {
            ...pdf,
            content: content
          };
          
          console.log('PDF content fetched from backend successfully:', updatedPdf.name);
          toast.success(`PDF "${pdf.name}" added to context`);
        } else {
          toast.error("Could not retrieve PDF content from server");
        }
        setIsPdfUploading(false);
        return;
      }
      
      // If PDF has a file property but no pdf_id, extract the content
      if (pdf.file) {
        setIsPdfUploading(true);
        
        try {
          const result = await extractTextFromPdf(pdf.file);
          
          if (result.text && result.text.length > 0) {
            // Clean text with sanitizer
            const cleanedText = sanitizePdfContent(result.text);
            
            handleAddPdfToContext(pdf.id, pdf.name, cleanedText, result.pdf_id);
            
            // Update the PDF in the library with the extracted content
            const updatedPdf = {
              ...pdf,
              content: cleanedText,
              pdf_id: result.pdf_id
            };
            
            console.log('PDF content extracted successfully:', updatedPdf.name);
            toast.success(`PDF "${pdf.name}" added to context`);
          } else {
            toast.error("Could not extract meaningful text from this PDF.");
          }
        } catch (error) {
          console.error("Error extracting text from PDF:", error);
          toast.error("Failed to extract text from PDF.");
        } finally {
          setIsPdfUploading(false);
        }
      } else {
        // Neither content nor file is available
        toast.error("PDF content not available. Try uploading the PDF again.");
      }
    } catch (error) {
      console.error("Error processing PDF:", error);
      toast.error("Error processing PDF. Please try again.");
      setIsPdfUploading(false);
    }
    
    // Switch back to chat view even if there was an error
    setActiveView('chat');
  };
  
  // Handler for file selection
  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    console.log('File selected:', file.name, 'type:', file.type, 'size:', file.size);
    
    // Check for OpenAI API key
    if (!keys?.openai && !keys?.openAIKey) {
      toast.error('OpenAI API key is required to process PDFs. Please add your API key in the Settings panel.');
      event.target.value = '';
      
      // Add an error message to the chat
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          role: 'assistant',
          content: "⚠️ OpenAI API key is missing. PDF processing requires an API key for generating embeddings and responses. Please configure your API key in Settings.",
          timestamp: new Date()
        }
      ]);
      return;
    }
    
    // Reset debug info
    setPdfDebugInfo(null);
    setShowDebugInfo(false);
    
    // Check if it's a PDF file
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      event.target.value = '';
      return;
    }
    
    // Check file size (max 25MB - increased limit)
    if (file.size > 25 * 1024 * 1024) {
      toast.error('PDF file is too large. Please upload a file smaller than 25MB');
      event.target.value = '';
      return;
    }
    
    try {
      setIsPdfUploading(true);
      setPdfName(file.name);
      const toastId = toast.loading(`Processing PDF ${file.name}. This may take up to a minute...`);
      
      // Extract text from PDF
      const result = await extractTextFromPdf(file);
      
      // Ensure we have text content
      if (!result.text) {
        toast.error("No text could be extracted from this PDF.", { id: toastId });
        return;
      }
      
      // Success - create PDF document
      const pdfId = Date.now().toString();
      const cleanedText = sanitizePdfContent(result.text);
      
      // Create the PDF document with summary
      const newPdf: PdfDocument = {
        id: pdfId,
        name: file.name,
        size: file.size,
        date: new Date(),
        content: cleanedText,
        pdf_id: result.pdf_id,
        preview: result.text.slice(0, 150).replace(/\n/g, ' ') + '...',
        summary: result.summary
      };
      
      // Add to selected PDFs
      setSelectedPdfs(prev => [...prev, newPdf]);
      
      // Add to messages
      addPdfContentToMessages(pdfId, file.name, cleanedText, result.pdf_id, result.summary);
      
      // Save to library
      const loadedPdfs = loadPdfLibrary();
      savePdfLibrary([...loadedPdfs, newPdf]);
      
      // Show success message with word count
      const tokenEstimate = result.token_estimate || Math.round(cleanedText.split(/\s+/).length * 1.3);
      toast.success(`Successfully processed "${file.name}" (${tokenEstimate} tokens)`, { id: toastId });
      
    } catch (error) {
      console.error('PDF extraction failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Show detailed error
      toast.error(`Failed to process PDF: ${errorMessage}`, { duration: 5000 });
      
      // Debug information for troubleshooting
      let debugMessage = `Error: ${errorMessage}`;
      if (errorMessage.includes('API key')) {
        debugMessage = "OpenAI API key error. Please check your API key in Settings.";
      } else if (errorMessage.includes('timed out')) {
        debugMessage = "The PDF processing timed out. The file may be too large or complex. Try with a smaller or simpler PDF.";
      } else if (errorMessage.includes('format') || errorMessage.includes('corrupted')) {
        debugMessage = "The PDF file appears to be corrupted or in an unsupported format. Try saving it with a different PDF tool before uploading.";
      }
      
      setPdfDebugInfo(debugMessage);
      setShowDebugInfo(true);
      
      // Add helpful error message to chat
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          role: 'assistant',
          content: `⚠️ I couldn't process the PDF. ${debugMessage}`,
          timestamp: new Date()
        }
      ]);
      
    } finally {
      setIsPdfUploading(false);
      event.target.value = '';
    }
  };
  
  // State to track which message was recently copied
  const [copiedMessageId, setCopiedMessageId] = React.useState<string | null>(null);

  // Save messages whenever they change
  React.useEffect(() => {
    if (messages.length > 0) {
      saveMessages(messages, documentId);
    }
  }, [messages, documentId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Also remove or update the effect that relies on isLoading
  React.useEffect(() => {
    if (thinking) {
      // If thinking transitions to false, scroll to bottom
      return () => {
        if (!thinking) {
          scrollToBottom();
        }
      };
    }
  }, [thinking]);

  // Listen for window messages to receive document content from the editor
  React.useEffect(() => {
    const handleEditorContent = (event: MessageEvent) => {
      if (event.data && event.data.type === 'editor-content') {
        console.log('Received editor content');
        try {
          // Validate that this isn't playground content
          const content = event.data.content;
          const contentObj = JSON.parse(content);
          
          // Check if this looks like placeholder content
          const isPlaceholder = JSON.stringify(contentObj).toLowerCase().includes('playground');
          
          if (!isPlaceholder) {
            console.log('Setting valid document content');
            setDocumentContent(content);
          } else {
            console.warn('Received playground content, ignoring');
          }
        } catch (e) {
          console.error('Error processing editor content:', e);
        }
      }
    };

    window.addEventListener('message', handleEditorContent);
    return () => {
      window.removeEventListener('message', handleEditorContent);
    };
  }, []);

  // Debug the current state
  React.useEffect(() => {
    console.log('Current state:', { 
      thinking,
      inputValue: input,
      documentContent: !!documentContent,
      documentId,
      hasPdfContent: !!pdfContent
    });
  }, [thinking, input, documentContent, documentId, pdfContent]);

  // Reset chat to initial state
  const handleNewChat = () => {
    const initialMessages: Message[] = [{
      id: '1',
      role: 'assistant' as const,
      content: 'Hello! I now have improved PDF handling capabilities, reliably extracting content from your documents. Each PDF also gets a helpful summary so you can easily identify it in your library.',
      timestamp: new Date(),
    }];
    
    setMessages(initialMessages);
    setInput('');
    setThinking(false);
    setHasInteraction(false);
    setPdfContent('');
    setPdfName('');
    setSelectedPdfs([]);
    
    // Save the clean state immediately
    saveMessages(initialMessages, documentId);
  };

  // Helper function to extract sources from a message
  const extractSourcesFromMessage = (content: string): { content: string, sources: Array<{ title: string, url: string, snippet?: string }> } => {
    const sources: Array<{ title: string, url: string, snippet?: string }> = [];
    let cleanContent = content;
    
    // First extract the sources section
    const sourceSectionRegex = /\n+(?:Sources|References):\s*\n+([\s\S]+)$/i;
    const sourcesBlockMatch = content.match(sourceSectionRegex);
    
    if (sourcesBlockMatch && sourcesBlockMatch[1]) {
      const sourcesBlock = sourcesBlockMatch[1];
      
      // Different citation formats
      const citationPatterns = [
        // [1]: Title (https://example.com)
        /\[([\d]+)\]:\s*(.*?)\s*\((https?:\/\/[^\s)]+)\)/g,
        
        // [1]: https://example.com
        /\[([\d]+)\]:\s*(https?:\/\/[^\s]+)/g,
        
        // Source: Title (https://example.com)
        /Source:?\s*(.*?)\s*\((https?:\/\/[^\s)]+)\)/gi,
        
        // Just URLs with titles
        /([^:\n]+):\s*(https?:\/\/[^\s]+)/g,
        
        // Numbered list with URLs
        /(\d+)\.\s+(.*?)\s*\((https?:\/\/[^\s)]+)\)/g,
        
        // Numbered list with just URLs
        /(\d+)\.\s+(https?:\/\/[^\s]+)/g
      ];
      
      // Process the sources block with each pattern
      for (const pattern of citationPatterns) {
        let match;
        while ((match = pattern.exec(sourcesBlock)) !== null) {
          // Different patterns have different group structures
          if (match.length >= 4) {
            // Pattern with number, title and URL (e.g., numbered list with URL)
            sources.push({
              title: match[2] || `Source ${match[1]}`,
              url: match[3],
              snippet: ""
            });
          } else if (match.length >= 3) {
            // Pattern with identifier/title and URL
            const hasUrl = match[2]?.startsWith('http');
            sources.push({
              title: hasUrl ? `Source ${match[1]}` : match[1] || `Source ${match[1]}`,
              url: hasUrl ? match[2] : match[3] || match[2],
              snippet: ""
            });
          }
        }
      }
      
      // Remove the sources block from the content, but keep the inline citations
      cleanContent = content.replace(sourcesBlockMatch[0], '');
    }
    
    // Process inline website references - identify potential website references in text
    // and convert them to numbered citations
    
    // Step 1: Find and map website references to sources 
    const websitePatterns = [
      // Pattern: ([wiki-raamsdonk.nl](https://wiki-raamsdonk.nl/...)) 
      /\(\[([^\]]+)\]\(([^)]+)\)\)/g,
      
      // Pattern: [wiki-raamsdonk.nl](https://wiki-raamsdonk.nl/...)
      /\[([^\]]+)\]\(([^)]+)\)/g,
      
      // Pattern: (https://example.com)
      /\((https?:\/\/[^\s)]+)\)/g,
      
      // Handle these specific formats from the examples seen
      /\(\[([^\]]+)\]\)/g, // ([wiki-raamsdonk.nl])
      
      // Last resort - find any remaining URLs
      /(https?:\/\/[^\s]+)/g
    ];
    
    // Track where each source is referenced in the text
    let sourceReferences: Array<{sourceIndex: number, start: number, end: number, text: string}> = [];
    let currentSourceIndex = sources.length;
    
    // First, collect all sources and their positions
    for (const pattern of websitePatterns) {
      let match;
      // Reset pattern execution for each new pattern
      const tempContent = cleanContent;
      while ((match = pattern.exec(tempContent)) !== null) {
        // Skip if this match is already inside a found reference
        if (sourceReferences.some(ref => match!.index >= ref.start && match!.index < ref.end)) {
          continue;
        }
        
        let url = '';
        let title = '';
        
        if (pattern.toString().includes('(https')) {
          // Direct URL in parentheses: (https://example.com)
          url = match[1];
          title = `Website ${currentSourceIndex + 1}`;
        } else if (pattern.toString().includes('\\]\\(')) {
          // Markdown style: [title](url)
          title = match[1];
          url = match[2];
        } else if (pattern.toString().includes('\\]\\)')) {
          // Just a website name in brackets and parentheses: ([wiki-raamsdonk.nl])
          title = match[1];
          url = `https://${match[1]}`; // Assume https
        } else {
          // Direct URL: https://example.com
          url = match[0];
          title = url.replace(/^https?:\/\//, '').split('/')[0];
        }
        
        // Only process if it looks like a URL
        if (url.startsWith('http')) {
          // Check if we already have this URL
          let sourceIndex = sources.findIndex(s => s.url === url);
          
          // If not found, add it
          if (sourceIndex === -1) {
            currentSourceIndex++;
            sources.push({
              title: title,
              url: url,
              snippet: ""
            });
            sourceIndex = sources.length - 1;
          }
          
          // Record the reference position
          sourceReferences.push({
            sourceIndex,
            start: match.index,
            end: match.index + match[0].length,
            text: match[0]
          });
        }
      }
    }
    
    // Sort references by position from end to start to avoid position shifts when replacing
    sourceReferences.sort((a, b) => b.start - a.start);
    
    // Replace website references with citation numbers
    for (const ref of sourceReferences) {
      const citationNumber = ref.sourceIndex + 1;
      const replacement = ` [${citationNumber}] `;
      cleanContent = cleanContent.substring(0, ref.start) + replacement + cleanContent.substring(ref.end);
    }
    
    // Clean up any remaining URLs that weren't caught
    cleanContent = cleanContent.replace(/https?:\/\/[^\s]+/g, '');
    
    // Clean up any leftover empty parentheses and extra spaces
    cleanContent = cleanContent.replace(/\(\s*\)/g, '');
    cleanContent = cleanContent.replace(/\s{2,}/g, ' ');
    cleanContent = cleanContent.trim();
    
    // Sort sources by their citation number if possible
    sources.sort((a, b) => {
      const getNum = (title: string) => {
        const match = title.match(/^Source\s*(\d+)$/);
        return match ? parseInt(match[1]) : 999;
      };
      return getNum(a.title) - getNum(b.title);
    });
    
    return { content: cleanContent, sources };
  };

  // Function to replace raw URLs in message content with citation references
  const processMessageWithSources = (content: string, sources: Array<{ title: string, url: string, snippet?: string }> | undefined) => {
    if (!sources || sources.length === 0) return { __html: content };
    
    let processedContent = content;
    
    // Replace full URLs with citation references if they exist in the text
    sources.forEach((source, index) => {
      const url = source.url;
      const safeUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special regex chars
      const urlRegex = new RegExp(`(${safeUrl})`, 'g');
      
      // Check if the URL is directly in the text
      if (processedContent.includes(url)) {
        processedContent = processedContent.replace(urlRegex, `[${index + 1}]`);
      }
    });
    
    // Convert citation references [1], [2], etc. to clickable spans
    const citationRefRegex = /\[(\d+)\]/g;
    let lastIndex = 0;
    let result = '';
    let match;
    
    while ((match = citationRefRegex.exec(processedContent)) !== null) {
      const refNum = parseInt(match[1]);
      if (refNum > 0 && refNum <= sources.length) {
        // Add text before the citation
        result += processedContent.substring(lastIndex, match.index);
        
        // Get source info
        const source = sources[refNum - 1];
        
        // Add a small space before the citation badge if needed
        if (result.length > 0 && !result.endsWith(' ')) {
          result += ' ';
        }
        
        // Add the citation as a circular badge with just the number
        result += '<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium cursor-pointer hover:bg-blue-200 transition-colors mx-0.5" data-source-index="' + 
          (refNum - 1) + '" data-source-url="' + source.url + '" title="' + source.title + '">' + 
          refNum + '</span>';
        
        lastIndex = match.index + match[0].length;
      }
    }
    
    // Add any remaining text
    if (lastIndex < processedContent.length) {
      result += processedContent.substring(lastIndex);
    }
    
    return { __html: result };
  };

  /**
   * Truncate content to a maximum length while maintaining sentence integrity
   */
  const truncateContent = (content: string, maxLength: number): string => {
    if (!content || content.length <= maxLength) return content;
    
    // Try to truncate at a sentence boundary
    const truncated = content.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    
    if (lastPeriod > maxLength * 0.8) {
      // Cut at sentence if we can maintain at least 80% of requested content
      return truncated.slice(0, lastPeriod + 1) + ` [...truncated, ${Math.floor((content.length - lastPeriod - 1) / 1000)}k chars omitted]`;
    }
    
    // Otherwise just cut at maxLength with a note
    return truncated + ` [...truncated, ${Math.floor((content.length - maxLength) / 1000)}k chars omitted]`;
  };

  // Helper function to directly call the API with fetch instead of the useChat hook
  const sendDirectApiRequest = async (userMessage: string, systemPrompt: string, skipAddingUserMessage = false) => {
    // Check for OpenAI API key
    if (!keys?.openai && !keys?.openAIKey) {
      toast.error('Missing OpenAI API key. Please add your API key in the Settings panel.');
      
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          role: 'assistant',
          content: "⚠️ I need an OpenAI API key to respond. Please add your API key in the Settings panel.",
          timestamp: new Date()
        }
      ]);
      
      setThinking(false);
      return;
    }
    
    // Create sanitized user message object for API
    const userMessageObj: Message = {
      id: String(Date.now()),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    
    // Create error message template
    const errorMessage: Message = {
      id: String(Date.now()),
      role: 'assistant',
      content: "Sorry, I encountered an error processing your request.",
      timestamp: new Date()
    };
    
    // Pre-estimate token count for PDF content
    let totalPdfTokenCount = 0;
    let largestPdfName = "";
    let largestPdfTokens = 0;
    
    // Check if we have PDFs in context and estimate their token counts
    if (selectedPdfs.length > 0) {
      for (const pdf of selectedPdfs) {
        if (pdf.content) {
          const tokenEstimate = Math.round(pdf.content.length / 4); // Rough estimate: 4 chars ≈ 1 token
          totalPdfTokenCount += tokenEstimate;
          
          if (tokenEstimate > largestPdfTokens) {
            largestPdfTokens = tokenEstimate;
            largestPdfName = pdf.name;
          }
        }
      }
      
      // If total PDF content seems too large, warn the user
      if (totalPdfTokenCount > 15000) {
        toast.warning(`Warning: You have a large amount of PDF content in context (approx. ${totalPdfTokenCount} tokens). This may cause the AI to fail or respond slowly.`);
      }
    }
    
    // Add user message to UI state if not skipping
    if (!skipAddingUserMessage) {
      setMessages(prev => [...prev, userMessageObj]);
    }
    
    // Used for source attribution in web search cases
    let sourcesList: Array<{ title: string, url: string, snippet?: string }> = [];

    try {
      // Switch to thinking state
      setThinking(true);
      
      // Get current document content if any
      const documentText = documentContent.trim();
      
      // Combine selected PDFs content in context
      let pdfContent = '';
      if (selectedPdfs.length > 0) {
        for (const pdf of selectedPdfs) {
          if (pdf.content) {
            // Use complete content without truncation for better context
            pdfContent += `=== PDF: ${pdf.name} ===\n${pdf.content}\n\n`;
          }
        }
      }
      
      // Create system message with appropriate context
      let effectiveSystemPrompt = systemPrompt || '';
      
      // Add document context if available
      if (documentText) {
        effectiveSystemPrompt += `\n\nDocument context:\n${documentText}`;
      }
      
      // Add PDF context with the relevant chunks
      if (pdfContent) {
        // Include complete PDF content for more comprehensive analysis
        effectiveSystemPrompt += pdfContent;
      } else if (selectedPdfs.length > 0) {
        // Fallback for PDFs without vector storage - include entire content
        const pdfNames = selectedPdfs.map(pdf => pdf.name).join(", ");
        effectiveSystemPrompt += `\n\nYou have access to these PDFs: ${pdfNames}`;
        
        // Add full content of each PDF for comprehensive analysis
        let allPdfContent = '';
        selectedPdfs.forEach((pdf, i) => {
          if (pdf.content) {
            allPdfContent += `\n\nContent of ${pdf.name}:\n${pdf.content}`;
          }
        });
        
        // Add complete PDF content to system prompt
        effectiveSystemPrompt += allPdfContent;
      }
      
      // Add web search instructions if enabled
      if (webSearchEnabled) {
        effectiveSystemPrompt = getSystemPromptWithWebSearch(effectiveSystemPrompt);
      }
      
      // Log the estimated token counts for debugging
      let promptTokenEstimate = Math.round((effectiveSystemPrompt.length + userMessage.length) / 4);
      console.log(`Estimated token counts - System: ${Math.round(effectiveSystemPrompt.length / 4)}, User: ${Math.round(userMessage.length / 4)}, Total: ${promptTokenEstimate}`);
      
      // Handle model selection based on context size
      let model = 'gpt-3.5-turbo'; // Default model
      
      if (webSearchEnabled) {
        model = 'gpt-4o-search-preview'; // Use search model if web search enabled
      } else if (promptTokenEstimate > 10000 || selectedPdfs.length > 0) {
        // Use GPT-4o for larger contexts or when PDFs are present for better handling
        model = 'gpt-4o';
        console.log("Using GPT-4o due to large content or PDFs present");
      } else if (promptTokenEstimate > 100000) {
        // If extremely large, warn user about potential issues
        toast.warning("Content is extremely large. The AI will do its best to analyze it completely.");
      }
      
      // Log the model choice
      console.log(`Using model: ${model} for request`);
      
      // Create the temporary UI message for streaming
      const tempMessage: Message = {
        id: String(Date.now()),
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      
      // Add the temporary message to the UI
      setMessages(prev => [...prev, tempMessage]);
      
      // Prepare the API request options
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          apiKey: keys.openai || keys.openAIKey,
          model,
          messages: [{
            role: 'user',
            content: userMessage
          }],
          system: effectiveSystemPrompt,
          web_search_options: webSearchEnabled ? { include_search_results: true } : undefined
        })
      };
      
      // Set up event source
      const response = await fetch('/api/ai/command', requestOptions);
      
      if (!response.ok) {
        let errorMessage = `API request failed with status ${response.status}`;
        
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = `${errorData.error}${errorData.details ? ': ' + errorData.details : ''}`;
          }
        } catch (e) {
          // If we can't parse the error, use the generic message
        }
        
        throw new Error(errorMessage);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response stream reader');
      }
      
      let receivedText = '';
      let responseMessageId = tempMessage.id;
      
      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream completed');
          break;
        }
        
        if (!value) continue;
        
        // Decode the received chunk
        const chunk = new TextDecoder().decode(value);
        
        // Parse SSE messages (data: {...})
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(5);
            
            if (data === '[DONE]') {
              console.log('Received [DONE] marker');
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.error) {
                console.error('Error in stream:', parsed.error);
                throw new Error(parsed.error);
              }
              
              if (parsed.content) {
                receivedText += parsed.content;
                
                // Process the response for web search sources if present
                if (receivedText.includes('Sources:') && webSearchEnabled) {
                  const { content, sources } = extractSourcesFromMessage(receivedText);
                  if (sources.length > 0) {
                    sourcesList = sources;
                    receivedText = content;
                  }
                }
                
                // Update message content with the received text
                setMessages(prev => prev.map(msg => 
                  msg.id === responseMessageId 
                    ? { ...msg, content: receivedText, sources: sourcesList.length > 0 ? sourcesList : undefined }
                    : msg
                ));
              }
            } catch (e) {
              console.warn('Error parsing SSE data:', e, 'Raw data:', data);
            }
          }
        }
      }
      
      // If we received no text, show an error
      if (receivedText.trim() === '') {
        throw new Error('No response received from AI. This could be due to the PDF content being too large. Try asking about specific parts of the PDF rather than the entire document.');
      }
      
      // Scroll to bottom after receiving message
      scrollToBottom();
      
      // Save messages to localStorage
      saveMessages(messages, documentId);
      
      // Mark that we've had an interaction
      setHasInteraction(true);
    } catch (error) {
      console.error('API error:', error);
      
      // Prepare error message based on error type
      const errorContent = error instanceof Error ? error.message : 'Unknown error';
      
      // Format helpful error messages for common issues
      let userFriendlyMessage = "Sorry, there was an error processing your request.";
      
      if (errorContent.includes('API key')) {
        userFriendlyMessage = "There seems to be an issue with your OpenAI API key. Please check that it's valid and has sufficient credits.";
      } 
      else if (errorContent.includes('content') && errorContent.includes('large')) {
        // This is likely due to large PDFs
        userFriendlyMessage = `The PDF content is too large for the AI to process. Try asking about specific parts of ${largestPdfName || 'the PDF'} instead of the entire document. For example: "Summarize page 3" or "What does the introduction say about X?"`;
      }
      else if (errorContent.includes('timed out') || errorContent.includes('timeout')) {
        userFriendlyMessage = "The request timed out. This might be due to the large size of the PDF content. Try asking about specific sections instead.";
      }
      else if (errorContent.includes('rate limit') || errorContent.includes('overloaded')) {
        userFriendlyMessage = "OpenAI's servers are currently busy. Please try again in a few moments.";
      }
      
      // Add error message to chat
      const errorMessage: Message = {
        id: String(Date.now()),
        role: 'assistant',
        content: userFriendlyMessage,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      // Show toast notification
      toast.error(userFriendlyMessage);
    } finally {
      // End the thinking state regardless of outcome
      setThinking(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || thinking) return;
    
    // Get document content for context
    let formattedContent = '';
    try {
      if (documentContent) {
        console.log('Formatting document content');
        const parsed = JSON.parse(documentContent);
        const extractedText = extractTextFromPlateNodes(parsed);
        formattedContent = extractedText || JSON.stringify(parsed, null, 2);
        console.log('Document content formatted, length:', formattedContent.length);
      }
    } catch (e) {
      console.error('Error parsing document content:', e);
      formattedContent = documentContent || '';
    }
    
    // Create a custom message to send
    const userMsg = {
      role: 'user',
      content: input,
    };

    // Add to UI messages
    const newUiMessage: Message = {
      id: String(Date.now()),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    // Add the current message to UI messages
    setMessages(prev => [...prev, newUiMessage]);
    setInput('');
    setHasInteraction(true);
    setThinking(true);
    
    // Update fetchAndProcessResponse to include web search
    async function fetchAndProcessResponse() {
      try {
        // Prepare the context - for PDFs, we'll use the better approach
        // of querying the vector DB for relevant content based on the user query
        let relevantPdfContent = '';
        
        if (selectedPdfs.length > 0 && selectedPdfs.some(pdf => pdf.pdf_id)) {
          // For PDFs with backend IDs, query the vector DB
          try {
            // Query more chunks (5 instead of 3) to get more comprehensive coverage
            const queryResults = await queryPdfContent(input, 10);
            
            if (queryResults.success && queryResults.results.length > 0) {
              relevantPdfContent = "\n\nRelevant PDF content:\n";
              
              // Add each relevant chunk
              queryResults.results.forEach((result: any, index: number) => {
                // Find the PDF name from the metadata
                const pdfId = result.metadata?.pdf_id;
                const pdf = selectedPdfs.find(p => p.pdf_id === pdfId);
                const pdfName = pdf ? pdf.name : "Unknown PDF";
                
                // Calculate relevance score (1 is best, higher numbers are worse)
                const relevancePercent = Math.round((1 - result.relevance_score) * 100);
                
                // Only include chunks with decent relevance (above 50%)
                if (relevancePercent > 50) {
                  relevantPdfContent += `\n--- From ${pdfName} (Relevance: ${relevancePercent}%) ---\n`;
                  relevantPdfContent += result.content + "\n";
                }
              });
            } else if (queryResults.error) {
              console.error("Error querying PDF content:", queryResults.error);
              // If there's specifically an API key error, throw it to be handled by the catch block
              if (queryResults.error.includes("API key")) {
                throw new Error(queryResults.error);
              }
            }
          } catch (error) {
            console.error("Error querying PDFs:", error);
            // If it's an API key error, throw it to be handled by the outer catch
            if (error instanceof Error && error.message.includes("API key")) {
              throw error;
            }
          }
        }
        
        // Create system prompt
        let systemPrompt = `You are an AI assistant helping with document analysis and questions. Be clear, accurate, and helpful in your responses.`;
        
        // Add document content if available, but truncate if too large
        if (formattedContent && formattedContent.trim().length > 0) {
          const truncatedDocContent = truncateContent(formattedContent, 50000);
          systemPrompt += `\n\nHere is the current document content:
\`\`\`
${truncatedDocContent}
\`\`\``;
        }

        // Add PDF context with the relevant chunks
        if (relevantPdfContent) {
          // Include complete PDF content for more comprehensive analysis
          systemPrompt += relevantPdfContent;
        } else if (selectedPdfs.length > 0) {
          // Fallback for PDFs without vector storage - include entire content
          const pdfNames = selectedPdfs.map(pdf => pdf.name).join(", ");
          systemPrompt += `\n\nYou have access to these PDFs: ${pdfNames}`;
          
          // Add full content of each PDF for comprehensive analysis
          let allPdfContent = '';
          selectedPdfs.forEach((pdf, i) => {
            if (pdf.content) {
              allPdfContent += `\n\nContent of ${pdf.name}:\n${pdf.content}`;
            }
          });
          
          // Add complete PDF content to system prompt
          systemPrompt += allPdfContent;
        }

        // Add instruction to base responses on provided content
        systemPrompt += `\n\nIf asked about the document or PDF, summarize the relevant content. Base your responses strictly on the provided content. If you don't know something or it's not in the content, admit that you don't know rather than making up information.`;
        
        // Add web search capability if enabled
        systemPrompt = getSystemPromptWithWebSearch(systemPrompt);
        
        // Call OpenAI API directly
        const openApiKey = keys?.openai || keys?.openAIKey;
        
        if (!openApiKey) {
          throw new Error("OpenAI API key not found. Please add your API key in the Settings panel.");
        }
        
        // Determine the model to use - use search-enabled models if web search is enabled
        let model = keys?.openaiModel || "gpt-3.5-turbo";
        if (webSearchEnabled) {
          // Use search-enabled models
          model = "gpt-4o-search-preview";
          console.log("Web search enabled - forcing model to gpt-4o-search-preview");
        }
        
        // Replace with your API call
        const apiCall = {
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            // Convert UI messages to API format
            ...messages
              .filter(msg => msg.role === 'user' || msg.role === 'assistant')
              .map(msg => ({
                role: msg.role,
                content: msg.content
              })),
            { role: "user", content: input }
          ],
          // Add web search options if enabled
          ...(webSearchEnabled && { web_search_options: { search_context_size: "medium" } })
        };
        
        // Call the API
        console.log('Calling OpenAI API with:', {
          model: apiCall.model,
          messageCount: apiCall.messages.length,
          systemPromptLength: systemPrompt.length,
          webSearchEnabled
        });
        
        // Use the existing sendDirectApiRequest function instead of simulation
        sendDirectApiRequest(input, systemPrompt, true);
        
      } catch (error) {
        console.error('Error in API call:', error);
        
        // Handle error
        const errorMsg: Message = {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date()
        };
        
        const updatedMessages = [...messages, newUiMessage, errorMsg];
        setMessages(updatedMessages);
        setThinking(false);
        
        // Save messages to localStorage
        saveMessages(updatedMessages, documentId);
      }
    }
    
    // Start the response process
    fetchAndProcessResponse();
    
    // Scroll to bottom after message is added
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // Helper function to extract text from Plate document structure
  const extractTextFromPlateNodes = (nodes: any[]): string => {
    if (!Array.isArray(nodes)) return '';
    
    return nodes.map(node => {
      if (typeof node.text === 'string') {
        return node.text;
      }
      if (Array.isArray(node.children)) {
        return extractTextFromPlateNodes(node.children);
      }
      return '';
    }).join(' ');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Function to copy text to clipboard
  const copyToClipboard = (text: string, messageId: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        // Set copied state to show feedback
        setCopiedMessageId(messageId);
        // Reset after 2 seconds
        setTimeout(() => {
          setCopiedMessageId(null);
        }, 2000);
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };

  // Create a hidden file input element
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Function to trigger file selection dialog
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle removing a PDF from the selected context
  const handleRemovePdfFromContext = (id: string) => {
    setSelectedPdfs(prev => prev.filter(pdf => pdf.id !== id));
    toast.info('PDF removed from context');
  };

  // Add a PDF to chat context
  const handleAddPdfToContext = (
    pdfId: string, 
    pdfName: string, 
    pdfContent: string, 
    backendPdfId?: string,
    summary?: string
  ) => {
    if (!pdfContent) return;
    
    // Format PDF content for context - no longer truncating content
    const summaryText = summary ? `Summary: ${summary}\n\n` : '';
    const formattedContent = `
📄 PDF: ${pdfName}
${summaryText}Content:
${pdfContent.trim()}
    `.trim();
    
    // Add system message to let user know PDF was added
    setMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        role: 'system',
        content: `📄 Added PDF: "${pdfName}" to the conversation context.${summaryText}`,
        timestamp: new Date(),
        metadata: {
          type: 'pdf_added',
          pdfId,
          backendPdfId
        }
      }
    ]);
    
    // Focus input after adding PDF
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  // Function to toggle web search
  const toggleWebSearch = () => {
    setWebSearchEnabled(!webSearchEnabled);
    
    const newStatus = !webSearchEnabled;
    if (newStatus) {
      toast.success("Web search enabled. The AI can now search the internet for up-to-date information.", {
        icon: <Globe className="h-4 w-4 text-blue-600" />,
        duration: 4000
      });
      
      // Add a helpful message to the chat
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          role: 'assistant',
          content: "🌐 **Web search enabled.** I can now search the internet for current information.\n\nFor the best results:\n- Ask specific questions about current events, facts, or data\n- I'll include numbered sources [1], [2] in my answers\n- Source citations will appear directly below my response\n\nWhat would you like to know about?",
          timestamp: new Date()
        }
      ]);
    } else {
      toast.info("Web search disabled", {
        icon: <X className="h-4 w-4" />
      });
    }
    
    return newStatus;
  };

  // Add a useEffect to check for API key on component load:
  React.useEffect(() => {
    // Check for API key on component load
    if (!keys?.openai && !keys?.openAIKey && selectedPdfs.length > 0) {
      setMessages(prev => [
        ...prev, 
        {
          id: String(Date.now()),
          role: 'assistant',
          content: "⚠️ No OpenAI API key found. Please add your API key in the Settings panel to use PDF functionality with chat.",
          timestamp: new Date()
        }
      ]);
    }
  }, [selectedPdfs.length, keys?.openai, keys?.openAIKey]);

  /**
   * Add web search instructions to the system prompt
   */
  const getSystemPromptWithWebSearch = (basePrompt: string) => {
    // Extract PDF summaries for better search context
    let pdfSummaries = '';
    if (selectedPdfs.length > 0) {
      pdfSummaries = selectedPdfs
        .filter(pdf => pdf.summary)
        .map(pdf => `- ${pdf.name}: ${pdf.summary}`)
        .join('\n');
      
      if (pdfSummaries) {
        pdfSummaries = `\n\nPDF summaries for search context:\n${pdfSummaries}`;
      }
    }
    
    return `${basePrompt}${pdfSummaries}

You have access to web search. Based on the user's query, decide whether to search for more information on the web.

When searching, follow these principles:
1. If the user's question is directly asking for web search, perform a search.
2. If the user's query might benefit from recent information, perform a search.
3. If the query relates to specific facts, statistics, news, or evolving topics, perform a search.
4. If the user explicitly asks not to search, don't search.
5. If the information is clearly in the PDF context already, you might not need to search.

When including search results in your answer, be sure to cite sources using [1], [2], etc. and include a "Sources" section at the end with numbered links. If the source provides particularly relevant information, you may quote brief passages.`;
  };

  // Update the SourcesList component with better styling
  const SourcesList = ({ sources }: { sources: Array<{ title: string, url: string, snippet?: string }> }) => {
    if (!sources || sources.length === 0) return null;
    
    return (
      <div className="mt-3 pt-2 border-t border-gray-200">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Globe className="h-3 w-3 text-blue-600" />
          <div className="text-xs font-medium text-gray-700">Sources</div>
        </div>
        <div className="space-y-1.5">
          {sources.map((source, index) => (
            <div key={index} className="text-xs flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-medium shrink-0">
                  {index + 1}
                </span>
                <span className="text-gray-800 truncate">{source.title}</span>
              </div>
              <a 
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 flex items-center shrink-0 ml-2"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                <span>Visit</span>
              </a>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Add PDF content to messages
  const addPdfContentToMessages = (
    pdfId: string, 
    pdfName: string, 
    pdfContent: string, 
    backendPdfId?: string,
    summary?: string
  ) => {
    if (!pdfContent) return;
    
    // Format PDF content for messages
    const summaryText = summary ? `\n\nSummary: ${summary}` : '';
    
    // Add system message to let user know PDF was added
    setMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        role: 'system',
        content: `📄 Added PDF: "${pdfName}" to the conversation context.${summaryText}`,
        timestamp: new Date(),
        metadata: {
          type: 'pdf_added',
          pdfId,
          backendPdfId
        }
      }
    ]);
    
    // Focus input after adding PDF
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  // Handler for adding PDFs from the library
  const handleAddPdfFromLibrary = async (pdf: PdfDocument) => {
    try {
      setActiveView('chat');
      
      // If PDF has a file property but no pdf_id, extract the content
      if (pdf.file) {
        setIsPdfUploading(true);
        
        try {
          const result = await extractTextFromPdf(pdf.file);
          
          if (result.text && result.text.length > 0) {
            // Clean text with sanitizer
            const cleanedText = sanitizePdfContent(result.text);
            
            // Add to selected PDFs
            const updatedPdf: PdfDocument = {
              id: pdf.id,
              name: pdf.name,
              size: pdf.size,
              date: pdf.date,
              content: cleanedText,
              pdf_id: result.pdf_id,
              preview: pdf.preview,
              summary: result.summary
            };
            
            // Add to selected PDFs
            setSelectedPdfs(prev => [...prev, updatedPdf]);
            
            // Add formatted content to context
            addPdfContentToMessages(updatedPdf.id, updatedPdf.name, cleanedText, updatedPdf.pdf_id, updatedPdf.summary);
            
            console.log('PDF content extracted successfully:', updatedPdf.name);
            toast.success(`PDF "${pdf.name}" added to context`);
          } else {
            toast.error("Could not extract meaningful text from this PDF.");
          }
        } catch (error) {
          console.error("Error extracting text from PDF:", error);
          toast.error("Failed to extract text from PDF.");
        } finally {
          setIsPdfUploading(false);
        }
      } else if (pdf.content) {
        // Add to selected PDFs
        setSelectedPdfs(prev => [...prev, pdf]);
        
        // Use existing content
        addPdfContentToMessages(pdf.id, pdf.name, pdf.content, pdf.pdf_id, pdf.summary);
        
        toast.success(`PDF "${pdf.name}" added to context`);
      } else {
        // Neither content nor file is available
        toast.error("PDF content not available. Try uploading the PDF again.");
      }
    } catch (error) {
      console.error("Error processing PDF:", error);
      toast.error("Error processing PDF. Please try again.");
      setIsPdfUploading(false);
    }
    
    // Switch back to chat view even if there was an error
    setActiveView('chat');
  };

  // Add this function if you're going to query PDF content
  const handleQueryPdf = async (query: string) => {
    try {
      setIsSearching(true);
      setSearchQuery(query);
      
      const result = await queryPdfContent(query, 5);
      
      if (result.success && result.results.length > 0) {
        // Process the results
        return result.results;
      } else {
        console.warn(`No PDF content found for query: ${query}`);
        if (result.error) {
          toast.error(`PDF query error: ${result.error}`);
        }
        return [];
      }
    } catch (error) {
      console.error("Error querying PDF:", error);
      toast.error("Failed to search PDF content");
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background border shadow-sm">
      <div className="flex items-center h-[41px] px-4 border-b bg-muted/20">
        <div className="flex-1 flex">
          <Tabs 
            defaultValue="chat"
            value={activeView}
            onValueChange={(value: string) => {
              // Cast the string value to our type
              setActiveView(value as 'chat' | 'library');
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 h-8 bg-transparent">
              <TabsTrigger value="chat" className="flex items-center justify-center gap-2 px-3 rounded-none">
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium">Chat</span>
              </TabsTrigger>
              <TabsTrigger value="library" className="flex items-center justify-center gap-2 px-3 rounded-none">
                <Library className="h-4 w-4" />
                <span className="font-medium">PDFs</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-2"
          onClick={handleNewChat}
        >
          <PlusIcon className="h-4 w-4" />
          <span className="sr-only">New Chat</span>
        </Button>
      </div>
      
      <div className="flex-1 overflow-hidden">
        {activeView === 'chat' ? (
          <div className="h-full flex flex-col">
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto py-3 px-4" ref={messagesEndRef}>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-2 max-w-sm">
                    <h3 className="font-semibold text-lg">AI Assistant</h3>
                    <p className="text-sm text-muted-foreground">
                      Ask questions about your document or upload a PDF for context.
                    </p>
                  </div>
                  {selectedPdfs.length > 0 && (
                    <div className="flex flex-col items-center mt-4">
                      <div className="flex gap-2 flex-wrap justify-center">
                        {selectedPdfs.map(pdf => (
                          <Badge 
                            key={pdf.id}
                            variant="secondary"
                            className="flex items-center gap-1 pl-1.5 h-6 text-xs"
                          >
                            <FileText className="h-3 w-3" />
                            <span className="max-w-[120px] truncate">{pdf.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 p-0 ml-1 text-muted-foreground hover:text-foreground"
                              onClick={() => handleRemovePdfFromContext(pdf.id)}
                            >
                              <X className="h-3 w-3" />
                              <span className="sr-only">Remove</span>
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex w-full",
                message.role === 'user' && "justify-end"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2 relative",
                  message.role === 'user' 
                    ? "bg-gray-100" 
                    : "bg-white"
                )}
              >
                {message.sources && message.sources.length > 0 ? (
                  <div 
                    className="text-sm"
                    dangerouslySetInnerHTML={processMessageWithSources(message.content, message.sources)}
                    onClick={(e) => {
                      // Handle clicks on citation references
                      const target = e.target as HTMLElement;
                      if (target.hasAttribute('data-source-index')) {
                        const index = parseInt(target.getAttribute('data-source-index') || '0');
                        const url = target.getAttribute('data-source-url');
                        if (url) {
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }
                      }
                    }}
                  />
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
                
                {message.role === 'assistant' && message.content !== '...' && (
                  <>
                    {message.sources && message.sources.length > 0 && (
                      <SourcesList sources={message.sources} />
                    )}
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                        onClick={() => copyToClipboard(message.content, message.id)}
                      >
                        {copiedMessageId === message.id ? (
                          <CheckIcon className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span className="sr-only">Copy</span>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          
          {thinking && (
            <div className="flex w-full">
              <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-white">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  <p className="text-sm text-gray-500">Thinking...</p>
                </div>
              </div>
            </div>
          )}
          
                  {/* PDF Debug Info */}
                  {showDebugInfo && pdfDebugInfo && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDebugInfo(false)}>
                      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg max-w-md w-full p-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-medium">PDF Debug Information</h3>
                          <Button size="icon" variant="ghost" onClick={() => setShowDebugInfo(false)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mb-4 text-sm bg-slate-50 dark:bg-slate-900 p-3 rounded border overflow-auto max-h-[300px]">
                          <pre className="whitespace-pre-wrap">{pdfDebugInfo}</pre>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          This information can help troubleshoot PDF upload issues. Please try a different PDF file.
                        </p>
                        <details className="text-xs text-slate-500 dark:text-slate-400">
                          <summary className="cursor-pointer">Troubleshooting Tips</summary>
                          <ul className="mt-2 space-y-1 list-disc pl-5">
                            <li>Make sure your PDF is not password-protected or encrypted</li>
                            <li>Try saving the PDF with a different PDF viewer or converter</li>
                            <li>Ensure your OpenAI API key is valid and has sufficient credits</li>
                            <li>Upload a smaller PDF file if you're encountering timeout issues</li>
                            <li>If the PDF contains scanned images, try using a PDF with actual text</li>
                          </ul>
                        </details>
                        <div className="flex justify-end mt-4">
                          <Button size="sm" onClick={() => {
                            setShowDebugInfo(false);
                            if (fileInputRef.current) {
                              fileInputRef.current.click();
                            }
                          }}>Try Another PDF</Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Input area */}
            <div className="border-t p-3">
              {isPdfUploading ? (
                <div className="flex items-center justify-center p-2">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm">Processing PDF...</span>
                </div>
              ) : (
                <>
                  {/* Context display badges */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {(selectedPdfs.length > 0 || webSearchEnabled) && (
                      <div className="text-xs text-muted-foreground flex items-center mr-1">
                        <BookOpen className="h-3.5 w-3.5 mr-1" />
                        Context:
                      </div>
                    )}
                    
                    {/* Web search badge */}
                    {webSearchEnabled && (
                      <Badge 
                        variant="secondary"
                        className="flex items-center gap-1 pl-1.5 h-6 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100"
                      >
                        <Globe className="h-3 w-3" />
                        <span>Web Search</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 ml-1 text-blue-500 hover:text-blue-700"
                          onClick={() => {
                            toggleWebSearch();
                          }}
                        >
                          <X className="h-3 w-3" />
                          <span className="sr-only">Disable Web Search</span>
                        </Button>
                      </Badge>
                    )}
                    
                    {selectedPdfs.map(pdf => (
                      <Badge 
                        key={pdf.id}
                        variant="secondary"
                        className="flex items-center gap-1 pl-1.5 h-6 text-xs"
                      >
                        <FileText className="h-3 w-3" />
                        <span className="max-w-[120px] truncate">{pdf.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 ml-1 text-muted-foreground hover:text-foreground"
                          onClick={() => handleRemovePdfFromContext(pdf.id)}
                        >
                          <X className="h-3 w-3" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </Badge>
                    ))}
                  </div>
                  
                  {/* Single Add Context button with dropdown */}
        <div className="flex items-center mb-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 px-3 text-xs text-muted-foreground"
                        >
                          <Library className="h-3.5 w-3.5" />
                          Add Context
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-60 p-2" align="start">
                        <div className="space-y-2">
                          {/* PDFs section header */}
                          <div className="text-xs font-medium text-muted-foreground p-1">Your PDFs</div>
                          
                          {selectedPdfs.length > 0 ? (
                            <div className="max-h-[200px] overflow-y-auto space-y-1">
                              {selectedPdfs.map(pdf => (
                                <div key={pdf.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <span className="text-xs truncate max-w-[150px]">{pdf.name}</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
                                    onClick={() => handleRemovePdfFromContext(pdf.id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-2 text-center text-sm text-muted-foreground">
                              No PDFs added to context
                            </div>
                          )}
                          
                          <div className="pt-2 border-t">
                            <Button
                              variant={webSearchEnabled ? "default" : "outline"}
                              size="sm"
                              className="w-full justify-start text-xs h-8 gap-2 mb-2"
                              onClick={toggleWebSearch}
                            >
                              <Globe className="h-3.5 w-3.5" />
                              {webSearchEnabled ? "Web Search Enabled" : "Enable Web Search"}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full justify-start text-xs h-8 gap-2"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <FileUp className="h-3.5 w-3.5" />
                              Upload New PDF
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-xs h-8 gap-2"
                              onClick={() => setActiveView('library')}
                            >
                              <Library className="h-3.5 w-3.5" />
                              Browse PDFs
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
        
        <div className="relative w-full">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
                      placeholder="Ask a question..."
            className="min-h-[100px] w-full resize-none pr-10"
            disabled={thinking}
          />
          <Button 
            onClick={handleSend}
            size="icon"
                      className="absolute top-2 right-2 h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!input.trim() || thinking}
          >
                      {thinking ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
            <SendIcon className="h-4 w-4" />
                      )}
                      <span className="sr-only">Send</span>
          </Button>
        </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".pdf"
                    onChange={handleFileInputChange}
                  />
                </>
              )}
            </div>
          </div>
        ) : (
          <PdfLibrary onSelect={handleSelectPdf} />
        )}
      </div>
    </div>
  );
} 