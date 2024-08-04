interface Config {
  X_API_KEY: string;
  X_API_SECRET: string;
  X_API_ACCESS_TOKEN: string;
  X_API_ACCESS_TOKEN_SECRET: string;
}

export interface MediaUploadInitResponse {
  media_id: number;
  media_id_string: string;
  expires_after_secs: number;
}

export interface MediaUploadAppendResponse {}

export interface MediaUploadFinalizeResponse {
  media_id: number;
  media_id_string: string;
  expires_after_secs: number;
  processing_info?: ProcessingInfo;
}

export interface ProcessingInfo {
  state: "pending" | "in_progress" | "succeeded" | "failed";
  check_after_secs: number;
  progress_percent?: number;
}

export interface MediaUploadStatusResponse {
  media_id: number;
  media_id_string: string;
  expires_after_secs: number;
  processing_info: ProcessingInfo;
}

declare class XApiClient {
  constructor(config: Config);

  postTweetWithMedia(
    text: string,
    mediaUrls?: string | string[]
  ): Promise<void>;

  // Private methods, not callable from outside the class
  private getAuthHeader(
    endpoint: string,
    method: string,
    params?: Record<string, any>
  ): string;

  private downloadImage(url: string, dest: string): Promise<void>;

  private uploadMediaInit(
    mediaSize: number,
    mediaType: string,
    mediaCategory: string
  ): Promise<MediaUploadInitResponse>;

  private uploadMediaAppend(
    mediaId: string,
    mediaData: Buffer,
    segmentIndex: number
  ): Promise<MediaUploadAppendResponse>;

  private uploadMediaFinalize(
    mediaId: string
  ): Promise<MediaUploadFinalizeResponse>;

  private uploadMediaStatus(
    mediaId: string
  ): Promise<MediaUploadStatusResponse>;

  private uploadMedia(imageUrl: string): Promise<string | undefined>;

  private postTweet(text: string, mediaIds?: string[]): Promise<void>;
}

export default XApiClient;
