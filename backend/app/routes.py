from flask import Blueprint, jsonify, request, render_template, Response, stream_with_context
from bson import ObjectId
from datetime import datetime
import os
import json
import io
import tempfile
import httpx
import base64
from openai import OpenAI
from .database import get_db
from .auth import authenticate_user, hash_password, require_auth, create_access_token
from .document_store import process_pdf, get_pdf_text, query_similar_content
from .utils import create_openai_client
import dotenv
import threading
import concurrent.futures

# Make sure to load environment variables
dotenv.load_dotenv()

# For PDF extraction
import fitz  # PyMuPDF

# API blueprint with /api prefix
main = Blueprint('main', __name__, url_prefix='/api')

# Web routes blueprint without prefix for serving frontend
web = Blueprint('web', __name__)

# Initialize OpenAI client with our utility function
api_key = os.environ.get("OPENAI_API_KEY")
if api_key:
    print(f"Initializing OpenAI client with API key: {'*' * (len(api_key) - 8) + api_key[-8:]}")
else:
    print("WARNING: No OpenAI API key found in environment variables")
    
openai_client = create_openai_client(api_key)

@web.route('/')
def index():
    return render_template('index.html')

# Helper function to serialize ObjectId to string
def serialize_document(doc):
    doc['id'] = str(doc.pop('_id'))
    return doc

# Helper function to serialize user (remove password)
def serialize_user(user):
    if user:
        user = dict(user)  # Convert from BSON to dict
        user['id'] = str(user.pop('_id'))
        if 'password' in user:
            del user['password']
        
        # Ensure all fields are JSON serializable
        for key, value in user.items():
            if isinstance(value, ObjectId):
                user[key] = str(value)
            elif isinstance(value, datetime):
                user[key] = value.isoformat()
    return user

