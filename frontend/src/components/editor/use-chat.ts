'use client';

import { useChat as useBaseChat } from 'ai/react';
import { useSettings } from '@/components/editor/settings';
import { Message } from 'ai';

export const useChat = () => {
  const { keys, model } = useSettings();
  
  // Ensure the API key is properly formatted and available
  const apiKey = keys.openai && keys.openai.trim();
  
  console.log('Using model:', model.value);
  console.log('API key available:', !!apiKey);
  
  // Use Vercel AI SDK chat hook with minimal configuration
  return useBaseChat({
    api: '/api/ai/command',
    body: {
      apiKey,
      model: model.value,
    },
    onResponse: (response) => {
      console.log('Chat API response received with status:', response.status);
      if (!response.ok) {
        console.error('Chat API response error:', response.statusText);
      }
    },
    onError: (error) => {
      console.error('Chat API error:', error);
    },
    onFinish: (message) => {
      console.log('Chat completed with message:', message.id, message.role);
      console.log('Content preview:', message.content.substring(0, 50) + '...');
    }
  });
};
