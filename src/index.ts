import OAuth from "oauth";
import path from "path";

import { MediaUploadInitResponse, MediaUploadStatusResponse } from "./index.d";

const mediaEndpointUrl = "https://upload.twitter.com/1.1/media/upload.json";
const tweetEndpointUrl = "https://api.twitter.com/2/tweets";
const requestTokenUrl = "https://api.twitter.com/oauth/request_token";
const accessTokenUrl = "https://api.twitter.com/oauth/access_token";

interface Config {
  X_API_KEY: string;
  X_API_SECRET: string;
  X_API_ACCESS_TOKEN: string;
  X_API_ACCESS_TOKEN_SECRET: string;
}

interface TweetResponse {
  data?: {
    id: string;
    text: string;
    edit_history_tweet_ids?: string[];
  };
  errors?: Array<{
    detail: string;
    title: string;
    resource_type?: string;
    parameter?: string;
    resource_id?: string;
    type?: string;
  }>;
}

export default class XApiClient {
  #X_API_ACCESS_TOKEN: string;
  #X_API_ACCESS_TOKEN_SECRET: string;
  #oauth: OAuth.OAuth;

  constructor(config: Config) {
    if (
      !config?.X_API_KEY ||
      !config?.X_API_SECRET ||
      !config?.X_API_ACCESS_TOKEN ||
      !config?.X_API_ACCESS_TOKEN_SECRET
    ) {
      throw new Error("Configuration options not set.");
    }
    this.#X_API_ACCESS_TOKEN = config.X_API_ACCESS_TOKEN;
    this.#X_API_ACCESS_TOKEN_SECRET = config.X_API_ACCESS_TOKEN_SECRET;
    this.#oauth = new OAuth.OAuth(
      requestTokenUrl,
      accessTokenUrl,
      config.X_API_KEY,
      config.X_API_SECRET,
      "1.0A",
      null,
      "HMAC-SHA1"
    );
  }

  #getAuthHeader(
    endpoint: string,
    method: string,
    params?: Record<string, any>
  ): string {
    return this.#oauth.authHeader(
      endpoint + (params ? "?" + new URLSearchParams(params).toString() : ""),
      this.#X_API_ACCESS_TOKEN,
      this.#X_API_ACCESS_TOKEN_SECRET,
      method
    );
  }

  async postTweetWithMedia(
    text: string,
    mediaUrls?: string | string[]
  ): Promise<TweetResponse> {
    const _mediaUrls =
      typeof mediaUrls !== "string"
        ? mediaUrls?.length
          ? mediaUrls
          : undefined
        : [mediaUrls];
    const mediaIds = _mediaUrls ? ([] as string[]) : undefined;
    if (mediaIds && _mediaUrls) {
      for await (const mediaUrl of _mediaUrls) {
        const mediaId = await this.#uploadMedia(mediaUrl);
        mediaId && mediaIds.push(mediaId);
      }
    }
    return await this.#postTweet(text, mediaIds);
  }

  async #uploadMedia(imageUrl: string): Promise<string | undefined> {
    const pathArr = imageUrl.split(".");
    const ext = pathArr[pathArr.length - 1].toLowerCase();
    let mediaCategory = "tweet_image";
    let mediaType = "image/jpeg";
    let requiresStatusCheck = true;

    if (ext === "mov" || ext === "mp4") {
      mediaCategory = "tweet_video";
      mediaType = "video/mp4";
    } else if (ext === "gif") {
      mediaCategory = "tweet_gif";
      mediaType = "image/gif";
    } else if (ext === "jpg" || ext === "png") {
      requiresStatusCheck = false;
      mediaCategory = "tweet_image";
      mediaType = ext === "png" ? "image/png" : "image/jpeg";
    }

    const mediaData = await this.#downloadImage(imageUrl);
    const mediaSize = mediaData.byteLength;

    // Initialize upload
    const mediaId = await this.#uploadMediaInit(
      mediaSize,
      mediaType,
      mediaCategory
    );
    if (!mediaId) {
      throw new Error("Error initializing media upload.");
    }

    // Upload chunks
    const chunkSize = 5 * 1024 * 1024; // 5MB per chunk
    for (let i = 0; i < mediaSize; i += chunkSize) {
      const chunk = mediaData.subarray(i, i + chunkSize);
      await this.#uploadMediaAppend(mediaId, chunk, i / chunkSize);
    }

    // Finalize upload
    await this.#uploadMediaFinalize(mediaId);

    // Check media status if required
    if (requiresStatusCheck) {
      await this.#uploadMediaStatus(mediaId);
    }

    console.log("Media uploaded successfully.");
    return mediaId;
  }

  async #downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    console.log("Remote image downloaded.");
    return Buffer.from(buffer);
  }

  async #uploadMediaInit(
    mediaSize: number,
    mediaType: string,
    mediaCategory: string
  ): Promise<string | undefined> {
    const params = {
      command: "INIT",
      total_bytes: mediaSize,
      media_type: mediaType,
      media_category: mediaCategory,
    };

    const Authorization = this.#getAuthHeader(mediaEndpointUrl, "POST", params);

    try {
      const response = await fetch(mediaEndpointUrl, {
        method: "POST",
        headers: {
          Authorization,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params as any),
      });

      if (!response.ok) {
        throw new Error(
          "Error initializing media upload: " + response.statusText
        );
      }
      const body = (await response.json()) as MediaUploadInitResponse;
      if (body && body.media_id_string) {
        console.log("Media initialized with id:", body.media_id_string);
        return body.media_id_string;
      } else {
        throw new Error("Error no media_id_string: " + JSON.stringify(body));
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  async #uploadMediaAppend(
    mediaId: string,
    mediaData: Buffer,
    segmentIndex: number
  ): Promise<void> {
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

    const Authorization = this.#getAuthHeader(mediaEndpointUrl, "POST");

    const response = await fetch(mediaEndpointUrl, {
      method: "POST",
      headers: {
        Authorization,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": multipartBody.length.toString(),
      },
      body: multipartBody,
    });

    if (!response.ok) {
      throw new Error("Error appending media: " + response.statusText);
    }
  }

  async #uploadMediaFinalize(mediaId: string): Promise<void> {
    const params = {
      command: "FINALIZE",
      media_id: mediaId,
    };

    const Authorization = this.#getAuthHeader(mediaEndpointUrl, "POST", params);

    try {
      const response = await fetch(mediaEndpointUrl, {
        method: "POST",
        headers: {
          Authorization,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params as any),
      });

      if (!response.ok) {
        throw new Error(
          "Error finalizing media upload: " + response.statusText
        );
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  async #uploadMediaStatus(mediaId: string): Promise<string | undefined> {
    const params = {
      command: "STATUS",
      media_id: mediaId,
    };

    const Authorization = this.#getAuthHeader?.(
      mediaEndpointUrl,
      "GET",
      params
    );

    console.log("Checking media status...");
    let state = "pending";
    let errorCaught = false;
    while (state !== "succeeded" && !errorCaught) {
      try {
        const response = await fetch(
          `${mediaEndpointUrl}?command=STATUS&media_id=${mediaId}`,
          {
            method: "GET",
            headers: {
              Authorization,
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );
        const body = (await response.json()) as MediaUploadStatusResponse;
        if (body && body.processing_info) {
          const processingInfo = body.processing_info;
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
            "Error checking media status: " + response.statusText
          );
        }
      } catch (error) {
        errorCaught = true;
        console.error("Error:", error);
      }
    }
  }

  async #postTweet(text: string, mediaIds?: string[]): Promise<TweetResponse> {
    const data = {
      text: text,
      ...(mediaIds?.length ? { media: { media_ids: mediaIds } } : {}),
    };

    const Authorization = this.#getAuthHeader(tweetEndpointUrl, "POST");

    try {
      const response = await fetch(tweetEndpointUrl, {
        method: "POST",
        headers: {
          Authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const body = (await response.json()) as TweetResponse;
      if (body) {
        console.log("Tweet posted successfully!");
        return body;
      } else {
        console.error("Error posting tweet:", response.statusText);
      }
    } catch (error) {
      console.error("Request failed:", error);
      return {
        errors: [
          {
            detail: (error as { message: string }).message,
            title: "Request failed",
          },
        ],
      };
    }
    return { errors: [{ detail: "Unknown error", title: "Unknown error" }] };
  }
}
