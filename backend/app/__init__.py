from flask import Flask
from flask_cors import CORS
import os

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

    # Register blueprints
    from .routes import main, web
    app.register_blueprint(main)
    app.register_blueprint(web)

    @app.route('/ping')
    def ping():
        return {'status': 'success', 'message': 'pong!'}

    return app 