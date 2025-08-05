import { Request, Response } from 'express';
import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as XLSX from 'xlsx';
import path from 'path';
import { Id } from '../lib/convex-api';
import { toConvexId } from '../utils/convexId';
import { logActivity } from '../utils/activityLogger';

const convex = getConvexClient();

export async function getPriceListStats(req: Request, res: Response): Promise<void> {
  try {
    const items = await convex.query(api.priceItems.getAll);
    
    // Extract unique categories
    const categories = [...new Set(items.map(item => item.category).filter(Boolean))];
    
    // Extract unique subcategories grouped by category
    const categorySubcategories: Record<string, string[]> = {};
    items.forEach(item => {
      if (item.category && item.subcategory) {
        if (!categorySubcategories[item.category]) {
          categorySubcategories[item.category] = [];
        }
        if (!categorySubcategories[item.category].includes(item.subcategory)) {
          categorySubcategories[item.category].push(item.subcategory);
        }
      }
    });
    
    // Sort subcategories within each category
    Object.keys(categorySubcategories).forEach(category => {
      categorySubcategories[category].sort();
    });
    
    // Count incomplete items (missing category, subcategory, rate, unit, or description)
    const incompleteItems = items.filter(item => {
      return !item.category || 
             !item.subcategory || 
             !item.rate || 
             item.rate === 0 ||
             !item.unit || 
             !item.description;
    });
    
    res.json({
      totalItems: items.length,
      categories: categories.sort(),
      categorySubcategories,
      incompleteCount: incompleteItems.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get price list stats error:', error);
    res.status(500).json({ error: 'Failed to get price list stats' });
  }
}

export async function getAllPriceItems(req: Request, res: Response): Promise<void> {
  try {
    const { active } = req.query;
    
    const items = active === 'true' 
      ? await convex.query(api.priceItems.getActive)
      : await convex.query(api.priceItems.getAll);
    
    // Adapt items to ensure frontend gets the expected field names
    const adaptedItems = items.map((item: any) => ({
      ...item,
      // Map legacy fields to expected fields
      code: item.code || item.id,
      subcategory: item.subcategory || item.product_template_variant_value_ids || '',
      unit: item.unit || item.uom_id || 'Unit',
      rate: item.rate !== undefined ? item.rate : (item.operation_cost || 0),
      
      // Keep original fields for backward compatibility
      id: item.id,
      product_template_variant_value_ids: item.product_template_variant_value_ids,
      uom_id: item.uom_id,
      operation_cost: item.operation_cost
    }));
    
    res.json(adaptedItems);
  } catch (error) {
    console.error('Get price items error:', error);
    res.status(500).json({ error: 'Failed to get price items' });
  }
}

export async function createPriceItem(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const itemData = {
      ...req.body,
      id: req.body.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: toConvexId<'users'>(req.user.id),
    };

    const itemId = await convex.mutation(api.priceItems.create, itemData);

    // Create activity log
    await convex.mutation(api.activityLogs.create, {
      userId: toConvexId<'users'>(req.user.id),
      action: 'created_price_item',
      entityType: 'priceItems',
      entityId: itemId,
      details: `Created price item: ${itemData.description || itemData.id}`,
    });

    res.status(201).json({ id: itemId });
  } catch (error) {
    console.error('Create price item error:', error);
    res.status(500).json({ error: 'Failed to create price item' });
  }
}

export async function updatePriceItem(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    
    await convex.mutation(api.priceItems.update, {
      _id: toConvexId<'priceItems'>(id),
      ...req.body,
    });

    // Create activity log
    await convex.mutation(api.activityLogs.create, {
      userId: toConvexId<'users'>(req.user.id),
      action: 'updated_price_item',
      entityType: 'priceItems',
      entityId: id,
      details: `Updated price item: ${req.body.description || id}`,
    });

    res.json({ message: 'Price item updated successfully' });
  } catch (error) {
    console.error('Update price item error:', error);
    res.status(500).json({ error: 'Failed to update price item' });
  }
}