@main.route('/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        if not data.get('email') or not data.get('password'):
            return jsonify({"error": "Email and password are required"}), 400
        
        # Check if MongoDB connection is established
        db = get_db()
        if not db:
            return jsonify({"error": "Database connection failed. Please try again later."}), 500
        
        # Check if user already exists
        if db.users.find_one({"email": data['email']}):
            return jsonify({"error": "Email already registered"}), 409
        
        # Create new user
        try:
            new_user = {
                "name": data.get('name', ''),
                "email": data['email'],
                "password": hash_password(data['password']),
                "created_at": datetime.utcnow().isoformat()
            }
            
            result = db.users.insert_one(new_user)
            new_user['_id'] = result.inserted_id
        except Exception as user_err:
            print(f"User creation error: {str(user_err)}")
            return jsonify({"error": f"Failed to create user: {str(user_err)}"}), 500
        
        # Generate access token
        try:
            access_token = create_access_token(identity=str(result.inserted_id))
        except Exception as token_err:
            print(f"Token generation error: {str(token_err)}")
            return jsonify({"error": "Authentication error. Failed to generate token."}), 500
        
        # Ensure serialized_user is actually a serializable dict
        try:
            serialized_user = serialize_user(new_user)
        except Exception as serialize_err:
            print(f"User serialization error: {str(serialize_err)}")
            return jsonify({"error": "Failed to process user data"}), 500
        
        # Create and return the JSON response
        response_data = {
            "user": serialized_user,
            "access_token": access_token
        }
        
        return jsonify(response_data), 201
    except Exception as e:
        print(f"Registration error: {str(e)}")
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500

@main.route('/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        if not data.get('email') or not data.get('password'):
            return jsonify({"error": "Email and password are required"}), 400
        
        # Check if MongoDB connection is established
        db = get_db()
        if not db:
            return jsonify({"error": "Database connection failed. Please try again later."}), 500
        
        # Try to authenticate the user
        user = authenticate_user(data['email'], data['password'])
        
        if not user:
            return jsonify({"error": "Invalid email or password"}), 401
        
        # Generate access token
        try:
            access_token = create_access_token(identity=str(user['_id']))
        except Exception as token_err:
            print(f"Token generation error: {str(token_err)}")
            return jsonify({"error": "Authentication error. Failed to generate token."}), 500
        
        # Ensure serialized_user is actually a serializable dict
        try:
            serialized_user = serialize_user(user)
        except Exception as serialize_err:
            print(f"User serialization error: {str(serialize_err)}")
            return jsonify({"error": "Failed to process user data"}), 500
        
        # Create and return the JSON response
        response_data = {
            "user": serialized_user,
            "access_token": access_token
        }
        
        return jsonify(response_data)
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({"error": f"Login failed: {str(e)}"}), 500

@main.route('/auth/me', methods=['GET'])
@require_auth
def get_current_user(current_user):
    return jsonify({"user": serialize_user(current_user)})

@main.route('/ai/command', methods=['POST'])
def ai_command():
    try:
        print("Backend AI command endpoint called")
        data = request.get_json()
        
        if not data:
            print("No data provided in request")
            return jsonify({"error": "No data provided"}), 400
        
        # Extract parameters from request
        api_key = data.get('apiKey')
        
        # Check auth header first, data payload second, environment variable last
        if not api_key:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                api_key = auth_header[7:]  # Remove 'Bearer ' prefix
        
        # If still no API key, use environment variable as fallback
        if not api_key:
            api_key = os.environ.get("OPENAI_API_KEY")
            
        messages = data.get('messages', [])
        model = data.get('model', 'gpt-3.5-turbo')  # Default to 3.5 which has larger context
        system = data.get('system')
        
        # Extract web search options if provided
        web_search_options = data.get('web_search_options')
        
        # Debug data received
        print(f"Backend received request with:")
        print(f"- API key present: {bool(api_key)}")
        print(f"- API key length: {len(api_key) if api_key else 0}")
        print(f"- Model: {model}")
        print(f"- Messages count: {len(messages)}")
        print(f"- System prompt present: {bool(system)}")
        print(f"- System prompt length: {len(system) if system else 0}")
        print(f"- Web search options present: {bool(web_search_options)}")
        
        # Validate parameters
        if not api_key:
            print("Missing API key")
            return jsonify({"error": "Missing OpenAI API key. Please provide a valid API key."}), 400
            
        if not messages:
            print("Missing messages")
            return jsonify({"error": "Missing messages"}), 400
        
        # Calculate approximate token count before sending to API
        # A rough estimate is 1 token ≈ 4 characters for English text
        total_chars = sum(len(str(msg.get('content', ''))) for msg in messages)
        if system:
            total_chars += len(system)
            
        # Estimate token count and check against model limits
        estimated_tokens = total_chars // 4
        print(f"Estimated token count: {estimated_tokens}")
        
        # gpt-3.5-turbo has 16k token limit, gpt-4o is around 128k
        token_limit = 128000 if model.startswith('gpt-4') else 16000
        token_warning = ""
        
        if estimated_tokens > token_limit:
            print(f"WARNING: Estimated token count exceeds model limit of {token_limit}")
            token_warning = f"Warning: Content may exceed token limit of {token_limit} for {model}."
            # We'll still try, as our estimation is approximate
        
        # Sanitize messages to ensure proper structure
        sanitized_messages = []
        for msg in messages:
            # Check for required fields
            if not isinstance(msg, dict) or 'role' not in msg or 'content' not in msg:
                continue
                
            # Ensure valid role
            role = msg['role']
            if role not in ['system', 'user', 'assistant']:
                role = 'user'  # Default to user for invalid roles
                
            # Ensure content is a string
            content = str(msg['content']) if msg['content'] is not None else ""
            
            sanitized_messages.append({"role": role, "content": content})
        
        # Add system message if provided
        if system:
            sanitized_messages.insert(0, {"role": "system", "content": system})
        
        print(f"Sanitized message count: {len(sanitized_messages)}")
        
        # Ensure we have at least one message
        if not sanitized_messages:
            print("No valid messages after sanitization")
            return jsonify({"error": "No valid messages provided"}), 400
        
        print("Setting up OpenAI client")
        try:
            # Use our utility function instead of direct initialization
            client = create_openai_client(api_key)
        except Exception as e:
            print(f"Failed to initialize OpenAI client: {str(e)}")
            return jsonify({"error": f"Invalid API key: {str(e)}"}), 400
        
        def generate():
            print("Starting OpenAI stream generation")
            
            # If we have a token warning, yield it first
            if token_warning:
                yield f"data: {json.dumps({'content': token_warning})}\n\n"
            
            # Create chat completion with streaming
            try:
                # Base parameters for the API call
                completion_params = {
                    "model": model,
                    "messages": sanitized_messages,
                    "stream": True,
                    "max_tokens": 1500,  # Reasonable limit for response
                }
                
                # Only add temperature for non-web-search models
                if "search" not in model:
                    completion_params["temperature"] = 0.7
                
                # Add web search options if provided and using a search-compatible model
                if web_search_options and "search" in model:
                    print(f"Adding web search options to API call: {web_search_options}")
                    completion_params["web_search_options"] = web_search_options
                
                # Debug log the final parameters
                print(f"Final API parameters: {json.dumps({k: '...' if k == 'messages' else v for k, v in completion_params.items()})}")
                
                # Make the API call with the parameters
                response = client.chat.completions.create(**completion_params)
                
                print("Stream created successfully, beginning to yield chunks")
                
                # Stream the responses
                for chunk in response:
                    if chunk.choices and chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        yield f"data: {json.dumps({'content': content})}\n\n"
                
                print("Stream completed successfully")
                yield "data: [DONE]\n\n"
            except Exception as e:
                error_msg = str(e)
                print(f"Error during streaming: {error_msg}")
                
                # Check for specific OpenAI errors
                if "maximum context length" in error_msg.lower() or "tokens" in error_msg.lower():
                    error_msg = "The content is too large for the API to process. Try with a smaller PDF or ask about specific parts of the document instead of the whole content."
                elif "authentication" in error_msg.lower() or "api key" in error_msg.lower():
                    error_msg = "Invalid or expired OpenAI API key. Please update your API key in Settings."
                elif "quota" in error_msg.lower() or "exceed" in error_msg.lower():
                    error_msg = "OpenAI API quota exceeded. Please check your usage limits or update your payment information."
                elif "web_search_options" in error_msg.lower():
                    error_msg = "Web search is only available with compatible models like gpt-4o-search-preview. Please update your model in Settings."
                elif "incompatible request" in error_msg.lower() or "incompatible" in error_msg.lower():
                    error_msg = "Invalid parameters for the selected model. Try disabling web search or changing the model in Settings."
                elif "content filter" in error_msg.lower() or "content management" in error_msg.lower():
                    error_msg = "The content was flagged by OpenAI's content filter. Try rephrasing your query."
                elif "rate limit" in error_msg.lower():
                    error_msg = "OpenAI API rate limit reached. Please try again in a few moments."
                elif "model capacity" in error_msg.lower() or "overloaded" in error_msg.lower():
                    error_msg = "The AI model is currently overloaded. Please try again in a few moments."
                
                # Send error to frontend for better UX
                print(f"Sending error to frontend: {error_msg}")
                yield f"data: {json.dumps({'error': error_msg})}\n\n"
                yield "data: [DONE]\n\n"
        
        print("Returning streaming response")
        return Response(
            stream_with_context(generate()),
            content_type='text/event-stream'
        )
        
    except Exception as e:
        print(f"OpenAI API error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@main.route('/documents', methods=['GET'])
@require_auth
def get_documents(current_user):
    db = get_db()
    # Only fetch documents belonging to current user
    documents = list(db.documents.find({"user_id": str(current_user['_id'])}))
    # Convert ObjectId to string for JSON serialization
    serialized_documents = [serialize_document(doc) for doc in documents]
    return jsonify({"documents": serialized_documents})

@main.route('/documents/<document_id>', methods=['GET'])
@require_auth
def get_document(current_user, document_id):
    db = get_db()
    try:
        # Only fetch if document belongs to current user
        document = db.documents.find_one({
            "_id": ObjectId(document_id),
            "user_id": str(current_user['_id'])
        })
        
        if document:
            return jsonify({"document": serialize_document(document)})
        return jsonify({"error": "Document not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@main.route('/documents', methods=['POST'])
@require_auth
def create_document(current_user):
    data = request.get_json()
    if not data or 'title' not in data:
        return jsonify({"error": "Missing title"}), 400
    
    db = get_db()
    new_doc = {
        "title": data["title"],
        "content": data.get("content", ""),
        "user_id": str(current_user['_id']),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    result = db.documents.insert_one(new_doc)
    new_doc['_id'] = result.inserted_id
    
    return jsonify({"document": serialize_document(new_doc)}), 201

@main.route('/documents/<document_id>', methods=['PUT'])
@require_auth
def update_document(current_user, document_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    db = get_db()
    try:
        # First check if document belongs to user
        document = db.documents.find_one({
            "_id": ObjectId(document_id),
            "user_id": str(current_user['_id'])
        })
        
        if not document:
            return jsonify({"error": "Document not found"}), 404
            
        update_data = {
            "title": data.get("title"),
            "content": data.get("content"),
            "updated_at": datetime.utcnow().isoformat()
        }
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        result = db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": update_data}
        )
        
        if result.matched_count:
            updated_doc = db.documents.find_one({"_id": ObjectId(document_id)})
            return jsonify({"document": serialize_document(updated_doc)})
        return jsonify({"error": "Document not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@main.route('/documents/<document_id>', methods=['DELETE'])
@require_auth
def delete_document(current_user, document_id):
    db = get_db()
    try:
        # Only delete if document belongs to current user
        result = db.documents.delete_one({
            "_id": ObjectId(document_id),
            "user_id": str(current_user['_id'])
        })
        
        if result.deleted_count:
            return jsonify({"success": True})
        return jsonify({"error": "Document not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@main.route('/extract-pdf', methods=['POST'])
def extract_pdf_text():
    try:
        if 'pdf' not in request.files:
            return jsonify({"error": "No PDF file provided"}), 400
            
        pdf_file = request.files['pdf']
        if pdf_file.filename == '':
            return jsonify({"error": "Empty filename"}), 400
            
        # Check if it's a PDF
        if not pdf_file.filename.lower().endswith('.pdf'):
            return jsonify({"error": "File must be a PDF"}), 400
        
        # Check for API key first - fail fast if missing
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return jsonify({
                "error": "OpenAI API key is required for PDF processing. Please add your API key in Settings."
            }), 400
        
        print(f"Processing PDF: {pdf_file.filename}")
        
        # Process PDF with a longer timeout (3 minutes)
        with concurrent.futures.ThreadPoolExecutor() as executor:
            # Submit the processing task with a timeout
            future = executor.submit(process_pdf, pdf_file)
            try:
                # Wait for the result with a generous timeout (180 seconds)
                result = future.result(timeout=180)
            except concurrent.futures.TimeoutError:
                return jsonify({
                    "error": "PDF processing timed out after 3 minutes. Please try a smaller file or contact support."
                }), 408  # Request Timeout
            
        if not result["success"]:
            # Provide more helpful error details
            error_msg = result["error"]
            print(f"PDF processing failed: {error_msg}")
            
            # Give more helpful error message for OpenAI API errors
            if "API" in error_msg or "openai" in error_msg.lower():
                return jsonify({
                    "error": "OpenAI API error. This may be due to API key issues or rate limits. Please check your settings or try again later."
                }), 400
                
            return jsonify({"error": error_msg}), 400
            
        # Return text and metadata
        response_data = {
            "success": True,
            "pdf_id": result["pdf_id"],
            "text": result["text"],
            "summary": result.get("summary", ""),
            "chunks": result["chunks"],
            "token_estimate": result.get("token_estimate", 0),
            "word_count": result.get("word_count", 0),
            "file_path": result["file_path"],
            "vector_storage": result.get("vector_storage", False),
            "api_key_present": result.get("api_key_present", False)
        }
        
        # Log successful extraction
        print(f"Successfully extracted PDF: {pdf_file.filename}, {result.get('word_count', 0)} words")
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Error in PDF extraction: {e}")
        # Provide a more helpful error message
        error_message = str(e)
        if "OpenAI API" in error_message:
            return jsonify({"error": "OpenAI API error. Please check your API key and account status."}), 500
        elif "PDF" in error_message and "file" in error_message:
            return jsonify({"error": "The PDF file appears to be corrupted or in an unsupported format."}), 400
        elif "memory" in error_message.lower():
            return jsonify({"error": "The PDF is too large to process. Please try a smaller file."}), 413
        
        return jsonify({"error": f"PDF extraction failed: {error_message}"}), 500

@main.route('/pdf-content/<pdf_id>', methods=['GET'])
def get_pdf_content(pdf_id):
    """Get the full text content of a PDF with improved handling for large files"""
    print(f"Retrieving content for PDF ID: {pdf_id}")
    
    try:
        # Check if the request wants a specific page or range instead of full content
        page_start = request.args.get('page_start', type=int)
        page_end = request.args.get('page_end', type=int)
        
        text = get_pdf_text(pdf_id)
        
        if not text:
            print(f"PDF not found: {pdf_id}")
            return jsonify({"error": "PDF not found"}), 404
        
        # Log content size for debugging
        content_size = len(text)
        print(f"Retrieved PDF content: {content_size} characters")
        
        # Handle page-based retrieval if requested (for extremely large PDFs)
        if page_start is not None:
            pages = text.split('Page ')
            requested_pages = []
            
            # Pages are 1-indexed in the text
            end_page = page_end or len(pages)
            
            # Add requested pages
            for i in range(max(1, page_start), min(end_page + 1, len(pages))):
                if i < len(pages):
                    requested_pages.append(f"Page {pages[i]}")
            
            if requested_pages:
                partial_text = "\n".join(requested_pages)
                print(f"Returning partial content (pages {page_start}-{end_page}): {len(partial_text)} characters")
                return jsonify({
                    "success": True,
                    "text": partial_text,
                    "size": len(partial_text),
                    "total_size": content_size,
                    "is_partial": True,
                    "total_pages": len(pages) - 1  # Adjust for split behavior
                })
        
        # Return complete content without truncation
        print(f"Returning full PDF content: {content_size} characters")
        return jsonify({
            "success": True,
            "text": text,
            "size": content_size
        })
    except Exception as e:
        print(f"Error retrieving PDF content: {e}")
        return jsonify({"error": f"Error retrieving PDF: {str(e)}"}), 500

@main.route('/pdf-query', methods=['POST'])
def query_pdf_content():
    """Query PDFs for relevant content"""
    try:
        data = request.json
        
        if not data or 'query' not in data:
            return jsonify({"error": "Query is required"}), 400
            
        query = data['query']
        limit = data.get('limit', 5)
        
        # Check for API key
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return jsonify({
                "success": False,
                "error": "OpenAI API key not found. Please add your API key in the Settings panel.",
                "results": []
            })
        
        results = query_similar_content(query, limit)
        
        return jsonify({
            "success": True,
            "results": results
        })
    except Exception as e:
        print(f"Error in PDF query: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "results": []
        })

@main.route('/upload-image', methods=['POST'])
@require_auth
def upload_image(current_user):
    """
    Upload image to MongoDB and return URL
    Expects binary image data in request body
    """
    try:
        # Check if there's an image in the request
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
            
        image_file = request.files['image']
        print(f"Received file: {image_file.filename}, type: {image_file.content_type}")
        
        # Validate the image file type
        if not image_file.content_type.startswith('image/'):
            return jsonify({"error": "Invalid file type. Only images are allowed."}), 400
            
        # Read the image content and encode as base64
        image_content = image_file.read()
        encoded_image = base64.b64encode(image_content).decode('utf-8')
        
        # Create a document to store the image
        image_doc = {
            "user_id": current_user["_id"],
            "filename": image_file.filename,
            "mime_type": image_file.content_type,
            "encoding": "base64",
            "content": encoded_image,
            "created_at": datetime.utcnow()
        }
        
        # Insert into MongoDB
        db = get_db()
        result = db.images.insert_one(image_doc)
        
        # Create a URL that can be used to access the image
        image_id = str(result.inserted_id)
        image_url = f"/api/images/{image_id}"
        
        print(f"Successfully uploaded image with ID: {image_id}")
        
        return jsonify({
            "success": True,
            "id": image_id,
            "url": image_url,
            "filename": image_file.filename
        })
        
    except Exception as e:
        print(f"Image upload error: {str(e)}")
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

@main.route('/images/<image_id>', methods=['GET'])
def get_image(image_id):
    """Fetch and serve an image from MongoDB"""
    try:
        # Convert string ID to ObjectId
        try:
            obj_id = ObjectId(image_id)
        except:
            return jsonify({"error": "Invalid image ID"}), 400
            
        # Get the image from the database
        db = get_db()
        image_doc = db.images.find_one({"_id": obj_id})
        
        if not image_doc:
            return jsonify({"error": "Image not found"}), 404
            
        # Decode the base64 image
        image_data = base64.b64decode(image_doc["content"])
        
        # Serve the image with the correct MIME type
        return Response(
            image_data, 
            mimetype=image_doc["mime_type"]
        )
        
    except Exception as e:
        print(f"Image fetch error: {str(e)}")
        return jsonify({"error": f"Failed to retrieve image: {str(e)}"}), 500 