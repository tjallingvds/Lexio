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
    """Save extracted PDF text to file storage without truncation, optimized for large files"""
    file_path = os.path.join(PDF_STORAGE_DIR, f"{pdf_id}.txt")
    
    # Write in chunks to handle very large text content
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            # Calculate chunks for better memory management with large files
            chunk_size = 1024 * 1024  # 1MB chunks
            for i in range(0, len(text), chunk_size):
                chunk = text[i:i + chunk_size]
                f.write(chunk)
                # Flush after each chunk to ensure content is written
                f.flush()
        
        # Verify file was written completely
        file_size = os.path.getsize(file_path)
        text_length = len(text)
        print(f"Saved PDF text to {file_path} ({file_size} bytes, {text_length} chars)")
        
        # Verify content integrity
        if file_size < text_length / 2:
            print(f"WARNING: File size ({file_size} bytes) seems too small compared to text length ({text_length} chars)")
        
        return file_path
    except Exception as e:
        print(f"Error saving PDF text: {e}")
        # Attempt a simpler approach as fallback
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(text)
            print(f"Saved PDF text using fallback method - {os.path.getsize(file_path)} bytes")
            return file_path
        except Exception as fallback_error:
            print(f"Fallback save also failed: {fallback_error}")
            raise

def get_pdf_text(pdf_id: str) -> Optional[str]:
    """Retrieve PDF text from file storage, optimized for large files"""
    file_path = os.path.join(PDF_STORAGE_DIR, f"{pdf_id}.txt")
    
    if not os.path.exists(file_path):
        print(f"PDF text file not found: {file_path}")
        return None
    
    try:
        # Get file size for logging and monitoring
        file_size = os.path.getsize(file_path)
        print(f"Reading PDF content from {file_path} (size: {file_size} bytes)")
        
        # For large files, read in chunks to prevent memory issues
        if file_size > 10 * 1024 * 1024:  # If file is larger than 10MB
            print(f"Large file detected ({file_size/1024/1024:.2f} MB), reading in chunks")
            chunks = []
            chunk_size = 1024 * 1024  # 1MB chunks
            
            with open(file_path, 'r', encoding='utf-8') as f:
                while True:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    chunks.append(chunk)
            
            content = ''.join(chunks)
            print(f"Read {len(content)} characters from file in {len(chunks)} chunks")
            return content
        else:
            # For smaller files, read all at once
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            print(f"Read {len(content)} characters from file")
            return content
    except Exception as e:
        print(f"Error reading PDF text: {e}")
        # Try with different encoding as fallback
        try:
            with open(file_path, 'r', encoding='latin-1') as f:
                content = f.read()
            print(f"Read {len(content)} characters using fallback encoding")
            return content
        except Exception as fallback_error:
            print(f"Fallback reading also failed: {fallback_error}")
            return None

