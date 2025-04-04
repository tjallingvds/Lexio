import os
from openai import OpenAI
import dotenv

# Load environment variables from .env files
dotenv.load_dotenv()

def create_openai_client(api_key=None):
    """
    Create an OpenAI client with proper handling of environment variables.
    Addresses the issue with proxies in newer versions of the OpenAI package.
    
    Args:
        api_key (str, optional): OpenAI API key. If None, will use OPENAI_API_KEY environment variable.
        
    Returns:
        OpenAI: Properly configured OpenAI client
    """
    # Use provided API key or fall back to environment variable
    if api_key is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        print(f"Using API key from environment: {'*' * (len(api_key) - 8) + api_key[-8:] if api_key else 'Not found'}")
        
    if not api_key:
        print("WARNING: No OpenAI API key found in environment variables or parameters")
        raise ValueError("API key is required either as parameter or OPENAI_API_KEY environment variable")
    
    # Clear problematic proxy environment variables if they exist
    # This prevents them from being automatically picked up by httpx
    proxy_env_vars = ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]
    original_env_values = {}
    
    # Save original values to restore later
    for var in proxy_env_vars:
        if var in os.environ:
            original_env_values[var] = os.environ[var]
            del os.environ[var]
    
    # Create the client without proxy interference
    client = OpenAI(api_key=api_key)
    
    # Restore environment variables
    for var, value in original_env_values.items():
        os.environ[var] = value
        
    return client 