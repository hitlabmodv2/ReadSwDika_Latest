declare function getDefaultDownloadPath(): string;
declare function downloadMedia(url: string, outputPath: string, filename: string, cookie?: string): Promise<void>;
declare function handleMediaDownload(data: any, outputPath: string, version: string): Promise<void>;
declare function downloadMusicFromDetail(musicIdOrUrl: string, cookie: string | any[], outputPath: string, proxy?: string): Promise<void>;
export { getDefaultDownloadPath, downloadMedia, handleMediaDownload, downloadMusicFromDetail };
