from passlib.hash import bcrypt
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    verify_jwt_in_request,
    JWTManager
)
from functools import wraps
from flask import jsonify, request
from .database import get_db
from bson import ObjectId

# Initialize JWT manager
jwt = None

def init_jwt(app):
    """Initialize JWT manager with app"""
    global jwt
    jwt = JWTManager(app)

def hash_password(password):
    """Hash a password for storing."""
    return bcrypt.hash(password)

def verify_password(stored_password, provided_password):
    """Verify a stored password against a provided password"""
    return bcrypt.verify(provided_password, stored_password)

def authenticate_user(email, password):
    """Authenticate a user by email and password"""
    db = get_db()
    user = db.users.find_one({"email": email})
    
    if user and verify_password(user['password'], password):
        return user
    return None

def require_auth(f):
    """Decorator to require authentication for an endpoint"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            current_user_id = get_jwt_identity()
            current_user = get_db().users.find_one({"_id": ObjectId(current_user_id)})
            
            if not current_user:
                return jsonify({"error": "User not found"}), 401
            
            # Pass user to the route function
            return f(current_user, *args, **kwargs)
        except Exception as e:
            return jsonify({"error": str(e)}), 401
    
    return decorated_function 