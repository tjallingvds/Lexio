from flask import Flask
from flask_cors import CORS
import os
from .database import init_db
from datetime import timedelta

def create_app(test_config=None):
    # Create and configure the app
    app = Flask(__name__, instance_relative_config=True,
                static_folder='../static', 
                template_folder='../templates')
    
    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Set default configuration
    app.config.from_mapping(
        SECRET_KEY='dev',
        JWT_SECRET_KEY=os.environ.get('JWT_SECRET_KEY', 'dev-jwt-secret'),
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(hours=24),
    )

    if test_config is None:
        # Load the instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
    else:
        # Load the test config if passed in
        app.config.from_mapping(test_config)

    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass
        
    # Initialize MongoDB connection
    init_db()
    
    # Initialize JWT
    from .auth import init_jwt
    init_jwt(app)

    # Register blueprints
    from .routes import main, web
    app.register_blueprint(main)
    app.register_blueprint(web)

    @app.route('/ping')
    def ping():
        return {'status': 'success', 'message': 'pong!'}

    return app 