export async function importCSV(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let records: any[] = [];
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === '.csv') {
      // Handle CSV file
      const csvContent = req.file.buffer.toString('utf-8');
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true, // Allow variable column counts
        skip_records_with_error: true, // Skip problematic records
        on_record: (record: any) => {
          // Clean up record by removing array notation from field names
          const cleanRecord: any = {};
          for (const [key, value] of Object.entries(record)) {
            // Remove array notation like "keywords[0]" -> just use the value
            if (key.includes('[') && key.includes(']')) {
              const baseKey = key.substring(0, key.indexOf('['));
              if (!cleanRecord[baseKey]) {
                cleanRecord[baseKey] = [];
              }
              if (value && value !== '') {
                cleanRecord[baseKey].push(value);
              }
            } else {
              cleanRecord[key] = value;
            }
          }
          
          // Convert arrays to comma-separated strings for keywords
          if (cleanRecord.keywords && Array.isArray(cleanRecord.keywords)) {
            cleanRecord.keywords = cleanRecord.keywords.filter((k: string) => k && k.trim()).join(',');
          }
          
          return cleanRecord;
        },
      });
    } else if (ext === '.xlsx' || ext === '.xls') {
      // Handle Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      records = XLSX.utils.sheet_to_json(worksheet);
    } else {
      res.status(400).json({ error: 'Unsupported file format' });
      return;
    }

    const items = records.map((record: any) => {
      // Parse keywords if they exist as comma-separated string
      let keywords: string[] | undefined;
      if (record.keywords) {
        keywords = record.keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k);
      }

      return {
        id: record._id || record.id || record.ID || record.Id || `${Date.now()}-${Math.random()}`,
        code: record.Code || record.code || record.CODE,
        description: record.Description || record.description || record.DESCRIPTION,
        keywords,
        // Construction-specific fields
        material_type: record.material_type || record.Material_Type || record.type || record.Type,
        material_grade: record.material_grade || record.Material_Grade || record.grade || record.Grade,
        material_size: record.material_size || record.Material_Size || record.size || record.Size,
        material_finish: record.material_finish || record.Material_Finish || record.finish || record.Finish,
        category: record.Category || record.category || record.CATEGORY,
        subcategory: record.SubCategory || record.subcategory || record.Subcategory || record.sub_category || record.Sub_Category,
        work_type: record.work_type || record.Work_Type || record.operation || record.Operation,
        brand: record.brand || record.Brand || record.vendor || record.Vendor,
        unit: record.Unit || record.unit || record.UNIT || 'pcs',
        rate: parseFloat(record.Rate || record.rate || record.RATE || record.price || record.Price || '0'),
        labor_rate: parseFloat(record.labor_rate || record.Labor_Rate || record.labour_rate || record.Labour_Rate || '0'),
        material_rate: parseFloat(record.material_rate || record.Material_Rate || '0'),
        wastage_percentage: parseFloat(record.wastage_percentage || record.Wastage_Percentage || record.wastage || record.Wastage || '0'),
        // Supplier info
        supplier: record.supplier || record.Supplier || record.vendor || record.Vendor,
        location: record.location || record.Location,
        availability: record.availability || record.Availability || 'in_stock',
        // Additional fields from old schema (for compatibility)
        ref: record.Ref || record.ref || record.REF,
        remark: record.remark || record.Remark || record.REMARK,
      };
    }).filter(item => item.id && item.description);

    if (items.length === 0) {
      res.status(400).json({ error: 'No valid items found in file' });
      return;
    }

    // Create import job
    const jobId = await convex.mutation(api.importJobs.create, {
      userId: toConvexId<'users'>(req.user.id),
      type: 'price_list',
      totalItems: items.length,
      fileName: req.file.originalname,
    });

    // Start the import process asynchronously
    processImportAsync(jobId, items, req.user.id, req.file.originalname);

    res.json({
      message: 'Import started',
      jobId,
      totalItems: items.length,
    });
  } catch (error) {
    console.error('Import CSV error:', error);
    res.status(500).json({ error: 'Failed to import file: ' + error.message });
  }
}

