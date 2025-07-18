import { s3Storage } from './s3Storage.service';

export class FileStorageService {
  private static instance: FileStorageService;

  private constructor() {
    // S3Storage handles all the configuration internally
  }

  static getInstance(): FileStorageService {
    if (!FileStorageService.instance) {
      FileStorageService.instance = new FileStorageService();
    }
    return FileStorageService.instance;
  }

  async initialize(): Promise<void> {
    // Initialize S3 storage
    await s3Storage.initialize();
  }

  async saveFile(buffer: Buffer, originalName: string): Promise<string> {
    return await s3Storage.saveFile(buffer, originalName);
  }

  async getFile(fileId: string): Promise<Buffer> {
    return await s3Storage.getFile(fileId);
  }

  async deleteFile(fileId: string): Promise<void> {
    await s3Storage.deleteFile(fileId);
  }

  async fileExists(fileId: string): Promise<boolean> {
    try {
      await s3Storage.getFile(fileId);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getFileUrl(fileId: string): Promise<string> {
    // Get a signed URL for S3 files
    return await s3Storage.getSignedUrl(fileId);
  }

  async cleanupOldFiles(daysOld: number = 7): Promise<void> {
    // This would need to be implemented in S3Storage service
    console.log(`[FileStorage] Cleanup not implemented for S3 yet`);
  }
}

// Export singleton instance
export const fileStorage = FileStorageService.getInstance();