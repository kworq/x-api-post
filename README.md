# Twitter Media Upload and Tweet Posting Script

This script demonstrates how to upload media to Twitter and post a tweet using Node.js. It leverages the Twitter API v1.1 for media uploads and the Twitter API v2 for posting tweets. The script uses OAuth 1.0a for authentication and supports various media types, including images, videos, and GIFs.

## Prerequisites

- Node.js (version 14 or later)
- Twitter Developer Account with API keys and access tokens

## Installation

1. Clone the repository or download the script files.

2. Install the required dependencies:

   ```bash
   npm install dotenv needle oauth-1.0a axios

3. Create a .env file in the root directory of the project and add your Twitter API credentials:

    X_API_KEY=your_api_key
    X_API_SECRET=your_api_secret
    X_API_ACCESS_TOKEN=your_access_token
    X_API_ACCESS_TOKEN_SECRET=your_access_token_secret
    TEST_IMAGE_URL=url_of_the_image_to_test