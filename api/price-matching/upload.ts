import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
import { requireAuth } from '../_utils/auth.js';
import { BlobStorageService } from '../_utils/blob-storage.js';
import { ExcelService } from '../../backend/src/services/excel.service.js';
import formidable from 'formidable';
import { promises as fs } from 'fs';

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

async function uploadHandler(
  req: VercelRequest & { user: any },
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const form = formidable({
    maxFileSize: 50 * 1024 * 1024, // 50MB
  });

  try {
    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    // Read file
    const buffer = await fs.readFile(file.filepath);
    
    // Parse Excel file
    const excelService = new ExcelService();
    const parseResult = await excelService.parseExcelFile(
      buffer,
      file.originalFilename || 'uploaded.xlsx'
    );

    if (!parseResult.sheets || parseResult.sheets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid data found in Excel file',
      });
    }

    // Upload to Vercel Blob
    const blobUrl = await BlobStorageService.uploadBOQFile(
      req.user.userId,
      file.originalFilename || 'uploaded.xlsx',
      buffer
    );

    // Get matching method from form data
    const matchingMethod = fields.matchingMethod?.[0] || 'LOCAL';
    const clientId = fields.clientId?.[0];
    const projectId = fields.projectId?.[0];
    const projectName = fields.projectName?.[0];

    // Create job in Convex
    const jobId = await convex.mutation(api.aiMatchingJobs.createJob, {
      userId: req.user.userId,
      fileName: file.originalFilename || 'uploaded.xlsx',
      itemCount: parseResult.totalItems,
      matchingMethod: matchingMethod as any,
      clientId,
      projectId,
      projectName,
      originalFileUrl: blobUrl,
    });

    // Process items into batches
    const BATCH_SIZE = 10;
    let processedCount = 0;

    for (const sheet of parseResult.sheets) {
      for (let i = 0; i < sheet.items.length; i += BATCH_SIZE) {
        const batch = sheet.items.slice(i, i + BATCH_SIZE);
        
        // Store batch in Convex for processing
        await convex.mutation(api.aiMatchingJobs.addBatch, {
          jobId,
          items: batch.map((item, index) => ({
            batchIndex: processedCount + index,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            contextHeaders: item.contextHeaders,
            rowNumber: item.rowNumber,
            sheetName: item.sheetName,
          })),
        });
        
        processedCount += batch.length;
      }
    }

    // Start job processing
    await convex.mutation(api.aiMatchingJobs.startProcessing, { jobId });

    // Clean up temp file
    await fs.unlink(file.filepath);

    return res.status(200).json({
      success: true,
      data: {
        jobId,
        fileName: file.originalFilename,
        itemCount: parseResult.totalItems,
        sheets: parseResult.sheets.map(s => ({
          name: s.sheetName,
          itemCount: s.items.length,
        })),
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process file',
    });
  }
}

export default requireAuth(uploadHandler);