export async function exportCSV(req: Request, res: Response): Promise<void> {
  try {
    const items = await convex.query(api.priceItems.getAll);
    
    const csvData = items.map(item => ({
      _id: item._id,
      code: item.code || '',
      ref: item.ref || '',
      description: item.description,
      category: item.category || '',
      subcategory: item.subcategory || '',
      unit: item.unit || '',
      rate: item.rate,
      keywords: item.keywords?.join(',') || '',
      remark: item.remark || '',
    }));

    const csv = stringify(csvData, {
      header: true,
      columns: [
        '_id', 'code', 'ref', 'description', 'category', 
        'subcategory', 'unit', 'rate', 'keywords', 'remark'
      ],
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="price_list.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
}

export async function deactivatePriceItem(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    
    await convex.mutation(api.priceItems.deleteItem, { id: toConvexId<'priceItems'>(id) });
    
    // Create activity log
    await convex.mutation(api.activityLogs.create, {
      userId: toConvexId<'users'>(req.user.id),
      action: 'deleted_price_item',
      entityType: 'priceItems',
      entityId: id,
      details: `Deleted price item`,
    });
    
    res.json({ message: 'Price item deleted successfully' });
  } catch (error) {
    console.error('Delete price item error:', error);
    res.status(500).json({ error: 'Failed to delete price item' });
  }
}

export async function searchPriceItems(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { query, limit = 20 } = req.body;
    
    if (!query || query.trim().length < 2) {
      res.status(400).json({ error: 'Search query must be at least 2 characters' });
      return;
    }

    // Get all price items and perform search
    const allItems = await convex.query(api.priceItems.getActive);
    
    if (!allItems || allItems.length === 0) {
      res.json([]);
      return;
    }
    
    // Search in description, code, category, etc.
    const searchTerm = query.toLowerCase();
    const scoredItems = allItems.map((item: any) => {
      let score = 0;
      const description = (item.description || '').toLowerCase();
      const code = (item.code || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      
      // Exact matches get highest score
      if (description === searchTerm || code === searchTerm) {
        score = 100;
      }
      // Starts with gets high score
      else if (description.startsWith(searchTerm) || code.startsWith(searchTerm)) {
        score = 80;
      }
      // Word boundary matches
      else if (description.includes(' ' + searchTerm) || description.includes(searchTerm + ' ')) {
        score = 60;
      }
      // Contains match
      else if (description.includes(searchTerm) || code.includes(searchTerm)) {
        score = 40;
      }
      // Category match
      else if (category.includes(searchTerm)) {
        score = 30;
      }
      // Check other fields
      else {
        const otherFields = [
          item.subcategory,
          item.material_type,
          item.brand,
          item.supplier,
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (otherFields.includes(searchTerm)) {
          score = 20;
        }
      }
      
      return { item, score };
    });

    // Filter out non-matches and sort by score
    const matches = scoredItems
      .filter(({ score }: any) => score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }: any) => item);

    res.json(matches);
  } catch (error) {
    console.error('Search price items error:', error);
    res.status(500).json({ error: 'Failed to search price items' });
  }
}

export async function deleteAllPriceItems(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get total count first
    const items = await convex.query(api.priceItems.getAll);
    const totalItems = items.length;

    if (totalItems === 0) {
      res.json({ message: 'No items to delete', deletedCount: 0 });
      return;
    }

    // Create a delete job
    const jobId = await convex.mutation(api.importJobs.create, {
      userId: toConvexId<'users'>(req.user.id),
      type: 'delete_all',
      totalItems,
      fileName: 'Delete All Price Items',
    });

    // Start the delete process asynchronously
    processDeleteAllAsync(jobId, items, req.user.id);

    res.json({
      message: 'Delete process started',
      jobId,
      totalItems,
    });
  } catch (error) {
    console.error('Delete all price items error:', error);
    res.status(500).json({ error: 'Failed to delete all price items' });
  }
}

