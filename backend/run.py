from app import create_app
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Print API key availability for debugging
openai_api_key = os.environ.get("OPENAI_API_KEY")
print(f"OpenAI API key found in environment: {'Yes' if openai_api_key else 'No'}")
if openai_api_key:
    # Print a masked version for security
    masked_key = '*' * (len(openai_api_key) - 6) + openai_api_key[-6:]
    print(f"API key (masked): {masked_key}")

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True) 