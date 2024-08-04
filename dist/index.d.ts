interface Config {
    X_API_KEY: string;
    X_API_SECRET: string;
    X_API_ACCESS_TOKEN: string;
    X_API_ACCESS_TOKEN_SECRET: string;
}
export default class XApiClient {
    #private;
    constructor(config: Config);
    postTweetWithMedia(text: string, mediaUrls?: string | string[]): Promise<void>;
}
export {};
