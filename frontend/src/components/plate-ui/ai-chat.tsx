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
  X
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { useChat } from '@/components/editor/use-chat';
import { useSettings } from '@/components/editor/settings';
import { useUploadFile } from '@/lib/uploadthing';
import { toast } from 'sonner';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { PdfLibrary } from './pdf-library';
import { extractTextFromPdf, sanitizePdfContent as pdfsanitize } from './pdf-utils';
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

// Helper function to sanitize PDF content to avoid sending binary/encoded data

// Define our local PdfDocument type to have all the properties we need
type PdfDocument = {
  id: string;
  name: string;
  size: number;
  date: Date;
  file?: File;
  content?: string;
  preview?: string;
};

export function AiChat() {
  const documentId = getDocumentId();
  
  // Local state for UI messages
  const [messages, setMessages] = React.useState<Message[]>(() => loadMessages(documentId));
  
  // Get settings to access the OpenAI API key
  const { keys } = useSettings();
  
  // Use the existing chat hook with OpenAI API
  const { messages: apiMessages, input, setInput, handleSubmit, isLoading } = useChat();
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
      // If the PDF already has content, use it
      if (pdf.content) {
        handleAddPdfToContext(pdf.id, pdf.name, pdf.content);
        return;
      }
      
      // If PDF has a file property, extract the content
      if (pdf.file) {
        setIsPdfUploading(true);
        
        try {
          const extractedText = await extractTextFromPdf(pdf.file);
          // Clean text with sanitizer
          const cleanedText = pdfsanitize(extractedText);
          
          if (cleanedText && cleanedText.length > 0) {
            handleAddPdfToContext(pdf.id, pdf.name, cleanedText);
            
            // Update the PDF in the library with the extracted content
            const updatedPdf = {
              ...pdf,
              content: cleanedText
            };
            
            // This would need proper implementation if pdfs state is managed elsewhere
            console.log('PDF content extracted successfully:', updatedPdf.name);
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
      
      // Collect debug info
      let debugLog: string[] = [
        `PDF Upload Debug Log for ${file.name} (${file.size} bytes)`,
        `Browser: ${navigator.userAgent}`,
        `Time: ${new Date().toISOString()}`
      ];
      
      // Use simplified approach - extract text from PDF
      let text = '';
      
      try {
        debugLog.push(`Attempting PDF extraction...`);
        text = await extractTextFromPdf(file);
        debugLog.push(`Extraction complete, text length: ${text?.length || 0}`);
        
        // Clean the text with sanitizer
        text = pdfsanitize(text);
        
        if (!text || text.length < 100) {
          throw new Error("No meaningful text could be extracted from this PDF. It may be scanned or contain only images.");
        }
      } catch (error) {
        debugLog.push(`Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error('PDF extraction failed:', error);
        
        // Set and show debug info
        setPdfDebugInfo(debugLog.join('\n'));
        setShowDebugInfo(true);
        
        toast.error("Failed to extract text from PDF. It may be scanned, encrypted, or contain only images.");
        setIsPdfUploading(false);
        event.target.value = '';
        return;
      }
      
      // Success - store the extracted text
      setPdfContent(text);
      
      const contentPreview = text.slice(0, 100).replace(/\n/g, ' ') + '...';
      toast.success(`PDF "${file.name}" processed. ${Math.round(text.length / 5)} estimated tokens.`);
      
      // Add a system message to show that PDF was added
      const systemMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `I've added the PDF "${file.name}" to our chat context. Preview of content: "${contentPreview}". You can now ask questions about it.`,
        timestamp: new Date(),
      };
      
      setMessages(prevMessages => [...prevMessages, systemMessage]);
      
      // Also create a PdfDocument object and add it to selected PDFs
      const newPdf: PdfDocument = {
        id: Date.now().toString(),
        name: file.name,
        content: text,
        size: file.size,
        date: new Date(),
        preview: contentPreview
      };
      
      // Add to selected PDFs
      setSelectedPdfs(prev => [...prev, newPdf]);
      
      // Reset the file upload state
      setIsPdfUploading(false);
      event.target.value = '';
    } catch (error) {
      console.error('Failed to process PDF:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to process PDF file';
      
      // Set debug info
      setPdfDebugInfo(`PDF processing failed: ${errorMsg}\n\n${navigator.userAgent}`);
      setShowDebugInfo(true);
      
      toast.error(errorMsg);
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

  // Update UI messages when API messages change
  React.useEffect(() => {
    // Update messages and thinking state based on apiMessages
    if (apiMessages && apiMessages.length > 0) {
      console.log('API messages updated:', apiMessages.length);
      console.log('API messages content:', apiMessages);
      
      // Create UI messages from API messages
      const uiMessages: Message[] = apiMessages.map((msg) => ({
        id: msg.id,
        role: msg.role === 'user' || msg.role === 'assistant' 
          ? msg.role 
          : 'assistant', // Default to assistant for other roles
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        timestamp: new Date(),
      }));
      
      // Update messages
      setMessages(uiMessages);
      
      // Turn off thinking animation if we have a response
      if (apiMessages.some(msg => msg.role === 'assistant')) {
        setThinking(false);
      }
      
      // Scroll to bottom
      scrollToBottom();
    } else {
      console.log('No API messages received or empty array');
    }
  }, [apiMessages]);

  // Track loading state to update thinking animation
  React.useEffect(() => {
    if (isLoading) {
      setThinking(true);
    } else if (!isLoading && hasInteraction) {
      // Delay turning off animation just to make it smoother
      setTimeout(() => setThinking(false), 300);
    }
  }, [isLoading, hasInteraction]);

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
      isLoading,
      hasMessages: apiMessages.length > 0,
      inputValue: input,
      documentContent: !!documentContent,
      documentId,
      hasPdfContent: !!pdfContent
    });
  }, [thinking, isLoading, apiMessages.length, input, documentContent, documentId, pdfContent]);

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

  // Helper function to directly call the API with fetch instead of the useChat hook
  const sendDirectApiRequest = async (userMessage: string, systemPrompt: string) => {
    try {
      console.log('Sending direct API request with system prompt length:', systemPrompt.length);
      
      // Add user message to UI
      const userMessageObj: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      };
      
      setMessages(prevMessages => [...prevMessages, userMessageObj]);
      
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
      
      // We won't truncate the system prompt - let OpenAI handle it
      // Use GPT-4 for larger context when available
      
      // Prepare request body with proper formatting
      const requestBody = {
        messages: messageHistory,
        system: systemPrompt,
        apiKey: keys.openai,
        model: keys.openaiModel || 'gpt-4o-mini',
      };
      
      // Debug logs
      console.log('API Key provided for request:', !!keys.openai);
      console.log('Message history length:', messageHistory.length);
      console.log('System prompt length:', systemPrompt.length);
      
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
        
        // Update the existing message with the complete content
        setMessages(prevMessages => prevMessages.map(msg => 
          msg.id === responseId 
            ? { ...msg, content: responseContent } 
            : msg
        ));
      } else {
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
    
    // Create system prompt, carefully handling both document and PDF content
    let systemPrompt = `You are an AI assistant helping with document analysis and questions. Be clear, accurate, and helpful in your responses.`;
    
    // Add document content if available
    if (formattedContent && formattedContent.trim().length > 0) {
      systemPrompt += `\n\nHere is the current document content:
\`\`\`
${formattedContent}
\`\`\``;
    }

    // Add PDF content from all selected PDFs without artificial length limits
    if (selectedPdfs.length > 0) {
      systemPrompt += `\n\nYou also have access to the following PDF documents:`;
      
      // Add each PDF separately with clear labeling
      selectedPdfs.forEach((pdf, index) => {
        if (!pdf.content) return;
        
        systemPrompt += `\n\n--- PDF ${index + 1}: ${pdf.name} ---\n`;
        systemPrompt += pdf.content;
      });
      
      console.log(`Added content from ${selectedPdfs.length} PDFs to the system prompt`);
    }

    systemPrompt += `\n\nIf asked about the document or PDF, summarize the relevant content. Base your responses strictly on the provided content. If you don't know something or it's not in the content, admit that you don't know rather than making up information.`;

    console.log('System prompt prepared with all PDF content, total length:', systemPrompt.length);

    // Set thinking state and interaction flag
    setThinking(true);
    setHasInteraction(true);
    
    // Use direct API request
    const userInput = input;
    setInput('');
    
    // Log what's being sent
    console.log('Sending user input:', userInput);
    console.log('Number of PDFs in context:', selectedPdfs.length);
    
    // Send the request
    sendDirectApiRequest(userInput, systemPrompt);
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

  // Define our function to handle adding a PDF to the context
  const handleAddPdfToContext = (id: string, name: string, content: string) => {
    // Check if already selected
    if (selectedPdfs.some(selected => selected.id === id)) {
      // Remove from selection if already added
      setSelectedPdfs(prev => prev.filter(p => p.id !== id));
      toast.info(`Removed "${name}" from context`);
    } else {
      // Add to selection with required PdfDocument fields
      setSelectedPdfs(prev => [...prev, { 
        id, 
        name, 
        content, 
        size: 0, // Default size since we don't have the actual size
        date: new Date() // Current date as fallback
      }]);
      toast.success(`Added "${name}" to chat context`);
    }
    
    // Switch back to chat view
    setActiveView('chat');
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
                <p className="text-sm">{message.content}</p>
                
                {message.role === 'assistant' && message.content !== '...' && (
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
                  {selectedPdfs.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <div className="text-xs text-muted-foreground flex items-center mr-1">
                        <BookOpen className="h-3.5 w-3.5 mr-1" />
                        Context:
                      </div>
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
                  )}
                  
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
                        {selectedPdfs.length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground p-1">Your PDFs</div>
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
                            <div className="pt-2 border-t">
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
                        ) : (
                          <div className="space-y-2">
                            <div className="p-2 text-center text-sm text-muted-foreground">
                              No PDFs added to context
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-xs h-8 gap-2"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <FileUp className="h-3.5 w-3.5" />
                              Upload PDF
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
                        )}
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