console.log('Process Job Lambda handler loading...');

const { jobProcessor } = require('./dist/services/jobProcessor.service');
const { AsyncJobInvoker } = require('./dist/utils/asyncJobInvoker');
const { getConvexClient } = require('./dist/config/convex');
const { api } = require('./dist/lib/convex-api');

// Lambda handler for processing jobs from SQS
module.exports.handler = async (event, context) => {
  console.log('=== PROCESS JOB LAMBDA START ===');
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify({
    functionName: context.functionName,
    requestId: context.awsRequestId,
    remainingTime: context.getRemainingTimeInMillis()
  }, null, 2));
  
  const results = {
    successful: 0,
    failed: 0,
    errors: []
  };
  
  try {
    // Handle SQS messages
    if (event.Records) {
      for (const record of event.Records) {
        try {
          console.log(`Processing SQS message: ${record.messageId}`);
          
          let jobData;
          const messageBody = JSON.parse(record.body);
          
          // Check if payload is stored in S3
          if (messageBody.s3Key) {
            console.log(`Retrieving large payload from S3: ${messageBody.s3Key}`);
            jobData = await AsyncJobInvoker.getPayloadFromS3(messageBody.s3Key);
          } else {
            jobData = messageBody;
          }
          
          console.log(`Processing job: ${jobData.jobId} with ${jobData.items.length} items`);
          
          // Update job status to processing
          const convex = getConvexClient();
          await convex.mutation(api.priceMatching.updateJobStatus, {
            jobId: jobData.jobId,
            status: 'processing',
            progress: 0,
            progressMessage: 'Starting job processing in Lambda'
          });
          
          // Process the job
          await jobProcessor.processJob(
            jobData.jobId,
            jobData.userId,
            jobData.items,
            jobData.method
          );
          
          results.successful++;
          console.log(`Successfully processed job: ${jobData.jobId}`);
          
          // Delete the message from SQS (it will be automatically deleted if successful)
        } catch (error) {
          console.error(`Failed to process message ${record.messageId}:`, error);
          results.failed++;
          results.errors.push({
            messageId: record.messageId,
            error: error.message
          });
          
          // Update job status to failed
          try {
            const jobId = JSON.parse(record.body).jobId;
            if (jobId) {
              const convex = getConvexClient();
              await convex.mutation(api.priceMatching.updateJobStatus, {
                jobId: jobId,
                status: 'failed',
                error: error.message
              });
            }
          } catch (updateError) {
            console.error('Failed to update job status:', updateError);
          }
        }
      }
    } 
    // Handle direct invocation
    else if (event.jobId) {
      console.log(`Direct invocation for job: ${event.jobId}`);
      
      await jobProcessor.processJob(
        event.jobId,
        event.userId,
        event.items,
        event.method
      );
      
      results.successful = 1;
      console.log(`Successfully processed job: ${event.jobId}`);
    }
    
    console.log('=== PROCESS JOB LAMBDA END ===');
    console.log('Results:', results);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Jobs processed',
        results: results
      })
    };
    
  } catch (error) {
    console.error('=== PROCESS JOB ERROR ===');
    console.error('Error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process jobs',
        message: error.message,
        results: results
      })
    };
  }
};

// Lambda handler for checking job processor status
module.exports.statusHandler = async (event, context) => {
  console.log('=== JOB PROCESSOR STATUS CHECK ===');
  
  try {
    const status = jobProcessor.getStatus();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        status: 'operational',
        processor: status,
        lambda: {
          functionName: context.functionName,
          requestId: context.awsRequestId,
          region: process.env.AWS_REGION
        }
      })
    };
  } catch (error) {
    console.error('Status check error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        status: 'error',
        error: error.message
      })
    };
  }
};