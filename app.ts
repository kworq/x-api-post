import "dotenv/config";
import XApiClient from "./dist/index";

let TEST_IMAGE_URL = "https://www.w3schools.com/html/mov_bbb.mp4";

const config = {
  X_API_KEY: process.env.X_API_KEY as string,
  X_API_SECRET: process.env.X_API_SECRET as string,
  X_API_ACCESS_TOKEN: process.env.X_API_ACCESS_TOKEN as string,
  X_API_ACCESS_TOKEN_SECRET: process.env.X_API_ACCESS_TOKEN_SECRET as string,
};

const text = "Hello, world!";
const mediaUrls = [TEST_IMAGE_URL];

const xApiClient = new XApiClient(config);

xApiClient
  .postTweetWithMedia(text, mediaUrls)
  .then((response) => console.log(response))
  .catch((error) => console.error("Error posting tweet:", error));
