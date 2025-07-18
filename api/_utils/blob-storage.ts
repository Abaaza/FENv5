import { put, del, list } from '@vercel/blob';

export class BlobStorageService {
  /**
   * Upload a file to Vercel Blob storage
   */
  static async uploadFile(
    filename: string,
    buffer: Buffer,
    contentType: string = 'application/octet-stream'
  ): Promise<{ url: string; downloadUrl: string }> {
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    });

    return {
      url: blob.url,
      downloadUrl: blob.downloadUrl || blob.url,
    };
  }

  /**
   * Delete a file from Vercel Blob storage
   */
  static async deleteFile(url: string): Promise<void> {
    await del(url);
  }

  /**
   * List files in Vercel Blob storage
   */
  static async listFiles(prefix?: string) {
    const blobs = await list({
      prefix,
    });
    
    return blobs.blobs;
  }

  /**
   * Upload Excel file for BOQ processing
   */
  static async uploadBOQFile(
    userId: string,
    filename: string,
    buffer: Buffer
  ): Promise<string> {
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const blobName = `boq-files/${userId}/${timestamp}-${safeName}`;
    
    const result = await put(blobName, buffer, {
      access: 'public',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    return result.url;
  }

  /**
   * Upload match results Excel file
   */
  static async uploadResultsFile(
    jobId: string,
    buffer: Buffer
  ): Promise<string> {
    const blobName = `results/${jobId}/matched-results.xlsx`;
    
    const result = await put(blobName, buffer, {
      access: 'public',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    return result.url;
  }
}