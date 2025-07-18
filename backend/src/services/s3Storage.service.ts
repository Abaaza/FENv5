// Use dynamic import for aws-sdk to handle Lambda environment
let AWS: any;
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

export class S3StorageService {
  private static instance: S3StorageService;
  private s3: any;
  private bucketName: string;
  private useS3: boolean;
  private localStorageDir: string;

  private constructor() {
    // Check if we have S3 configuration
    this.useS3 = !!(process.env.AWS_S3_BUCKET && (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_LAMBDA_FUNCTION_NAME));
    // Hardcode the bucket name for production
    this.bucketName = 'mjd-boq-uploads-prod';
    
    if (this.useS3) {
      try {
        // Try to load aws-sdk - it's available in Lambda runtime
        AWS = require('aws-sdk');
        // Initialize S3 client
        this.s3 = new AWS.S3({
          region: process.env.AWS_REGION || 'us-east-1',
          // Credentials are automatically loaded from environment or IAM role
        });
      } catch (error) {
        console.warn('[S3Storage] aws-sdk not available, falling back to local storage');
        this.useS3 = false;
      }
    }
    
    // Local storage fallback directory
    this.localStorageDir = process.env.AWS_LAMBDA_FUNCTION_NAME 
      ? '/tmp/uploads' 
      : path.join(process.cwd(), 'temp_uploads');
  }

  static getInstance(): S3StorageService {
    if (!S3StorageService.instance) {
      S3StorageService.instance = new S3StorageService();
    }
    return S3StorageService.instance;
  }

  async initialize(): Promise<void> {
    if (!this.useS3) {
      try {
        await fs.mkdir(this.localStorageDir, { recursive: true });
        console.log(`[S3Storage] Using local storage at: ${this.localStorageDir}`);
      } catch (error) {
        console.error('[S3Storage] Failed to create local storage directory:', error);
      }
    } else {
      console.log(`[S3Storage] Using S3 bucket: ${this.bucketName}`);
      
      // Verify bucket exists (optional)
      try {
        await this.s3.headBucket({ Bucket: this.bucketName }).promise();
        console.log('[S3Storage] S3 bucket verified');
      } catch (error: any) {
        if (error.code === 'NotFound') {
          console.log('[S3Storage] Creating S3 bucket...');
          try {
            await this.s3.createBucket({ Bucket: this.bucketName }).promise();
            console.log('[S3Storage] S3 bucket created');
          } catch (createError) {
            console.error('[S3Storage] Failed to create bucket:', createError);
          }
        } else {
          console.error('[S3Storage] Failed to verify bucket:', error);
        }
      }
    }
  }

  async saveFile(buffer: Buffer, originalName: string): Promise<string> {
    const fileId = uuidv4();
    const extension = path.extname(originalName);
    const fileName = `${fileId}${extension}`;

    if (this.useS3) {
      try {
        // Upload to S3
        const params = {
          Bucket: this.bucketName,
          Key: `uploads/${fileName}`,
          Body: buffer,
          ContentType: this.getContentType(extension),
          Metadata: {
            originalName: originalName,
            uploadDate: new Date().toISOString()
          }
        };

        await this.s3.upload(params).promise();
        console.log(`[S3Storage] File saved to S3: ${fileName}`);
        
        // Return the S3 key
        return `s3://${this.bucketName}/uploads/${fileName}`;
      } catch (error) {
        console.error('[S3Storage] Failed to upload to S3:', error);
        throw new Error('Failed to save file to S3');
      }
    } else {
      // Save locally
      const filePath = path.join(this.localStorageDir, fileName);
      await fs.writeFile(filePath, buffer);
      console.log(`[S3Storage] File saved locally: ${filePath}`);
      return fileName;
    }
  }

  async getFile(fileIdOrPath: string): Promise<Buffer> {
    if (this.useS3 && fileIdOrPath.startsWith('s3://')) {
      // Extract bucket and key from S3 URL
      const match = fileIdOrPath.match(/^s3:\/\/([^\/]+)\/(.+)$/);
      if (!match) {
        throw new Error('Invalid S3 URL format');
      }
      
      const [, bucket, key] = match;
      
      try {
        const params = {
          Bucket: bucket,
          Key: key
        };
        
        const result = await this.s3.getObject(params).promise();
        return result.Body as Buffer;
      } catch (error) {
        console.error('[S3Storage] Failed to get file from S3:', error);
        throw new Error('Failed to retrieve file from S3');
      }
    } else {
      // Get from local storage
      const fileName = path.basename(fileIdOrPath);
      const filePath = path.join(this.localStorageDir, fileName);
      return await fs.readFile(filePath);
    }
  }

  async deleteFile(fileIdOrPath: string): Promise<void> {
    if (this.useS3 && fileIdOrPath.startsWith('s3://')) {
      // Extract bucket and key from S3 URL
      const match = fileIdOrPath.match(/^s3:\/\/([^\/]+)\/(.+)$/);
      if (!match) {
        throw new Error('Invalid S3 URL format');
      }
      
      const [, bucket, key] = match;
      
      try {
        const params = {
          Bucket: bucket,
          Key: key
        };
        
        await this.s3.deleteObject(params).promise();
        console.log(`[S3Storage] File deleted from S3: ${key}`);
      } catch (error) {
        console.error('[S3Storage] Failed to delete file from S3:', error);
        throw new Error('Failed to delete file from S3');
      }
    } else {
      // Delete from local storage
      const fileName = path.basename(fileIdOrPath);
      const filePath = path.join(this.localStorageDir, fileName);
      
      try {
        await fs.unlink(filePath);
        console.log(`[S3Storage] File deleted locally: ${filePath}`);
      } catch (error) {
        console.error('[S3Storage] Failed to delete local file:', error);
      }
    }
  }

  async getSignedUrl(fileIdOrPath: string, expiresIn: number = 3600): Promise<string> {
    if (this.useS3 && fileIdOrPath.startsWith('s3://')) {
      // Extract bucket and key from S3 URL
      const match = fileIdOrPath.match(/^s3:\/\/([^\/]+)\/(.+)$/);
      if (!match) {
        throw new Error('Invalid S3 URL format');
      }
      
      const [, bucket, key] = match;
      
      const params = {
        Bucket: bucket,
        Key: key,
        Expires: expiresIn
      };
      
      return this.s3.getSignedUrl('getObject', params);
    } else {
      // For local files, return a local URL (this won't work in production)
      return `/api/files/${path.basename(fileIdOrPath)}`;
    }
  }

  private getContentType(extension: string): string {
    const contentTypes: Record<string, string> = {
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.csv': 'text/csv',
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.txt': 'text/plain'
    };
    
    return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
  }
}

// Export singleton instance
export const s3Storage = S3StorageService.getInstance();