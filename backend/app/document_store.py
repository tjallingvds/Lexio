import os
import tempfile
import fitz  # PyMuPDF
from typing import Dict, List, Optional, Any
import uuid
import json
import base64

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

# Get vector store instance for querying
def get_vector_store():
    embeddings = get_embeddings()
    return Chroma(persist_directory=CHROMA_PERSIST_DIR, embedding_function=embeddings)

def save_pdf_text(pdf_id: str, text: str) -> str:
    """Save extracted PDF text to file storage"""
    file_path = os.path.join(PDF_STORAGE_DIR, f"{pdf_id}.txt")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)
    
    print(f"Saved PDF text to {file_path}")
    return file_path

def get_pdf_text(pdf_id: str) -> Optional[str]:
    """Retrieve PDF text from file storage"""
    file_path = os.path.join(PDF_STORAGE_DIR, f"{pdf_id}.txt")
    
    if not os.path.exists(file_path):
        print(f"PDF text file not found: {file_path}")
        return None
    
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()

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

def extract_text_with_openai(pdf_file_path: str, client) -> Dict[str, Any]:
    """Extract text from PDF using OpenAI's PDF parsing capabilities"""
    try:
        # First, let's use PyMuPDF as a fallback for PDF extraction
        fallback_text = ""
        try:
            fallback_text = extract_text_from_pdf(pdf_file_path)
            print(f"Extracted fallback text with PyMuPDF: {len(fallback_text)} chars")
        except Exception as fallback_error:
            print(f"Fallback extraction failed: {fallback_error}")
        
        # Now try to create a completion with simple text-only prompt
        # This avoids the file attachment issues entirely
        system_prompt = "You are a helpful PDF text extractor. Extract all text from the PDF content below, preserving the structure. Don't analyze or summarize."
        
        with open(pdf_file_path, "rb") as f:
            try:
                import PyPDF2
                pdf_reader = PyPDF2.PdfReader(f)
                text_content = ""
                
                # Extract text from each page
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    text_content += f"--- Page {page_num + 1} ---\n"
                    text_content += page.extract_text() + "\n\n"
                
                print(f"Successfully extracted text with PyPDF2: {len(text_content)} chars")
                
                # If PyPDF2 extraction is very short but PyMuPDF got more text, use that instead
                if len(text_content) < 500 and len(fallback_text) > len(text_content):
                    print("Using PyMuPDF text instead of PyPDF2 text due to better extraction")
                    text_content = fallback_text
                
                # Generate a summary
                summary_response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {
                            "role": "system", 
                            "content": "Create a concise 1-2 sentence summary of the following PDF content. Focus only on the main topic."
                        },
                        {"role": "user", "content": text_content[:4000]}  # Use beginning of document for summary
                    ],
                    temperature=0.3,
                    max_tokens=100
                )
                
                summary = summary_response.choices[0].message.content
                
                # Count words
                word_count = len(text_content.split())
                print(f"PDF extraction successful: {len(text_content)} chars, {word_count} words")
                print(f"Generated summary: {summary}")
                
                return {
                    "text": text_content,
                    "summary": summary,
                    "word_count": word_count,
                    "token_estimate": round(word_count * 1.3)  # Approximate token count
                }
                
            except ImportError:
                print("PyPDF2 not available, using fallback text")
                # If PyPDF2 isn't available, use fallback text from PyMuPDF
                if fallback_text:
                    # Generate a summary for the fallback text
                    summary_response = client.chat.completions.create(
                        model="gpt-3.5-turbo",
                        messages=[
                            {
                                "role": "system", 
                                "content": "Create a concise 1-2 sentence summary of the following PDF content. Focus only on the main topic."
                            },
                            {"role": "user", "content": fallback_text[:4000]}  # Use beginning of document for summary
                        ],
                        temperature=0.3,
                        max_tokens=100
                    )
                    
                    summary = summary_response.choices[0].message.content
                    word_count = len(fallback_text.split())
                    
                    return {
                        "text": fallback_text,
                        "summary": summary,
                        "word_count": word_count,
                        "token_estimate": round(word_count * 1.3)  # Approximate token count
                    }
                else:
                    raise Exception("Failed to extract text from PDF using any available method")
            
    except Exception as e:
        print(f"Error extracting text with OpenAI: {e}")
        return {"error": str(e)}

def process_pdf(pdf_file) -> Dict[str, Any]:
    """Process PDF file, extract text, and store in vector DB"""
    # Generate a unique ID for this PDF
    pdf_id = str(uuid.uuid4())
    
    # Save PDF to temporary file
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp:
        pdf_file.save(temp.name)
        temp_filename = temp.name
    
    try:
        # Check for OpenAI API key
        api_key = os.environ.get("OPENAI_API_KEY")
        api_key_present = bool(api_key)
        
        if not api_key_present:
            return {
                "success": False,
                "error": "OpenAI API key is required for PDF processing"
            }
        
        text = ""
        summary = ""
        
        # Create OpenAI client
        client = create_openai_client(api_key)
        
        # Extract text using OpenAI - single method, no fallbacks for simplicity
        result = extract_text_with_openai(temp_filename, client)
        
        if "error" in result:
            # If OpenAI extraction fails, return the error
            return {
                "success": False,
                "error": f"Failed to extract text: {result['error']}"
            }
        
        text = result["text"]
        summary = result["summary"]
        word_count = result["word_count"]
        token_estimate = result["token_estimate"]
        
        if not text or len(text.strip()) < 10:  # Very minimal validation
            return {
                "success": False,
                "error": "Could not extract text from PDF"
            }
        
        # Save extracted text
        text_file_path = save_pdf_text(pdf_id, text)
        
        # Store in vector DB if possible
        vector_storage_successful = False
        chunks = []
        
        try:
            # Simple chunking for vector storage
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                length_function=len,
            )
            chunks = text_splitter.split_text(text)
            
            if chunks:
                print(f"Created {len(chunks)} chunks for vector storage")
                
                # Create embeddings
                embeddings = OpenAIEmbeddings(api_key=api_key)
                
                # Create metadata for each chunk
                documents = [
                    {"page_content": chunk, 
                     "metadata": {
                         "pdf_id": pdf_id,
                         "chunk_id": i,
                         "source": "pdf"
                      }
                    } for i, chunk in enumerate(chunks)
                ]
                
                # Store in vector DB
                vector_store = Chroma.from_documents(
                    documents=documents,
                    embedding=embeddings,
                    persist_directory=CHROMA_PERSIST_DIR
                )
                
                # Persist to disk
                vector_store.persist()
                print(f"Successfully stored {len(chunks)} chunks in vector DB")
                vector_storage_successful = True
            else:
                print("Warning: No chunks created from text")
        except Exception as e:
            print(f"Error creating vector embeddings: {e}")
            # Continue with the process even if vector storage fails
        
        # Return success with metadata
        return {
            "success": True,
            "pdf_id": pdf_id,
            "text": text,
            "summary": summary,
            "file_path": text_file_path,
            "chunks": len(chunks),
            "vector_storage": vector_storage_successful,
            "api_key_present": api_key_present,
            "word_count": word_count,
            "token_estimate": token_estimate
        }
    
    except Exception as e:
        print(f"Error processing PDF: {e}")
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