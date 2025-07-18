const { jobProcessor } = require('./dist/services/jobProcessor.service');
const { getConvexClient } = require('./dist/config/convex');
const { api } = require('./dist/lib/convex-api');

// Set longer timeout for async processing
const ASYNC_TIMEOUT = 14 * 60 * 1000; // 14 minutes (leaving 1 minute buffer)

exports.processJobAsync = async (event) => {
  console.log('[Async Handler] Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Parse the job details from the event
    const { jobId, userId, items, method } = event;
    
    if (!jobId || !userId || !items || !method) {
      throw new Error('Missing required job parameters');
    }
    
    console.log(`[Async Handler] Processing job ${jobId} with ${items.length} items using ${method} method`);
    
    // Start processing the job
    await jobProcessor.addJob(jobId, userId, items, method);
    
    // Wait for job completion or timeout
    const startTime = Date.now();
    let jobCompleted = false;
    
    while (!jobCompleted && (Date.now() - startTime) < ASYNC_TIMEOUT) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
      
      const jobStatus = jobProcessor.getJobStatus(jobId);
      if (jobStatus) {
        console.log(`[Async Handler] Job ${jobId} status: ${jobStatus.status}, progress: ${jobStatus.progress}%`);
        
        if (['completed', 'failed', 'cancelled'].includes(jobStatus.status)) {
          jobCompleted = true;
        }
      }
    }
    
    if (!jobCompleted) {
      console.warn(`[Async Handler] Job ${jobId} did not complete within timeout`);
      // Job will continue running in background
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: jobCompleted ? 'Job completed' : 'Job processing continues in background',
        jobId
      })
    };
    
  } catch (error) {
    console.error('[Async Handler] Error processing job:', error);
    
    // Update job status to failed
    if (event.jobId) {
      try {
        const convex = getConvexClient();
        await convex.mutation(api.priceMatching.updateJobStatus, {
          jobId: event.jobId,
          status: 'failed',
          error: error.message
        });
      } catch (updateError) {
        console.error('[Async Handler] Failed to update job status:', updateError);
      }
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Job processing failed',
        message: error.message
      })
    };
  }
};

// For SQS processing
exports.processSQSJob = async (event) => {
  console.log('[SQS Handler] Processing SQS messages:', event.Records.length);
  
  const results = [];
  
  for (const record of event.Records) {
    try {
      const jobData = JSON.parse(record.body);
      const result = await exports.processJobAsync(jobData);
      results.push({ messageId: record.messageId, status: 'success', result });
    } catch (error) {
      console.error('[SQS Handler] Error processing message:', record.messageId, error);
      results.push({ messageId: record.messageId, status: 'error', error: error.message });
      // Don't throw - let SQS handle retries
    }
  }
  
  return { batchItemFailures: [] }; // All messages processed (even if failed)
};