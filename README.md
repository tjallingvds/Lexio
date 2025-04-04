# Lexio

A document editing application with a React frontend and Flask backend.

## Project Structure

```
lexio/
├── frontend/         # React frontend application
└── backend/          # Flask backend API
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment (optional but recommended):
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Run the backend:
   ```
   python run.py
   ```

The backend will be available at http://localhost:5000.

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the development server:
   ```
   npm run dev
   ```

The frontend will be available at http://localhost:5173.

## API Endpoints

- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get a specific document
- `POST /api/documents` - Create a new document

## Features

- Document creation and editing with Plate editor
- Dashboard to view and manage documents
- API for document storage and retrieval 