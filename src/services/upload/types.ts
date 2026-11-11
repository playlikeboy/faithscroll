export interface UploadFileInput {
  /** `file://` URI of the local recording. */
  fileUri: string;
  /** Object path inside the bucket, e.g. `<uid>/<sermonId>/<recordingId>.m4a`. */
  objectPath: string;
  contentType: string;
  sizeBytes: number;
  onProgress?: (bytesSent: number, bytesTotal: number) => void;
  signal?: AbortSignal;
}

export interface UploadContext {
  supabaseUrl: string;
  /** Public anon/publishable key (sent as `apikey`). */
  anonKey: string;
  /** Fresh user access token for each request (long uploads can outlive a token). */
  getAccessToken: () => Promise<string>;
}
