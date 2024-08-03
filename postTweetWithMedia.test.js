import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { postTweetWithMedia } from "./index"; // Replace with your actual function import
import fs from "fs";
import path from "path";

vi.mock("fs");
vi.mock("path");

describe("postTweetWithMedia", () => {
  const config = {
    X_API_KEY: "test_api_key",
    X_API_SECRET: "test_api_secret",
    X_API_ACCESS_TOKEN: "test_access_token",
    X_API_ACCESS_TOKEN_SECRET: "test_access_token_secret",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
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
          // Handle the APPEND command
          const parts = options.body.toString().split("\r\n");
          const commandPart = parts.find((part, i) => {
            return i > 0 && parts[i - 2]?.includes('name="command"');
          });
          const command = commandPart;
          if (command === "APPEND") {
            console.log("APPEND");
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ media_id_string: mediaId }),
            });
          }
        } else {
          const params = new URLSearchParams(options.body.toString());
          if (params.get("command") === "INIT") {
            console.log("INIT");
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ media_id_string: mediaId }),
            });
          }
          if (params.get("command") === "FINALIZE") {
            console.log("FINALIZE");
            return Promise.resolve({ ok: true });
          }
          if (url.includes("STATUS")) {
            console.log("STATUS");
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

    await postTweetWithMedia(config, text, mediaUrl);

    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(fs.readFileSync).toHaveBeenCalled();
    expect(fs.statSync).toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  it("should handle missing configuration error", async () => {
    try {
      await postTweetWithMedia(
        null,
        "Hello, world!",
        "http://example.com/image.mp4"
      );
    } catch (error) {
      expect(error.message).toBe("Configuration options not set.");
    }
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
      if (url.startsWith("https://upload.twitter.com/1.1/media/upload.json")) {
        if (options.headers["Content-Type"].startsWith("multipart/form-data")) {
          // Handle the APPEND command
          const parts = options.body.toString().split("\r\n");
          const commandPart = parts.find((part, i) => {
            return i > 0 && parts[i - 2]?.includes('name="command"');
          });
          const command = commandPart;
          if (command === "APPEND") {
            return Promise.resolve({ ok: true });
          }
        } else {
          // Handle INIT, FINALIZE, and STATUS commands
          const params = new URLSearchParams(options.body.toString());
          const command = params.get("command");
          if (command === "INIT") {
            console.log("INIT");
            return Promise.resolve({
              ok: false,
              statusText: "Invalid request",
            });
          }
          if (command === "FINALIZE") {
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
      if (
        url === "https://api.twitter.com/2/tweets" &&
        options.method === "POST"
      ) {
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

    try {
      await postTweetWithMedia(config, text, mediaUrl);
    } catch (error) {
      expect(error.message).toContain("Error initializing media upload");
    }
  });
});
