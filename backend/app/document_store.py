import os
import tempfile
import fitz  # PyMuPDF
from typing import Dict, List, Optional, Any
import uuid
import json

# LangChain imports
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import HuggingFaceEmbeddings

# Import utility function for OpenAI client
from .utils import create_openai_client

# Storage location for PDF text files
PDF_STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'storage', 'pdfs')
os.makedirs(PDF_STORAGE_DIR, exist_ok=True)

# Storage location for vector database
CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'storage', 'vectordb')
os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)

# Choose embeddings based on availability of API key
def get_embeddings():
    """Get embeddings model based on environment"""
    try:
        openai_api_key = os.environ.get("OPENAI_API_KEY")
        
        if openai_api_key:
            print(f"Using OpenAI embeddings model with API key: {'*' * (len(openai_api_key) - 8) + openai_api_key[-8:] if openai_api_key else 'Not found'}")
            # Pass api_key directly to OpenAIEmbeddings
            return OpenAIEmbeddings(api_key=openai_api_key)
        else:
            print("OpenAI API key not found, falling back to HuggingFace embeddings")
            # Fallback to open-source model if no API key
            return HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    except Exception as e:
        print(f"Error setting up embeddings: {e}")
        print("Falling back to HuggingFace embeddings")
        # Fallback to open-source model if there's any error
        return HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# Initialize vector store
def get_vector_store():
    """Get or create Chroma vector store"""
    try:
        embeddings = get_embeddings()
        
        # Create or load existing vector store
        return Chroma(
            persist_directory=CHROMA_PERSIST_DIR,
            embedding_function=embeddings
        )
    except Exception as e:
        print(f"Error getting vector store: {e}")
        raise

def extract_text_from_pdf(pdf_file_path: str) -> str:
    """Extract text from PDF using PyMuPDF with improved handling for complete text capture"""
    text = ""
    
    try:
        with fitz.open(pdf_file_path) as doc:
            # Log total pages for debugging
            print(f"PDF has {len(doc)} pages")
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                
                # Use 'text' format which preserves paragraphs better than default
                page_text = page.get_text("text")
                
                # Add a page marker and the extracted text
                text += f"Page {page_num + 1}:\n{page_text}\n\n"
                
                # Log the first and last page extraction stats for debugging
                if page_num == 0 or page_num == len(doc) - 1:
                    print(f"Page {page_num+1} extracted: {len(page_text)} chars")
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return ""
    
    # Log total extraction size
    print(f"Total extracted text size: {len(text)} characters")
    return text

def save_pdf_text(pdf_id: str, text: str) -> str:
    """Save extracted PDF text to a file"""
    file_path = os.path.join(PDF_STORAGE_DIR, f"{pdf_id}.txt")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)
    
    return file_path

def get_pdf_text(pdf_id: str) -> Optional[str]:
    """Retrieve PDF text from storage"""
    file_path = os.path.join(PDF_STORAGE_DIR, f"{pdf_id}.txt")
    
    if not os.path.exists(file_path):
        return None
    
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()

def process_pdf(pdf_file) -> Dict[str, Any]:
    """Process PDF file, extract text, and store in vector DB"""
    # Generate a unique ID for this PDF
    pdf_id = str(uuid.uuid4())
    
    # Save PDF to temporary file
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp:
        pdf_file.save(temp.name)
        temp_filename = temp.name
    
    try:
        # Extract text using simple approach
        text = extract_text_from_pdf(temp_filename)
        
        if not text or len(text.strip()) < 100:
            return {
                "success": False,
                "error": "Could not extract sufficient text from PDF"
            }
        
        # Get word count and estimate token count more accurately
        word_count = len(text.split())
        token_estimate = round(word_count * 1.3)  # Average 1.3 tokens per word
        
        # Save extracted text
        text_file_path = save_pdf_text(pdf_id, text)
        
        # Only attempt to create vectors if OpenAI API key is present
        api_key = os.environ.get("OPENAI_API_KEY")
        vector_storage_successful = False
        chunks = []
        
        if api_key:
            try:
                # Create chunks for vector storage
                text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=1000,
                    chunk_overlap=100,
                    separators=["\n\n", "\n", ". ", " ", ""]
                )
                chunks = text_splitter.split_text(text)
                
                # Try to store in vector database with metadata
                try:
                    vector_store = get_vector_store()
                    vector_store.add_texts(
                        texts=chunks,
                        metadatas=[{"pdf_id": pdf_id, "chunk_id": i} for i in range(len(chunks))],
                        ids=[f"{pdf_id}-{i}" for i in range(len(chunks))]
                    )
                    vector_store.persist()
                    vector_storage_successful = True
                    print(f"Successfully stored {len(chunks)} chunks in vector database")
                except Exception as vector_error:
                    # If vector storage fails, log error but continue
                    print(f"Error storing in vector database: {vector_error}")
                    # We'll still return the text even if vector storage fails
            except Exception as chunk_error:
                print(f"Error chunking text: {chunk_error}")
                # Continue with the raw text even if chunking fails
        else:
            print("No OpenAI API key found, skipping vector storage")
            vector_storage_successful = False
        
        # Create and return document info
        return {
            "success": True,
            "pdf_id": pdf_id,
            "text": text,
            "chunks": len(chunks),
            "file_path": text_file_path,
            "vector_storage": vector_storage_successful,
            "api_key_present": bool(api_key),
            "word_count": word_count,
            "token_estimate": token_estimate
        }
    
    except Exception as e:
        print(f"Error processing PDF: {e}")
        # Check for API key related errors
        if "API key" in str(e) or "authentication" in str(e).lower():
            return {
                "success": False, 
                "error": "OpenAI API key error: Please check your API key configuration"
            }
        return {"success": False, "error": str(e)}
    finally:
        # Clean up temp file
        if os.path.exists(temp_filename):
            os.unlink(temp_filename)

def query_similar_content(query: str, limit: int = 5) -> List[Dict]:
    """Query vector DB for semantically similar content"""
    try:
        # First check if API key is available
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            print("OpenAI API key not found, cannot perform vector search")
            return []
            
        vector_store = get_vector_store()
        results = vector_store.similarity_search_with_score(query, k=limit)
        
        # Format results
        formatted_results = []
        for doc, score in results:
            formatted_results.append({
                "content": doc.page_content,
                "relevance_score": score,
                "metadata": doc.metadata
            })
        
        return formatted_results
    except Exception as e:
        print(f"Error querying vector store: {e}")
        # Return empty results rather than crashing
        return [] 