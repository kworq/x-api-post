import "dotenv/config";
import needle from "needle";
import OAuth from "oauth-1.0a";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const {
  X_API_KEY,
  X_API_SECRET,
  X_API_ACCESS_TOKEN,
  X_API_ACCESS_TOKEN_SECRET,
  TEST_IMAGE_URL,
} = process.env;

const token = {
  key: X_API_ACCESS_TOKEN,
  secret: X_API_ACCESS_TOKEN_SECRET,
};

// Initialize OAuth 1.0a
const oauth = OAuth({
  consumer: { key: X_API_KEY, secret: X_API_SECRET },
  signature_method: "HMAC-SHA1",
  hash_function(base_string, key) {
    return crypto.createHmac("sha1", key).update(base_string).digest("base64");
  },
});

// URLs
const mediaEndpointUrl = "https://upload.twitter.com/1.1/media/upload.json";
const tweetEndpointUrl = "https://api.twitter.com/2/tweets";

async function downloadImage(url, dest) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buffer));
}

async function uploadMediaInit(mediaSize, mediaType, mediaCategory) {
  const params = {
    command: "INIT",
    total_bytes: mediaSize,
    media_type: mediaType,
    media_category: mediaCategory,
  };

  const authHeader = oauth.toHeader(
    oauth.authorize(
      {
        url: mediaEndpointUrl,
        method: "POST",
        data: params,
      },
      token
    )
  );

  const response = await needle("post", mediaEndpointUrl, params, {
    headers: {
      ...authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (response.body && response.body.media_id_string) {
    console.log(response.body);
    return response.body.media_id_string;
  } else {
    throw new Error(
      "Error initializing media upload: " + JSON.stringify(response.body)
    );
  }
}

async function uploadMediaAppend(mediaId, mediaData, segmentIndex) {
  const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
  const separator = `--${boundary}`;
  const crlf = "\r\n";
  const contents =
    separator +
    crlf +
    'Content-Disposition: form-data; name="command"' +
    crlf +
    crlf +
    "APPEND" +
    crlf +
    separator +
    crlf +
    'Content-Disposition: form-data; name="media_id"' +
    crlf +
    crlf +
    mediaId +
    crlf +
    separator +
    crlf +
    'Content-Disposition: form-data; name="segment_index"' +
    crlf +
    crlf +
    segmentIndex +
    crlf +
    separator +
    crlf +
    'Content-Disposition: form-data; name="media"' +
    crlf +
    "Content-Type: application/octet-stream" +
    crlf +
    crlf;

  const footer = crlf + separator + "--";

  const multipartBody = Buffer.concat([
    Buffer.from(contents),
    mediaData,
    Buffer.from(footer),
  ]);

  const authHeader = oauth.toHeader(
    oauth.authorize(
      {
        url: mediaEndpointUrl,
        method: "POST",
      },
      token
    )
  );

  const response = await needle("post", mediaEndpointUrl, multipartBody, {
    headers: {
      ...authHeader,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": multipartBody.length,
    },
  });

  if (response.statusCode !== 204) {
    throw new Error("Error appending media: " + JSON.stringify(response.body));
  }
}

async function uploadMediaFinalize(mediaId) {
  const params = {
    command: "FINALIZE",
    media_id: mediaId,
  };

  const authHeader = oauth.toHeader(
    oauth.authorize(
      {
        url: mediaEndpointUrl,
        method: "POST",
        data: params,
      },
      token
    )
  );

  const response = await needle("post", mediaEndpointUrl, params, {
    headers: {
      ...authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (response.body && response.body.media_id_string) {
    return response.body.media_id_string;
  } else {
    throw new Error(
      "Error finalizing media upload: " + JSON.stringify(response.body)
    );
  }
}

async function uploadMediaStatus(mediaId) {
  const params = {
    command: "STATUS",
    media_id: mediaId,
  };

  const authHeader = oauth.toHeader(
    oauth.authorize(
      {
        url: mediaEndpointUrl,
        method: "GET",
        data: params,
      },
      token
    )
  );
  console.log("Checking media status...");
  let state = "pending";

  while (state !== "succeeded") {
    const response = await needle("get", mediaEndpointUrl, params, {
      headers: {
        ...authHeader,
      },
    });

    if (response.body && response.body.processing_info) {
      const processingInfo = response.body.processing_info;
      state = processingInfo.state;

      if (state === "succeeded") {
        return mediaId;
      } else if (state === "failed") {
        throw new Error(
          "Media upload failed: " + JSON.stringify(response.body)
        );
      } else {
        const checkAfterSecs = processingInfo.check_after_secs || 5;
        console.log(
          `Media processing ${state}. Checking again in ${checkAfterSecs} seconds.`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, checkAfterSecs * 1000)
        );
      }
    } else {
      throw new Error(
        "Error checking media status: " + JSON.stringify(response.body)
      );
    }
  }
}

async function uploadMedia(imageUrl) {
  const pathArr = imageUrl.split(".");
  const ext = pathArr[pathArr.length - 1].toLowerCase();
  let mediaCategory = "tweet_image";
  let mediaType = "image/jpeg";
  let requiresStatusCheck = true;

  if (ext == "mov" || ext == "mp4") {
    mediaCategory = "tweet_video";
    mediaType = "video/mp4";
  } else if (ext == "gif") {
    mediaCategory = "tweet_gif";
    mediaType = "image/gif";
  } else if (ext == "jpg" || ext == "png") {
    requiresStatusCheck = false;
    mediaCategory = "tweet_image";
    mediaType = ext == "png" ? "image/png" : "image/jpeg";
  }

  const tempImagePath = path.resolve(`temp-image.${ext}`);
  await downloadImage(imageUrl, tempImagePath);
  const mediaData = fs.readFileSync(tempImagePath);
  const mediaSize = fs.statSync(tempImagePath).size;

  console.log("mediaType, mediaCategory", mediaType, mediaCategory);
  // Initialize upload
  const mediaId = await uploadMediaInit(mediaSize, mediaType, mediaCategory);

  // Upload chunks
  const chunkSize = 5 * 1024 * 1024; // 5MB per chunk
  for (let i = 0; i < mediaSize; i += chunkSize) {
    const chunk = mediaData.subarray(i, i + chunkSize);
    await uploadMediaAppend(mediaId, chunk, i / chunkSize);
  }

  // Finalize upload
  await uploadMediaFinalize(mediaId);

  // Check media status if required
  if (requiresStatusCheck) {
    await uploadMediaStatus(mediaId);
  }

  // Remove the temporary image file
  fs.unlinkSync(tempImagePath);

  return mediaId;
}

async function postTweet(text, mediaIds) {
  const data = {
    text: text,
    media: { media_ids: mediaIds },
  };

  const authHeader = oauth.toHeader(
    oauth.authorize(
      {
        url: tweetEndpointUrl,
        method: "POST",
      },
      token
    )
  );

  try {
    const response = await needle("post", tweetEndpointUrl, data, {
      headers: {
        ...authHeader,
        "content-type": "application/json",
      },
    });

    if (response.body) {
      console.log("Tweet posted:", response.body);
    } else {
      console.error("Error posting tweet:", response.body);
    }
  } catch (error) {
    console.error("Request failed:", error);
  }
}

(async () => {
  try {
    const mediaId = await uploadMedia(TEST_IMAGE_URL);
    await postTweet("Hello, Crypto world! Power to you", [mediaId]);
  } catch (error) {
    console.error("Error:", error);
  }
})();
