import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const S3_BUCKET_NAME = 'mjd-boq-uploads-prod';

export class S3StorageService {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      } : undefined,
    });
  }

  /**
   * Upload a file to S3
   */
  async uploadFile(
    filename: string,
    buffer: Buffer,
    contentType: string = 'application/octet-stream'
  ): Promise<{ url: string; downloadUrl: string }> {
    const key = `uploads/${Date.now()}-${filename}`;
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));

    const url = `https://${S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
    const downloadUrl = await getSignedUrl(
      this.s3Client,
      new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key }),
      { expiresIn: 3600 }
    );

    return { url, downloadUrl };
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(url: string): Promise<void> {
    const key = url.split(`${S3_BUCKET_NAME}.s3.amazonaws.com/`)[1];
    if (!key) throw new Error('Invalid S3 URL');

    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
    }));
  }

  /**
   * List files in S3
   */
  async listFiles(prefix?: string) {
    const result = await this.s3Client.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: prefix,
    }));
    
    return result.Contents || [];
  }

  /**
   * Upload Excel file for BOQ processing
   */
  async uploadBOQFile(
    userId: string,
    filename: string,
    buffer: Buffer
  ): Promise<string> {
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `boq-files/${userId}/${timestamp}-${safeName}`;
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }));

    return `https://${S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
  }

  /**
   * Upload match results Excel file
   */
  async uploadResultsFile(
    jobId: string,
    buffer: Buffer
  ): Promise<string> {
    const key = `results/${jobId}/matched-results.xlsx`;
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }));

    return `https://${S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
  }
}