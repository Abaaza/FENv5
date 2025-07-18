import { v4 as uuidv4 } from 'uuid';

// Dynamic import for aws-sdk to handle Lambda environment
let Lambda: any, S3: any, SQS: any;
let lambda: any, sqs: any, s3: any;
let awsSdkAvailable = false;

try {
  const AWS = require('aws-sdk');
  Lambda = AWS.Lambda;
  S3 = AWS.S3;
  SQS = AWS.SQS;
  
  lambda = new Lambda({
    region: process.env.AWS_REGION || 'us-east-1'
  });

  sqs = new SQS({
    region: process.env.AWS_REGION || 'us-east-1'
  });

  s3 = new S3({
    region: process.env.AWS_REGION || 'us-east-1'
  });
  
  awsSdkAvailable = true;
} catch (error) {
  console.warn('[AsyncJobInvoker] aws-sdk not available, async jobs disabled');
}

export interface JobPayload {
  jobId: string;
  userId: string;
  items: any[];
  method: string;
}

export interface JobReference {
  jobId: string;
  userId: string;
  method: string;
  itemCount: number;
  s3Key?: string; // S3 key for large payloads
}

export class AsyncJobInvoker {
  private static readonly LARGE_JOB_THRESHOLD = 100; // Items count threshold
  private static readonly SQS_QUEUE_URL = process.env.SQS_QUEUE_URL || '';
  
  /**
   * Determine if a job should be processed asynchronously
   */
  static shouldProcessAsync(itemCount: number): boolean {
    // In Lambda environment, use async for large jobs
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return itemCount > this.LARGE_JOB_THRESHOLD;
    }
    return false; // Local development always uses sync
  }

  /**
   * Invoke Lambda function asynchronously
   */
  static async invokeLambda(payload: JobPayload): Promise<void> {
    if (!awsSdkAvailable) {
      throw new Error('AWS SDK not available for async processing');
    }
    
    const params = {
      FunctionName: `${process.env.AWS_LAMBDA_FUNCTION_NAME}-processJob`,
      InvocationType: 'Event', // Async invocation
      Payload: JSON.stringify(payload)
    };

    try {
      const result = await lambda.invoke(params).promise();
      console.log(`[AsyncJobInvoker] Lambda invoked for job ${payload.jobId}, status: ${result.StatusCode}`);
    } catch (error) {
      console.error('[AsyncJobInvoker] Failed to invoke Lambda:', error);
      throw new Error('Failed to start async job processing');
    }
  }

  /**
   * Send job to SQS queue with S3 storage for large payloads
   */
  static async sendToQueue(payload: JobPayload): Promise<void> {
    if (!awsSdkAvailable) {
      throw new Error('AWS SDK not available for async processing');
    }
    
    if (!this.SQS_QUEUE_URL) {
      console.warn('[AsyncJobInvoker] SQS_QUEUE_URL not configured, falling back to direct processing');
      throw new Error('SQS_QUEUE_URL not configured');
    }

    // Check payload size (SQS limit is 256KB)
    const payloadSize = Buffer.byteLength(JSON.stringify(payload));
    const MAX_SQS_SIZE = 200000; // Leave some margin below 256KB
    
    let messageBody: string;
    let jobReference: JobReference;
    
    if (payloadSize > MAX_SQS_SIZE) {
      // Store large payload in S3
      console.log(`[AsyncJobInvoker] Large payload (${payloadSize} bytes), storing in S3`);
      
      const s3Key = `job-payloads/${payload.jobId}-${uuidv4()}.json`;
      const bucketName = process.env.AWS_S3_BUCKET || 'mjd-boq-uploads-prod';
      
      try {
        await s3.putObject({
          Bucket: bucketName,
          Key: s3Key,
          Body: JSON.stringify(payload),
          ContentType: 'application/json'
        }).promise();
        
        console.log(`[AsyncJobInvoker] Payload stored in S3: s3://${bucketName}/${s3Key}`);
        
        // Create reference object for SQS
        jobReference = {
          jobId: payload.jobId,
          userId: payload.userId,
          method: payload.method,
          itemCount: payload.items.length,
          s3Key: s3Key
        };
        
        messageBody = JSON.stringify(jobReference);
      } catch (s3Error) {
        console.error('[AsyncJobInvoker] Failed to store payload in S3:', s3Error);
        throw new Error('Failed to store large payload');
      }
    } else {
      // Small payload, send directly
      messageBody = JSON.stringify(payload);
      jobReference = {
        jobId: payload.jobId,
        userId: payload.userId,
        method: payload.method,
        itemCount: payload.items.length
      };
    }

    const params = {
      QueueUrl: this.SQS_QUEUE_URL,
      MessageBody: messageBody,
      MessageAttributes: {
        jobId: {
          DataType: 'String',
          StringValue: payload.jobId
        },
        userId: {
          DataType: 'String',
          StringValue: payload.userId
        },
        itemCount: {
          DataType: 'Number',
          StringValue: payload.items.length.toString()
        },
        hasS3Payload: {
          DataType: 'String',
          StringValue: jobReference.s3Key ? 'true' : 'false'
        }
      }
    };

    try {
      const result = await sqs.sendMessage(params).promise();
      console.log(`[AsyncJobInvoker] Job ${payload.jobId} sent to SQS, MessageId: ${result.MessageId}`);
    } catch (error) {
      console.error('[AsyncJobInvoker] Failed to send to SQS:', error);
      
      // Clean up S3 object if it was created
      if (jobReference.s3Key) {
        try {
          await s3.deleteObject({
            Bucket: process.env.AWS_S3_BUCKET || 'mjd-boq-uploads-prod',
            Key: jobReference.s3Key
          }).promise();
        } catch (cleanupError) {
          console.error('[AsyncJobInvoker] Failed to cleanup S3 object:', cleanupError);
        }
      }
      
      throw new Error('Failed to queue job for processing');
    }
  }

  /**
   * Retrieve job payload from S3 (for large payloads)
   */
  static async getPayloadFromS3(s3Key: string): Promise<JobPayload> {
    const bucketName = process.env.AWS_S3_BUCKET || 'mjd-boq-uploads-prod';
    
    try {
      const result = await s3.getObject({
        Bucket: bucketName,
        Key: s3Key
      }).promise();
      
      const payload = JSON.parse(result.Body!.toString());
      console.log(`[AsyncJobInvoker] Retrieved payload from S3: ${s3Key}`);
      
      // Clean up S3 object after retrieval
      try {
        await s3.deleteObject({
          Bucket: bucketName,
          Key: s3Key
        }).promise();
        console.log(`[AsyncJobInvoker] Cleaned up S3 object: ${s3Key}`);
      } catch (cleanupError) {
        console.error('[AsyncJobInvoker] Failed to cleanup S3 object:', cleanupError);
      }
      
      return payload;
    } catch (error) {
      console.error('[AsyncJobInvoker] Failed to retrieve payload from S3:', error);
      throw new Error('Failed to retrieve job payload');
    }
  }
}