# LangChain PDF Processing Setup

This document explains the implementation of LangChain for PDF text extraction and retrieval.

## Overview

The system uses LangChain to process PDFs and store the content in a vector database (Chroma) for efficient retrieval and reduced token usage during chats. The implementation follows these steps:

1. Upload a PDF through the frontend
2. Backend extracts text using PyMuPDF (a simple, reliable approach)
3. Text is chunked and stored in Chroma vector database with embeddings
4. When chatting, relevant chunks are retrieved instead of sending the entire PDF content

## Required Dependencies

```
langchain==0.1.15
langchain-community==0.0.18
langchain-openai==0.0.7
chromadb==0.4.22
sentence-transformers==2.5.1
PyMuPDF==1.25.5
```

## Storage Structure

- Raw PDF text is stored in text files in `backend/storage/pdfs/{pdf_id}.txt`
- Embeddings and vector data are stored in `backend/storage/vectordb/`

## API Endpoints

- `/api/extract-pdf` - Upload and process a PDF
- `/api/pdf-content/{pdf_id}` - Retrieve the full text of a PDF
- `/api/pdf-query` - Query for relevant content

## How to Use

1. Upload a PDF through the UI
2. The PDF is processed and stored
3. When asking questions in chat, only the most relevant portions are included in the context window

## Fallback Mechanism

If the server-side extraction fails, a simple client-side extraction is used as a fallback, though this might not capture all elements of the PDF.

## Benefits

1. **Reduced Token Usage**: Only relevant chunks are sent to the LLM
2. **Improved Responses**: Semantic search finds the most relevant content
3. **Faster Processing**: Simple extraction method is efficient and reliable
4. **Persistent Storage**: PDFs are stored for future use

## Configuration

The system automatically uses OpenAI embeddings if an API key is available, and falls back to a local HuggingFace model if not. 