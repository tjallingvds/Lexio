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
import { useUploadFile } from '@/lib/uploadthing';
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
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{ title: string, url: string, snippet?: string }>;
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
        role: msg.role as 'user' | 'assistant'
      }));
    }
  } catch (e) {
    console.error('Failed to load chat messages:', e);
  }
  
  // Default welcome message
  return [{
      id: '1',
    role: 'assistant' as const,
      content: 'Hello! How can I assist you with your document today?',
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
  
  // Use uploadThing for handling file uploads
  const { isUploading } = useUploadFile({
    onUploadComplete: (file) => {
      console.log('File uploaded successfully:', file);
    },
    onUploadError: (error) => {
      console.error('File upload error:', error);
      toast.error('Failed to upload file');
    }
  });
  
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
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('PDF file is too large. Please upload a file smaller than 10MB');
      event.target.value = '';
      return;
    }
    
    try {
      setIsPdfUploading(true);
      setPdfName(file.name);
      toast.info(`Processing PDF ${file.name}. This may take a moment...`);
      
      // Use the improved extraction method
      const result = await extractTextFromPdf(file);
      
      if (!result.text || result.text.length < 100) {
        throw new Error("No meaningful text could be extracted from this PDF. It may be scanned or contain only images.");
      }
      
      // Success - add to context
      const pdfId = Date.now().toString();
      const cleanedText = sanitizePdfContent(result.text);
      handleAddPdfToContext(pdfId, file.name, cleanedText, result.pdf_id);
      
      // Also save to PDF library
      const newPdf: PdfDocument = {
        id: pdfId,
        name: file.name,
        size: file.size,
        date: new Date(),
        content: cleanedText,
        pdf_id: result.pdf_id,
        preview: result.text.slice(0, 150).replace(/\n/g, ' ') + '...'
      };
      
      // Get PDF library from localStorage
      const loadedPdfs = loadPdfLibrary();
      savePdfLibrary([...loadedPdfs, newPdf]);
      
      // Use token estimate from backend if available, otherwise calculate
      const tokenEstimate = result.token_estimate || Math.round(cleanedText.split(/\s+/).length * 1.3);
      toast.success(`PDF "${file.name}" added to context and library (approx. ${tokenEstimate} tokens)`);
    } catch (error) {
      console.error('PDF extraction failed:', error);
      setPdfDebugInfo(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setShowDebugInfo(true);
      toast.error("Failed to extract text from PDF. It may be scanned, encrypted, or contain only images.");
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
      content: 'Hello! How can I assist you with your document today?',
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

  // Helper function to truncate content to a maximum length
  const truncateContent = (content: string, maxLength: number): string => {
    if (content.length <= maxLength) return content;
    
    const halfMax = Math.floor(maxLength / 2);
    const start = content.slice(0, halfMax);
    const end = content.slice(-halfMax);
    
    return `${start}...${end}`;
  };

  // Helper function to directly call the API with fetch instead of the useChat hook
  const sendDirectApiRequest = async (userMessage: string, systemPrompt: string, skipAddingUserMessage = false) => {
    try {
      console.log('Sending direct API request with system prompt length:', systemPrompt.length);
      
      // Only add user message to UI if not skipped
      if (!skipAddingUserMessage) {
        // Add user message to UI
        const userMessageObj: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: userMessage,
          timestamp: new Date(),
        };
        
        setMessages(prevMessages => [...prevMessages, userMessageObj]);
      }
      
      // Check for API key first
      if (!keys.openai) {
        console.error('No API key available. Please set one in the settings.');
        // Add error message to chat
        const errorMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'No API key available. Please configure your OpenAI API key in the Settings panel.',
          timestamp: new Date(),
        };
        
        setMessages(prevMessages => [...prevMessages, errorMessage]);
        setThinking(false);
        return;
      }
      
      console.log('API Key available, length:', keys.openai?.length || 0);
      
      // Prepare messages array with history - use more context
      const messageHistory = messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .slice(-8) // Use last 8 messages for context
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      
      // Add the new user message
      messageHistory.push({ role: 'user', content: userMessage });
      
      console.log('Message history prepared, count:', messageHistory.length);
      
      // Determine the model to use based on web search requirement
      let model = keys.openaiModel || 'gpt-4o-mini';
      if (webSearchEnabled) {
        // Use search-enabled models when web search is enabled
        model = "gpt-4o-search-preview";
        console.log("Web search enabled - forcing model to gpt-4o-search-preview");
      }
      
      // Truncate system prompt if it's too large to prevent token limit errors
      const truncatedSystemPrompt = truncateContent(systemPrompt, 100000);
      
      // Prepare request body with proper formatting
      const requestBody: any = {
        messages: messageHistory,
        system: truncatedSystemPrompt,
        apiKey: keys.openai,
        model: model,
      };
      
      // Add web search options if enabled
      if (webSearchEnabled) {
        console.log('Adding web search options to request');
        requestBody.web_search_options = { search_context_size: "medium" };
      }
      
      // Debug logs
      console.log('API Key provided for request:', !!keys.openai);
      console.log('Message history length:', messageHistory.length);
      console.log('System prompt length (after truncation):', truncatedSystemPrompt.length);
      console.log('Original system prompt length:', systemPrompt.length);
      console.log('Using model:', model);
      console.log('Web search enabled:', webSearchEnabled);
      
      // Call the local proxy endpoint
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/ai/command`;
      console.log('Calling API at URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keys.openai}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      // Handle error responses
      if (!response.ok) {
        let errorMessage = `API request failed with status ${response.status}`;
        
        // Try to extract detailed error message
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = `${errorData.error}${errorData.details ? ': ' + errorData.details : ''}`;
            console.error('API Error:', errorMessage);
          }
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        
        throw new Error(errorMessage);
      }
      
      console.log('Direct API response received');
      
      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }
      
      // Collect response content
      let responseContent = '';
      let responseId = Date.now().toString();
      
      // Show a temporary message until we get content
      const tempMessage: Message = {
        id: responseId,
        role: 'assistant',
        content: '...',
        timestamp: new Date(),
      };
      
      setMessages(prevMessages => [...prevMessages, tempMessage]);
      console.log('Added temporary assistant message with id:', responseId);
      
      // Read the stream
      let hasReceivedContent = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('Stream reading complete');
            break;
          }
          
          // Convert the chunk to text
          const chunk = new TextDecoder().decode(value);
          
          // Process the chunk (Server-Sent Events format)
          const lines = chunk.split('\n\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              if (data === '[DONE]') {
                // Stream is complete
                console.log('Stream complete marker received');
                break;
              }
              
              try {
                const parsedData = JSON.parse(data);
                if (parsedData.content) {
                  hasReceivedContent = true;
                  responseContent += parsedData.content;
                  
                  // Update the message with the current content
                  setMessages(prevMessages => prevMessages.map(msg => 
                    msg.id === responseId 
                      ? { ...msg, content: responseContent } 
                      : msg
                  ));
                } else if (parsedData.error) {
                  // Handle error in the stream
                  throw new Error(parsedData.error);
                }
              } catch (e) {
                console.log('Error parsing chunk data:', e, 'Raw data:', data);
              }
            }
          }
        }
      } catch (streamError) {
        console.error('Error reading stream:', streamError);
        throw streamError;
      }
      
      // Finalize the response
      if (responseContent) {
        console.log('Final response content length:', responseContent.length);
        
        // Parse out any sources from the message
        const { content: cleanContent, sources } = extractSourcesFromMessage(responseContent);
        
        // Update the existing message with the complete content and any extracted sources
        setMessages(prevMessages => prevMessages.map(msg => 
          msg.id === responseId 
            ? { 
                ...msg, 
                content: cleanContent,
                ...(sources.length > 0 && { sources })
              } 
            : msg
        ));
      } else if (!hasReceivedContent) {
        // No content received, show error message
        console.error('No response content received from AI');
        
        setMessages(prevMessages => prevMessages.map(msg => 
          msg.id === responseId 
            ? { 
                ...msg, 
                content: 'No response received from AI. This could be due to the PDF content being too large. Try asking about specific parts of the PDF rather than the entire document.' 
              } 
            : msg
        ));
      }
      
      // Turn off the thinking state
      setThinking(false);
      
    } catch (error) {
      console.error('Error in direct API request:', error);
      
      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Sorry, there was an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. This may be due to the PDF content being too large for the API. Try asking about specific parts of the PDF instead.`,
        timestamp: new Date(),
      };
      
      setMessages(prevMessages => [...prevMessages, errorMessage]);
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
            const queryResults = await queryPdfContent(input, 3);
            
            if (queryResults.success && queryResults.results.length > 0) {
              relevantPdfContent = "\n\nRelevant PDF content:\n";
              
              // Add each relevant chunk
              queryResults.results.forEach((result: any, index: number) => {
                // Find the PDF name from the metadata
                const pdfId = result.metadata?.pdf_id;
                const pdf = selectedPdfs.find(p => p.pdf_id === pdfId);
                const pdfName = pdf ? pdf.name : "Unknown PDF";
                
                relevantPdfContent += `\n--- From ${pdfName} (Relevance: ${Math.round((1 - result.relevance_score) * 100)}%) ---\n`;
                relevantPdfContent += result.content + "\n";
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
          // Truncate PDF content if too large
          const truncatedPdfContent = truncateContent(relevantPdfContent, 50000);
          systemPrompt += truncatedPdfContent;
        } else if (selectedPdfs.length > 0) {
          // Fallback for PDFs without vector storage - we need to include some content
          const pdfNames = selectedPdfs.map(pdf => pdf.name).join(", ");
          systemPrompt += `\n\nYou have access to these PDFs: ${pdfNames}`;
          
          // Add a brief preview of each PDF to provide some context
          let allPdfPreviews = '';
          selectedPdfs.forEach((pdf, i) => {
            if (pdf.content) {
              const preview = pdf.content.slice(0, 300) + '...';
              allPdfPreviews += `\n\nBrief preview of ${pdf.name}:\n${preview}`;
            }
          });
          
          // Truncate all previews if too large
          systemPrompt += truncateContent(allPdfPreviews, 30000);
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
  const handleAddPdfToContext = (id: string, name: string, content: string, pdf_id?: string) => {
    // Check if this PDF is already in context
    const exists = selectedPdfs.some(pdf => pdf.id === id);
    if (exists) {
      toast.info(`PDF "${name}" is already in context`);
      return;
    }
    
    // Add to selected PDFs
    setSelectedPdfs([...selectedPdfs, {
      id,
      name,
      content,
      pdf_id,
      size: content.length,
      date: new Date()
    }]);
    
    // Switch to chat view
    setActiveView('chat');
    
    toast.success(`PDF "${name}" added to chat context`);
    
    // Show warning for large PDFs to help avoid errors
    if (content.length > 50000) {
      setTimeout(() => {
        toast.warning(
          'This PDF contains a large amount of text. To get the best responses, ask specific questions about parts of the document rather than about the entire content.',
          { duration: 6000 }
        );
        
        // Also add a helpful system message
        setMessages(prev => [
          ...prev,
          {
            id: String(Date.now()),
            role: 'assistant',
            content: "⚠️ I've noticed the PDF you added contains a lot of text. To get the best results, please ask specific questions about particular sections or topics in the document, rather than general questions about the entire content.",
            timestamp: new Date()
          }
        ]);
      }, 1000);
    }
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

  // Modify system prompt to add web search capabilities
  const getSystemPromptWithWebSearch = (basePrompt: string) => {
    if (!webSearchEnabled) return basePrompt;
    
    return `${basePrompt}

You have access to current web search results to provide up-to-date information. When answering questions about current events, trends, or topics that require recent data, incorporate relevant information from the web.

When citing web sources, follow these guidelines EXACTLY:
1. Include ONLY numbered citations [1], [2] directly after statements that use information from sources
2. NEVER include any URLs or website links in your answer text
3. NEVER include website names in parentheses like ([website.com]) - use only the citation numbers
4. NEVER use markdown-style links like [text](url) - use only citation numbers [1], [2]
5. At the end of your response, add a "Sources:" section with sources in this format:
   [1]: Title (URL)
   [2]: Title (URL)

Example of correct citation format:
"Claus-Casimir of Orange-Nassau was born on March 21, 2004 [1]. He attended Gordonstoun, a prestigious boarding school in Scotland [2]."

Sources:
[1]: Royal Family Database (https://royalty.example.com/dutch-royal-family)
[2]: Gordonstoun Alumni (https://gordonstoun.example.edu/alumni)

The citation numbers will be automatically converted to interactive badges in the user interface.`; 
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

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background rounded-lg border shadow-sm">
      <div className="flex items-center px-3 py-2 border-b bg-muted/20">
        <div className="flex-1 flex justify-center">
          <Tabs 
            defaultValue="chat"
            value={activeView}
            onValueChange={(value: string) => {
              // Cast the string value to our type
              setActiveView(value as 'chat' | 'library');
            }}
            className="w-[240px]"
          >
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="chat" className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Chat</span>
              </TabsTrigger>
              <TabsTrigger value="library" className="flex items-center gap-1">
                <Library className="h-3.5 w-3.5" />
                <span>PDF Library</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
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
                    <div className="flex w-full">
                      <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-red-50 border border-red-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-red-600">PDF Debug Information</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                            onClick={() => setShowDebugInfo(false)}
                          >
                            ×
                          </Button>
        </div>
                        <pre className="text-xs text-red-700 whitespace-pre-wrap break-words overflow-auto max-h-[300px]">
                          {pdfDebugInfo}
                        </pre>
                        <p className="text-xs mt-2 text-red-600">
                          This information can help troubleshoot PDF upload issues. Please try a different PDF file.
                        </p>
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
                              Browse PDF Library
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