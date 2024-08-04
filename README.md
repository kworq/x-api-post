# X / Twitter Media Upload and Posting

## Overview

This Node.js module provides functionality to post tweets with media (images, videos, GIFs) to Twitter using Twitter's API. It handles the authentication, media uploading (including chunked uploads for large files), and posting of tweets with the uploaded media.

## Requirements

- Node.js v18.0.0 or higher (native `fetch` support)
- Twitter Developer Account with API keys

## Installation

1. Clone the repository or copy the code into your project directory.
2. Install the required dependencies using npm:

```bash
npm install
```

## Configuration

Before using this module, you need to set up the configuration with your Twitter API credentials. The configuration object should have the following properties:

- `X_API_KEY`
- `X_API_SECRET`
- `X_API_ACCESS_TOKEN`
- `X_API_ACCESS_TOKEN_SECRET`

## Class

### `XApiClient`

A class to handle posting tweets with media to Twitter.

#### Constructor

Creates an instance of `XApiClient`.

```javascript
new XApiClient(config)
```

##### Parameters:

- `config`: Configuration object containing Twitter API credentials.

#### Methods

##### `postTweetWithMedia(text, mediaUrls)`

Posts a tweet with the specified text and media.

###### Parameters:

- `text`: The text of the tweet.
- `mediaUrls`: An array of media URLs to upload and attach to the tweet.

## Usage Example

```javascript
import XApiClient from './XApiClient';

const config = {
  X_API_KEY: 'your_api_key',
  X_API_SECRET: 'your_api_secret',
  X_API_ACCESS_TOKEN: 'your_access_token',
  X_API_ACCESS_TOKEN_SECRET: 'your_access_token_secret',
};

const text = "Hello, world!";
const mediaUrls = ["https://example.com/image.jpg"];

const client = new XApiClient(config);

client.postTweetWithMedia(text, mediaUrls)
  .then(() => console.log("Tweet posted successfully!"))
  .catch((error) => console.error("Error posting tweet:", error));
```

## Notes

- Ensure you have valid Twitter API credentials.
- Media files larger than 5MB will be uploaded in chunks.
- The media upload process includes initialization, appending chunks, finalizing, and checking the status.
- This module requires Node.js v18.0.0 or higher to use the native `fetch` function.

## License

This project is licensed under the MIT License.
