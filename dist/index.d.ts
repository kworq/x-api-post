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
    #private;
    constructor(config: Config);
    postTweetWithMedia(text: string, mediaUrls?: string | string[]): Promise<TweetResponse>;
}
export {};
