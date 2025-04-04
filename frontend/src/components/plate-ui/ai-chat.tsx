'use client';

import * as React from 'react';
import { SendIcon, PlusIcon } from 'lucide-react';

import { cn } from '@udecode/cn';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export function AiChat() {
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! How can I assist you with your document today?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    
    setMessages([...messages, userMessage]);
    setInput('');
    
    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm processing your request. This is a placeholder response.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center border-b px-4 py-2">
        <h3 className="font-medium">AI Assistant</h3>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 rounded-lg p-3",
                message.role === 'assistant' 
                  ? "bg-muted" 
                  : "bg-primary text-primary-foreground"
              )}
            >
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8 rounded-full">
                  <div className="bg-primary flex h-full w-full items-center justify-center text-xs font-medium text-primary-foreground">
                    AI
                  </div>
                </Avatar>
              )}
              <div className="flex-1">
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <div className="border-t p-4">
        <div className="flex items-center mb-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-xs text-muted-foreground hover:bg-muted rounded-md flex items-center gap-1"
          >
            <span className="text-muted-foreground">@</span>
            Add context
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI for help..."
            className="min-h-[80px] flex-1 resize-none"
          />
          <Button 
            onClick={handleSend}
            size="icon"
            className="self-end"
            disabled={!input.trim()}
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
} 