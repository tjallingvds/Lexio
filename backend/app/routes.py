from flask import Blueprint, jsonify, request, render_template

# API blueprint with /api prefix
main = Blueprint('main', __name__, url_prefix='/api')

# Web routes blueprint without prefix for serving frontend
web = Blueprint('web', __name__)

@web.route('/')
def index():
    return render_template('index.html')

# Mock data for documents
documents = [
    {
        "id": 1,
        "title": "Getting Started Guide",
        "content": "This is a sample document for Lexio.",
        "updated_at": "2023-04-01T12:00:00Z"
    },
    {
        "id": 2,
        "title": "Project Proposal",
        "content": "This is a project proposal document.",
        "updated_at": "2023-04-02T14:30:00Z"
    },
    {
        "id": 3,
        "title": "Meeting Notes",
        "content": "Notes from our weekly meeting.",
        "updated_at": "2023-04-03T09:15:00Z"
    }
]

@main.route('/documents', methods=['GET'])
def get_documents():
    return jsonify({"documents": documents})

@main.route('/documents/<int:document_id>', methods=['GET'])
def get_document(document_id):
    document = next((doc for doc in documents if doc["id"] == document_id), None)
    if document:
        return jsonify({"document": document})
    return jsonify({"error": "Document not found"}), 404

@main.route('/documents', methods=['POST'])
def create_document():
    data = request.get_json()
    if not data or 'title' not in data:
        return jsonify({"error": "Missing title"}), 400
    
    new_id = max(doc["id"] for doc in documents) + 1 if documents else 1
    new_doc = {
        "id": new_id,
        "title": data["title"],
        "content": data.get("content", ""),
        "updated_at": "2023-04-04T10:00:00Z"  # Would use actual timestamp in production
    }
    documents.append(new_doc)
    return jsonify({"document": new_doc}), 201 