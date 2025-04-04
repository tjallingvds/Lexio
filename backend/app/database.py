import os
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get MongoDB URI from environment
mongodb_uri = os.getenv('MONGODB_URI')

# Initialize the MongoDB client
client = None
db = None

def init_db():
    """Initialize the MongoDB connection"""
    global client, db
    try:
        client = MongoClient(mongodb_uri)
        # Check connection
        client.admin.command('ping')
        print("MongoDB connection successful")
        
        # Access the database (creates it if it doesn't exist)
        db = client.lexio_db
        
        # Create indexes if needed
        db.documents.create_index("title")
        db.users.create_index("email", unique=True)
        
        return True
    except ConnectionFailure:
        print("MongoDB connection failed")
        return False
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return False

def get_db():
    """Get the database connection"""
    global db
    if db is None:
        init_db()
    return db 