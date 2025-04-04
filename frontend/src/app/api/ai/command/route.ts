import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

// This is the endpoint that the useChat hook will call
export async function POST(req: Request) {
  try {
    // Get the request body
    const body = await req.json();
    
    // Log the request details
    console.log('API Request received with details:');
    console.log('- API key present:', !!body.apiKey);
    console.log('- Model:', body.model || 'default');
    console.log('- Messages count:', body.messages?.length || 0);
    console.log('- System prompt present:', !!body.system);
    
    // Use the provided API key or fallback to environment variable
    const apiKey = body.apiKey || process.env.OPENAI_API_KEY;
    
    // Enhanced logging for API key
    console.log('API key provided in request:', !!body.apiKey);
    console.log('Environment API key available:', !!process.env.OPENAI_API_KEY);
    console.log('Final API key available:', !!apiKey);
    
    if (!apiKey) {
      console.error('Missing API key in request');
      return new Response(
        JSON.stringify({ 
          error: 'Missing OpenAI API key',
          details: 'No API key provided in request or available in environment variables'
        }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          } 
        }
      );
    }
    
    // Validate messages array
    if (!body.messages || body.messages.length === 0) {
      console.error('Missing or empty messages array');
      return new Response(
        JSON.stringify({ error: 'Missing or empty messages array' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          } 
        }
      );
    }
    
    // Initialize OpenAI client
    const openai = createOpenAI({ apiKey: apiKey });
    
    try {
      // Stream the response using the Vercel AI SDK
      console.log('Starting OpenAI request with model:', body.model || 'gpt-4o');
      console.log('Messages:', JSON.stringify(body.messages));
      
      const response = await streamText({
        model: openai(body.model || 'gpt-4o'),
        messages: body.messages || [],
        system: body.system,
        maxTokens: 4000
      });
      
      console.log('Stream response generated successfully');
      
      // Add debugging log
      console.log('Preparing to create streaming response');
      
      // Convert to a streaming response
      const streamResponse = response.toDataStreamResponse({
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
      
      console.log('Streaming response created successfully');
      return streamResponse;
    } catch (error) {
      console.error('OpenAI API error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to process AI request', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          } 
        }
      );
    }
  } catch (error) {
    console.error('Request parsing error:', error);
    return new Response(
      JSON.stringify({ error: 'Invalid request format' }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        } 
      }
    );
  }
}