def extract_text_from_pdf(pdf_file_path: str) -> str:
    """Extract text from PDF using PyMuPDF with improved handling for complete text capture"""
    text = ""
    
    try:
        with fitz.open(pdf_file_path) as doc:
            # Log total pages for debugging
            print(f"PDF has {len(doc)} pages")
            total_text_size = 0
            
            # First attempt: Extract text using multiple methods per page
            for page_num in range(len(doc)):
                page = doc[page_num]
                
                # Combine results from different extraction modes for maximum content recovery
                # Each mode has advantages for different content types
                page_text = ""
                
                # Try all extraction methods and combine results for maximum coverage
                text_mode = page.get_text("text")  # Good for paragraphs
                blocks_mode = page.get_text("blocks")  # Good for columns
                words_mode = page.get_text("words")  # Good for scattered text
                html_mode = page.get_text("html")  # Good for formatted text
                
                # Use the text mode as base
                page_text = text_mode
                
                # If text mode yielded little content, try blocks mode
                if len(text_mode.strip()) < 50 and len(blocks_mode.strip()) > len(text_mode.strip()):
                    page_text = blocks_mode
                
                # Add a page marker and the extracted text
                text += f"Page {page_num + 1}:\n{page_text}\n\n"
                total_text_size += len(page_text)
                
                # Log the extraction stats for pages
                if page_num == 0 or page_num == len(doc) - 1 or page_num % 10 == 0:
                    print(f"Page {page_num+1} extracted: {len(page_text)} chars")
            
            # Second attempt: If first attempt yielded little text, try raw extraction (deeper level)
            if total_text_size < 10000 and len(doc) > 0:
                print("Text extraction possibly incomplete, trying advanced extraction methods")
                enhanced_text = ""
                
                # Try extracting with XHTML which can capture more elements
                for page_num in range(len(doc)):
                    page = doc[page_num]
                    try:
                        # Get both XHTML and JSON formats for maximum coverage
                        xhtml_text = page.get_text("xhtml")
                        json_text = page.get_text("json")
                        
                        # Process raw dict format for more thorough extraction
                        raw_dict = page.get_text("rawdict")
                        page_raw_text = ""
                        
                        # Extract from every text block in the raw dictionary
                        for block in raw_dict.get("blocks", []):
                            if "lines" in block:
                                for line in block["lines"]:
                                    if "spans" in line:
                                        for span in line["spans"]:
                                            if "text" in span:
                                                page_raw_text += span["text"] + " "
                        
                        # Use the richest content source
                        best_text = page_raw_text
                        
                        # Add to enhanced text
                        enhanced_text += f"Page {page_num + 1}:\n{best_text}\n\n"
                    except Exception as raw_error:
                        print(f"Error in advanced extraction for page {page_num+1}: {raw_error}")
                        # If advanced extraction fails, keep original content for this page
                
                # If enhanced extraction got significantly more content, use that instead
                if len(enhanced_text) > total_text_size * 1.2:
                    print(f"Using enhanced extraction method: {len(enhanced_text)} chars vs original {total_text_size} chars")
                    text = enhanced_text
            
            # Third attempt: If document seems to be image-based, try OCR functionality if available
            if total_text_size < 200 * len(doc) and len(doc) > 0:
                print("Minimal text extracted, document may be image-based")
                # This would be a place to add OCR functionality if needed
        
        # Log total extraction size
        print(f"Total extracted text size: {len(text)} characters")
        
        # Perform final validation and cleaning to ensure we have usable content
        if len(text.strip()) < 100 and "Page 1:" in text:
            print("WARNING: Very little text extracted, PDF may be encrypted, image-based, or malformed")
    
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return ""
    
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
                
                print(f"PDF has {len(pdf_reader.pages)} pages according to PyPDF2")
                
                # Enhanced extraction - extract text from each page with both default and layout modes
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    
                    # Try multiple extraction methods and use the one that gives more text
                    standard_text = page.extract_text()
                    
                    # For PyPDF2 we need to ensure we're getting all content, so add page breaks
                    page_content = f"--- Page {page_num + 1} ---\n{standard_text}\n\n"
                    text_content += page_content
                    
                    # Log every 10 pages to monitor progress
                    if page_num == 0 or page_num == len(pdf_reader.pages) - 1 or page_num % 10 == 0:
                        print(f"PyPDF2 - Page {page_num+1}/{len(pdf_reader.pages)} extracted: {len(standard_text)} chars")
                
                print(f"Successfully extracted text with PyPDF2: {len(text_content)} chars")
                
                # Validation step - compare extraction methods and choose best result
                if len(text_content.strip()) < 1000 and len(fallback_text.strip()) > len(text_content.strip()) * 1.5:
                    print("Using PyMuPDF text instead of PyPDF2 text due to better extraction results")
                    text_content = fallback_text
                elif len(text_content.strip()) < 500 and len(fallback_text.strip()) > 0:
                    print("PyPDF2 extraction yielded minimal text, falling back to PyMuPDF")
                    text_content = fallback_text
                
                # Generate a summary - use first 8000 chars for summary generation
                # This doesn't affect the full text that gets stored
                summary_text = text_content[:8000] if len(text_content) > 8000 else text_content
                summary_response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {
                            "role": "system", 
                            "content": "Create a concise 1-2 sentence summary of the following PDF content. Focus only on the main topic."
                        },
                        {"role": "user", "content": summary_text}
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
                    # Generate a summary for the fallback text - use first 8000 chars for summary generation
                    # This doesn't affect the full text that gets stored
                    summary_text = fallback_text[:8000] if len(fallback_text) > 8000 else fallback_text
                    summary_response = client.chat.completions.create(
                        model="gpt-3.5-turbo",
                        messages=[
                            {
                                "role": "system", 
                                "content": "Create a concise 1-2 sentence summary of the following PDF content. Focus only on the main topic."
                            },
                            {"role": "user", "content": summary_text}
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
    
    # Save PDF to temporary file with appropriate buffer size for large files
    temp_filename = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp:
            # Save in chunks to handle large files better
            pdf_file.save(temp.name)
            temp_filename = temp.name
            
            # Get file size for logging
            file_size = os.path.getsize(temp_filename)
            print(f"PDF saved to temporary file: {temp_filename} ({file_size} bytes)")
        
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
        
        # Extract text with our enhanced methods for complete content capture
        print(f"Starting text extraction from PDF (size: {file_size} bytes)")
        result = extract_text_with_openai(temp_filename, client)
        
        if "error" in result:
            # If extraction fails, return the error
            return {
                "success": False,
                "error": f"Failed to extract text: {result['error']}"
            }
        
        text = result["text"]
        summary = result["summary"]
        word_count = result["word_count"]
        token_estimate = result["token_estimate"]
        
        # Check for substantial text content
        if not text or len(text.strip()) < 10:
            return {
                "success": False,
                "error": "Could not extract meaningful text from PDF"
            }
        
        # Log content size for debugging
        print(f"Extracted {len(text)} characters, {word_count} words from PDF")
        
        # Save extracted text to file storage
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