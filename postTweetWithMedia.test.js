import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import XApiClient from "./src/index"; // Replace with your actual class import
import fs from "fs";
import path from "path";

vi.mock("fs");
vi.mock("path");

describe("XApiClient", () => {
  const config = {
    X_API_KEY: "test_api_key",
    X_API_SECRET: "test_api_secret",
    X_API_ACCESS_TOKEN: "test_access_token",
    X_API_ACCESS_TOKEN_SECRET: "test_access_token_secret",
  };

  let client;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new XApiClient(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should post a tweet with media successfully", async () => {
    const mediaUrl = "http://example.com/image.mp4";
    const mediaId = "1234567890";
    const text = "Hello, world!";

    // Mock the fetch function
    vi.spyOn(global, "fetch").mockImplementation((url, options) => {
      if (url === mediaUrl) {
        return Promise.resolve({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
        });
      }
      if (url.includes("upload.json") && options.method === "POST") {
        if (options.headers["Content-Type"].includes("multipart/form-data")) {
          const parts = options.body.toString().split("\r\n");
          const commandPart = parts.find((part, i) => {
            return i > 0 && parts[i - 2]?.includes('name="command"');
          });
          const command = commandPart.match(/APPEND/)?.[0];
          if (command === "APPEND") {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ media_id_string: mediaId }),
            });
          }
        } else {
          const params = new URLSearchParams(options.body.toString());
          if (params.get("command") === "INIT") {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ media_id_string: mediaId }),
            });
          }
          if (params.get("command") === "FINALIZE") {
            return Promise.resolve({ ok: true });
          }
          if (url.includes("STATUS")) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  processing_info: { state: "succeeded" },
                }),
            });
          }
        }
        return Promise.resolve({ ok: true });
      }
      if (url.includes("2/tweets") && options.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { id: mediaId, text } }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    // Mock fs and path methods
    fs.writeFileSync.mockReturnValue(undefined);
    fs.readFileSync.mockReturnValue(Buffer.from(new ArrayBuffer(10)));
    fs.statSync.mockReturnValue({ size: 10 });
    fs.unlinkSync.mockReturnValue(undefined);
    path.resolve.mockReturnValue("temp-image.jpg");

    await client.postTweetWithMedia(text, mediaUrl);

    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(fs.readFileSync).toHaveBeenCalled();
    expect(fs.statSync).toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  it("should handle missing configuration error", async () => {
    expect(() => new XApiClient(null)).toThrow(
      "Configuration options not set."
    );
  });

  it("should handle media upload error", async () => {
    const mediaUrl = "http://example.com/image.mp4";
    const text = "Hello, world!";

    // Mock the fetch function
    vi.spyOn(global, "fetch").mockImplementation((url, options) => {
      if (url === mediaUrl) {
        return Promise.resolve({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
        });
      }
      if (url.includes("upload.json") && options.method === "POST") {
        const params = new URLSearchParams(options.body.toString());
        if (params.get("command") === "INIT") {
          return Promise.resolve({
            ok: false,
            statusText: "Invalid request",
          });
        }
        return Promise.resolve({ ok: true });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    // Mock fs and path methods
    fs.writeFileSync.mockReturnValue(undefined);
    fs.readFileSync.mockReturnValue(Buffer.from(new ArrayBuffer(10)));
    fs.statSync.mockReturnValue({ size: 10 });
    fs.unlinkSync.mockReturnValue(undefined);
    path.resolve.mockReturnValue("temp-image.jpg");

    try {
      await client.postTweetWithMedia(text, mediaUrl);
    } catch (error) {
      expect(error.message).toContain("Error initializing media upload");
    }
  });
});
