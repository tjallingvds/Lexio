from flask import Blueprint, jsonify, request, render_template, Response, stream_with_context
from bson import ObjectId
from datetime import datetime
import os
import json
from openai import OpenAI
from .database import get_db

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
def get_documents():
    db = get_db()
    documents = list(db.documents.find())
    # Convert ObjectId to string for JSON serialization
    serialized_documents = [serialize_document(doc) for doc in documents]
    return jsonify({"documents": serialized_documents})

@main.route('/documents/<document_id>', methods=['GET'])
def get_document(document_id):
    db = get_db()
    try:
        document = db.documents.find_one({"_id": ObjectId(document_id)})
        if document:
            return jsonify({"document": serialize_document(document)})
        return jsonify({"error": "Document not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@main.route('/documents', methods=['POST'])
def create_document():
    data = request.get_json()
    if not data or 'title' not in data:
        return jsonify({"error": "Missing title"}), 400
    
    db = get_db()
    new_doc = {
        "title": data["title"],
        "content": data.get("content", ""),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    result = db.documents.insert_one(new_doc)
    new_doc['_id'] = result.inserted_id
    
    return jsonify({"document": serialize_document(new_doc)}), 201

@main.route('/documents/<document_id>', methods=['PUT'])
def update_document(document_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    db = get_db()
    try:
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
def delete_document(document_id):
    db = get_db()
    try:
        result = db.documents.delete_one({"_id": ObjectId(document_id)})
        if result.deleted_count:
            return jsonify({"success": True})
        return jsonify({"error": "Document not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400 