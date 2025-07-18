import { put, del, list } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';

export class BlobStorageService {
  private static instance: BlobStorageService;

  static getInstance(): BlobStorageService {
    if (!BlobStorageService.instance) {
      BlobStorageService.instance = new BlobStorageService();
    }
    return BlobStorageService.instance;
  }

  /**
   * Upload BOQ file to Vercel Blob
   */
  async uploadBOQFile(
    userId: string,
    filename: string,
    buffer: Buffer
  ): Promise<{ url: string; fileId: string }> {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN not configured');
    }

    const fileId = uuidv4();
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const blobName = `boq-files/${userId}/${timestamp}-${safeName}`;
    
    console.log(`[BlobStorage] Uploading file: ${blobName}`);
    
    const result = await put(blobName, buffer, {
      access: 'public',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log(`[BlobStorage] File uploaded successfully: ${result.url}`);
    
    return {
      url: result.url,
      fileId,
    };
  }

  /**
   * Download file from Blob storage
   */
  async downloadFile(url: string): Promise<Buffer> {
    console.log(`[BlobStorage] Downloading file from: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Upload result file to Blob
   */
  async uploadResultFile(
    jobId: string,
    buffer: Buffer,
    originalFilename: string
  ): Promise<string> {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN not configured');
    }

    const timestamp = Date.now();
    const blobName = `results/${jobId}/${timestamp}-matched-${originalFilename}`;
    
    console.log(`[BlobStorage] Uploading result file: ${blobName}`);
    
    const result = await put(blobName, buffer, {
      access: 'public',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log(`[BlobStorage] Result file uploaded: ${result.url}`);
    return result.url;
  }

  /**
   * Delete file from Blob storage
   */
  async deleteFile(url: string): Promise<void> {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN not configured');
    }

    console.log(`[BlobStorage] Deleting file: ${url}`);
    
    await del(url, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    
    console.log(`[BlobStorage] File deleted successfully`);
  }

  /**
   * List files for a user
   */
  async listUserFiles(userId: string) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN not configured');
    }

    const prefix = `boq-files/${userId}/`;
    
    const result = await list({
      prefix,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    
    return result.blobs;
  }
}
