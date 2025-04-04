'use client';

import * as React from 'react';
import { SendIcon, PlusIcon, Loader2, Copy, CheckIcon } from 'lucide-react';

import { cn } from '@udecode/cn';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { useChat } from '@/components/editor/use-chat';
import { useSettings } from '@/components/editor/settings';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export function AiChat() {
  // Local state for UI messages
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! How can I assist you with your document today?',
      timestamp: new Date(),
    },
  ]);
  
  // Get settings to access the OpenAI API key
  const { keys } = useSettings();
  
  // Use the existing chat hook with OpenAI API
  const { messages: apiMessages, input, setInput, handleSubmit, isLoading } = useChat();
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [documentContent, setDocumentContent] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [hasInteraction, setHasInteraction] = React.useState(false);
  
  // State to track which message was recently copied
  const [copiedMessageId, setCopiedMessageId] = React.useState<string | null>(null);

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
        setDocumentContent(event.data.content);
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
      documentContent: !!documentContent
    });
  }, [thinking, isLoading, apiMessages.length, input, documentContent]);

  // Helper function to directly call the API with fetch instead of the useChat hook
  const sendDirectApiRequest = async (userMessage: string, systemPrompt: string) => {
    try {
      console.log('Sending direct API request');
      
      // Add user message to UI
      const userMessageObj: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      };
      
      setMessages(prevMessages => [...prevMessages, userMessageObj]);
      
      // Prepare request body
      const requestBody = {
        messages: [{ role: 'user', content: userMessage }],
        system: systemPrompt,
        apiKey: keys.openai,
        model: 'gpt-4o',
      };
      
      // Call API directly
      const response = await fetch('/api/ai/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
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
      
      // Start showing a temporary message
      const tempMessage: Message = {
        id: responseId,
        role: 'assistant',
        content: '...',
        timestamp: new Date(),
      };
      
      setMessages(prevMessages => [...prevMessages, tempMessage]);
      
      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Convert the chunk to text
        const chunk = new TextDecoder().decode(value);
        
        // Process the chunk (Server-Sent Events format)
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') {
              // Stream is complete
              console.log('Stream complete');
              break;
            }
            
            try {
              const parsedData = JSON.parse(data);
              if (parsedData.content) {
                responseContent += parsedData.content;
                
                // Update the message with the current content
                setMessages(prevMessages => prevMessages.map(msg => 
                  msg.id === responseId 
                    ? { ...msg, content: responseContent } 
                    : msg
                ));
              }
            } catch (e) {
              console.log('Error parsing chunk data:', e);
            }
          }
        }
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
        setMessages(prevMessages => prevMessages.map(msg => 
          msg.id === responseId 
            ? { ...msg, content: 'No response received from AI.' } 
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
        content: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      
      setMessages(prevMessages => [...prevMessages, errorMessage]);
      setThinking(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || thinking) return;
    
    // Get document content for context
    let formattedContent = 'No document content available.';
    try {
      if (documentContent) {
        console.log('Formatting document content');
        const parsed = JSON.parse(documentContent);
        const extractedText = extractTextFromPlateNodes(parsed);
        formattedContent = extractedText || JSON.stringify(parsed, null, 2);
      }
    } catch (e) {
      console.error('Error parsing document content:', e);
      formattedContent = documentContent || 'No document content available.';
    }
    
    // Create system prompt with document context
    const systemPrompt = `You are an AI assistant helping with a document. Answer questions about this document in a helpful way.
    
Here is the current document content:
\`\`\`
${formattedContent}
\`\`\``;

    // Set thinking state and interaction flag
    setThinking(true);
    setHasInteraction(true);
    
    // Use direct API request instead of the useChat hook
    const userInput = input;
    setInput('');
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

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div className="flex items-center border-b px-4 py-2 bg-white h-[41px]">
        <h3 className="font-medium">AI Assistant</h3>
      </div>
      
      <ScrollArea className="flex-1 p-4 bg-white">
        <div className="flex flex-col space-y-4">
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
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <div className="border-t p-4 bg-white">
        <div className="flex items-center mb-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-xs text-muted-foreground hover:bg-muted rounded-md flex items-center gap-1"
            onClick={() => {
              // Update input with a command to analyze the document
              setInput("Analyze my document and provide insights");
            }}
            disabled={thinking}
          >
            <span className="text-muted-foreground">@</span>
            Add document context
          </Button>
        </div>
        
        <div className="relative w-full">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI for help..."
            className="min-h-[100px] w-full resize-none pr-10"
            disabled={thinking}
          />
          <Button 
            onClick={handleSend}
            size="icon"
            variant="ghost"
            className="absolute right-3 top-2 h-6 w-6 p-0"
            disabled={!input.trim() || thinking}
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
} 