// Async function to process delete all with progress updates
async function processDeleteAllAsync(
  jobId: Id<"importJobs">,
  items: any[],
  userId: string
): Promise<void> {
  try {
    // Update status to processing
    await convex.mutation(api.importJobs.updateStatus, {
      jobId,
      status: 'processing',
      progress: 0,
    });

    let deletedCount = 0;
    const errors: string[] = [];
    const batchSize = 20; // Smaller batch size to avoid rate limits

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Delete items in parallel within batch
      const deletePromises = batch.map(async (item) => {
        try {
          await convex.mutation(api.priceItems.deleteItem, { id: item._id });
          return { success: true };
        } catch (err: any) {
          console.error(`Failed to delete item ${item._id}:`, err);
          return { success: false, error: `Item ${item._id}: ${err.message}` };
        }
      });

      const results = await Promise.all(deletePromises);
      
      // Count successes and collect errors
      results.forEach(result => {
        if (result.success) {
          deletedCount++;
        } else if (result.error) {
          errors.push(result.error);
        }
      });

      // Update progress
      const progress = Math.floor(((i + batch.length) / items.length) * 100);
      await convex.mutation(api.importJobs.updateProgress, {
        jobId,
        progress,
        message: `Deleted ${deletedCount} of ${items.length} items`,
      });
      
      // Add a small delay between batches to avoid rate limits
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
      }
    }

    // Update final status
    await convex.mutation(api.importJobs.updateStatus, {
      jobId,
      status: 'completed',
      progress: 100,
      results: {
        created: 0,
        updated: 0,
        skipped: 0,
        errors,
      },
    });

    // Create activity log
    await convex.mutation(api.activityLogs.create, {
      userId: toConvexId<'users'>(userId),
      action: 'deleted_all_price_items',
      entityType: 'priceItems',
      details: `Deleted ${deletedCount} of ${items.length} price items`,
    });

    console.log(`Delete all completed for job ${jobId}: Deleted ${deletedCount} of ${items.length} items`);
  } catch (error: any) {
    console.error('Delete all process error:', error);
    await convex.mutation(api.importJobs.updateStatus, {
      jobId,
      status: 'failed',
      error: error.message,
    });
  }
}

// Async function to process import with progress updates
async function processImportAsync(
  jobId: Id<"importJobs">,
  items: any[],
  userId: string,
  fileName: string
): Promise<void> {
  try {
    // Update status to processing
    await convex.mutation(api.importJobs.updateStatus, {
      jobId,
      status: 'processing',
      progress: 0,
    });

    const batchSize = 25; // Reduced batch size to avoid Convex rate limits
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process items in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      try {
        // Process items individually since bulkImport doesn't exist
        for (const item of batch) {
          try {
            await convex.mutation(api.priceItems.create, {
              ...item,
              userId: toConvexId<'users'>(userId),
            });
            results.created++;
          } catch (err: any) {
            if (err.message?.includes('duplicate')) {
              results.skipped++;
            } else {
              results.errors.push(`Item ${item.id}: ${err.message}`);
            }
          }
        }

        // Update progress
        const progress = Math.floor(((i + batch.length) / items.length) * 100);
        await convex.mutation(api.importJobs.updateProgress, {
          jobId,
          progress,
          message: `Processed ${i + batch.length} of ${items.length} items (Created: ${results.created}, Updated: ${results.updated}, Skipped: ${results.skipped})`,
        });
      } catch (error: any) {
        console.error(`Error processing batch ${i / batchSize + 1}:`, error);
        results.errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
      }
      
      // Add a small delay between batches to avoid rate limits
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
    }

    // Update final status
    await convex.mutation(api.importJobs.updateStatus, {
      jobId,
      status: 'completed',
      progress: 100,
      results,
    });

    // Create activity log
    await convex.mutation(api.activityLogs.create, {
      userId: toConvexId<'users'>(userId),
      action: 'imported_price_list',
      entityType: 'priceItems',
      details: `Imported from ${fileName}: Created ${results.created}, Updated ${results.updated}, Skipped ${results.skipped}`,
    });

    console.log(`Import completed for job ${jobId}: Created ${results.created}, Updated ${results.updated}, Skipped ${results.skipped}`);
  } catch (error: any) {
    console.error('Import process error:', error);
    await convex.mutation(api.importJobs.updateStatus, {
      jobId,
      status: 'failed',
      error: error.message,
    });
  }
}

export async function getImportStatus(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    
    const job = await convex.query(api.importJobs.getById, { 
      jobId: toConvexId<'importJobs'>(jobId) 
    });
    
    if (!job) {
      res.status(404).json({ error: 'Import job not found' });
      return;
    }

    res.json(job);
  } catch (error) {
    console.error('Get import status error:', error);
    res.status(500).json({ error: 'Failed to get import status' });
  }
}
