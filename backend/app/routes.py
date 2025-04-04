from flask import Blueprint, jsonify, request, render_template, Response, stream_with_context
from bson import ObjectId
from datetime import datetime
import os
import json
from openai import OpenAI
from .database import get_db
from .auth import authenticate_user, hash_password, require_auth, create_access_token

# API blueprint with /api prefix
main = Blueprint('main', __name__, url_prefix='/api')

# Web routes blueprint without prefix for serving frontend
web = Blueprint('web', __name__)

# Initialize OpenAI client
openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

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
        api_key = data.get('apiKey', os.environ.get("OPENAI_API_KEY"))
        messages = data.get('messages', [])
        model = data.get('model', 'gpt-4o')
        system = data.get('system', 'You are a helpful assistant.')
        
        # Debug data received
        print(f"Backend received request with:")
        print(f"- API key present: {bool(api_key)}")
        print(f"- Model: {model}")
        print(f"- Messages count: {len(messages)}")
        print(f"- System prompt present: {bool(system)}")
        
        # Validate parameters
        if not api_key:
            print("Missing API key")
            return jsonify({"error": "Missing API key"}), 400
        if not messages:
            print("Missing messages")
            return jsonify({"error": "Missing messages"}), 400
        
        # Add system message if provided
        if system:
            messages = [{"role": "system", "content": system}] + messages
        
        print("Setting up OpenAI client")
        # Set up the client with the provided API key
        client = OpenAI(api_key=api_key)
        
        def generate():
            print("Starting OpenAI stream generation")
            # Create chat completion with streaming
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[{"role": m["role"], "content": m["content"]} for m in messages],
                    stream=True
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
                print(f"Error during streaming: {str(e)}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
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