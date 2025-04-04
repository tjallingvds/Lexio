from flask import Blueprint, jsonify, request, render_template, Response, stream_with_context
from bson import ObjectId
from datetime import datetime
import os
import json
import io
import tempfile
import httpx
from openai import OpenAI
from .database import get_db
from .auth import authenticate_user, hash_password, require_auth, create_access_token
from .document_store import process_pdf, get_pdf_text, query_similar_content
from .utils import create_openai_client
import dotenv

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
        
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({"error": "Email and password are required"}), 400
        
        db = get_db()
        
        # Check if user already exists
        if db.users.find_one({"email": data['email']}):
            return jsonify({"error": "Email already registered"}), 409
        
        # Create new user
        new_user = {
            "name": data.get('name', ''),
            "email": data['email'],
            "password": hash_password(data['password']),
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = db.users.insert_one(new_user)
        new_user['_id'] = result.inserted_id
        
        # Generate access token
        access_token = create_access_token(identity=str(result.inserted_id))
        
        # Ensure serialized_user is actually a serializable dict
        serialized_user = serialize_user(new_user)
        
        return jsonify({
            "user": serialized_user,
            "access_token": access_token
        }), 201
    except Exception as e:
        print(f"Registration error: {str(e)}")
        return jsonify({"error": "Registration failed: " + str(e)}), 400

@main.route('/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({"error": "Email and password are required"}), 400
        
        user = authenticate_user(data['email'], data['password'])
        
        if not user:
            return jsonify({"error": "Invalid email or password"}), 401
        
        # Generate access token
        access_token = create_access_token(identity=str(user['_id']))
        
        # Ensure serialized_user is actually a serializable dict
        serialized_user = serialize_user(user)
        
        return jsonify({
            "user": serialized_user,
            "access_token": access_token
        })
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({"error": "Login failed: " + str(e)}), 400

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
        
        # Debug data received
        print(f"Backend received request with:")
        print(f"- API key present: {bool(api_key)}")
        print(f"- API key length: {len(api_key) if api_key else 0}")
        print(f"- Model: {model}")
        print(f"- Messages count: {len(messages)}")
        print(f"- System prompt present: {bool(system)}")
        print(f"- System prompt length: {len(system) if system else 0}")
        
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
                response = client.chat.completions.create(
                    model=model,
                    messages=sanitized_messages,
                    stream=True,
                    max_tokens=1500,  # Reasonable limit for response
                    temperature=0.7
                )
                
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
            
        # Process PDF with LangChain integration
        result = process_pdf(pdf_file)
        
        if not result["success"]:
            return jsonify({"error": result["error"]}), 400
            
        # Return text and metadata
        return jsonify({
            "success": True,
            "pdf_id": result["pdf_id"],
            "text": result["text"],
            "chunks": result["chunks"],
            "token_estimate": result.get("token_estimate", 0),  # Use the more accurate estimate from document_store
            "word_count": result.get("word_count", 0),
            "file_path": result["file_path"],
            "vector_storage": result.get("vector_storage", False),
            "api_key_present": result.get("api_key_present", False)
        })
        
    except Exception as e:
        print(f"Error in PDF extraction: {e}")
        return jsonify({"error": str(e)}), 500

@main.route('/pdf-content/<pdf_id>', methods=['GET'])
def get_pdf_content(pdf_id):
    """Get the full text content of a PDF"""
    text = get_pdf_text(pdf_id)
    
    if not text:
        return jsonify({"error": "PDF not found"}), 404
        
    return jsonify({"text": text})

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