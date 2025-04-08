import requests
import os
import json

# Configuration
API_URL = "http://localhost:5001"  # Change if your server is on a different port
TEST_IMAGE_PATH = "test_image.jpg"  # You can create a test image or use an existing one

# Get token from environment or prompt
token = os.environ.get("AUTH_TOKEN")
if not token:
    token = input("Enter your authentication token: ")

def test_image_upload():
    """Test the image upload endpoint"""
    
    # Check if test image exists
    if not os.path.exists(TEST_IMAGE_PATH):
        print(f"Test image not found: {TEST_IMAGE_PATH}")
        return False
    
    # Prepare headers and files
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    with open(TEST_IMAGE_PATH, "rb") as f:
        files = {"image": (os.path.basename(TEST_IMAGE_PATH), f, "image/jpeg")}
        
        # Send request
        print(f"Sending request to {API_URL}/api/upload-image")
        response = requests.post(
            f"{API_URL}/api/upload-image",
            headers=headers,
            files=files
        )
    
    # Check response
    print(f"Response status code: {response.status_code}")
    try:
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")
        
        # Check if image URL is returned
        if "url" in result:
            image_url = result["url"]
            # Make the URL absolute if it's relative
            if image_url.startswith("/"):
                image_url = f"{API_URL}{image_url}"
            
            print(f"Testing image URL: {image_url}")
            img_response = requests.get(image_url)
            print(f"Image response status: {img_response.status_code}")
            
            return img_response.status_code == 200
    except Exception as e:
        print(f"Error parsing response: {e}")
        return False
    
    return response.status_code == 200

if __name__ == "__main__":
    success = test_image_upload()
    print(f"Test {'PASSED' if success else 'FAILED'}") 