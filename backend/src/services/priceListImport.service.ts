import ExcelJS from 'exceljs';
import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';
import { toConvexId } from '../utils/convexId';
import { ConvexWrapper } from '../utils/convexWrapper';

export interface NewPriceListItem {
  id: string;
  name: string;
  product_template_variant_value_ids?: string;
  operation_cost: number;
  uom_id: string;
}

export class PriceListImportService {
  constructor() {
    // ConvexWrapper is used as a static class
  }

  async importPriceList(buffer: Buffer, userId: string): Promise<{ imported: number; errors: string[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('No worksheet found in the Excel file');
    }

    const items: NewPriceListItem[] = [];
    const errors: string[] = [];
    
    // Get headers from first row
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = cell.value?.toString() || '';
    });

    // Validate headers
    const requiredHeaders = ['id', 'name', 'operation_cost', 'uom_id'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Get column indices
    const idIndex = headers.indexOf('id');
    const nameIndex = headers.indexOf('name');
    const variantIndex = headers.indexOf('product_template_variant_value_ids');
    const costIndex = headers.indexOf('operation_cost');
    const uomIndex = headers.indexOf('uom_id');

    // Parse data rows
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      
      try {
        const id = row.getCell(idIndex + 1).value?.toString();
        const name = row.getCell(nameIndex + 1).value?.toString();
        const variant = variantIndex >= 0 ? row.getCell(variantIndex + 1).value?.toString() : undefined;
        const cost = Number(row.getCell(costIndex + 1).value);
        const uom = row.getCell(uomIndex + 1).value?.toString();

        if (!id || !name || !uom || isNaN(cost)) {
          errors.push(`Row ${rowNumber}: Missing required data`);
          continue;
        }

        items.push({
          id,
          name,
          product_template_variant_value_ids: variant,
          operation_cost: cost,
          uom_id: uom
        });
      } catch (error) {
        errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Import items to Convex
    const imported = await this.importToConvex(items, userId);
    
    return { imported, errors };
  }

  private async importToConvex(items: NewPriceListItem[], userId: string): Promise<number> {
    const convex = getConvexClient();
    const BATCH_SIZE = 5;
    let imported = 0;

    // First, mark all existing items as inactive
    await convex.mutation(api.priceItems.deactivateAll, {});

    // Import in batches
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      
      const convexItems = batch.map(item => ({
        id: item.id,
        name: item.name,
        product_template_variant_value_ids: item.product_template_variant_value_ids,
        operation_cost: item.operation_cost,
        uom_id: item.uom_id,
        // Generate description for better matching
        description: item.product_template_variant_value_ids 
          ? `${item.name} - ${item.product_template_variant_value_ids}`
          : item.name,
        // Extract category from name if possible
        category: this.extractCategory(item.name),
        // Generate keywords for search
        keywords: this.generateKeywords(item.name, item.product_template_variant_value_ids),
      }));

      await ConvexWrapper.mutation(api.priceItems.createBatch, {
        items: convexItems,
        userId: toConvexId<'users'>(userId)
      });

      imported += batch.length;
      
      // Add delay between batches
      if (i + BATCH_SIZE < items.length) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    return imported;
  }

  private extractCategory(name: string): string {
    // Simple category extraction based on common patterns
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('drill') || nameLower.includes('bit')) return 'Tools';
    if (nameLower.includes('steel') || nameLower.includes('iron')) return 'Materials';
    if (nameLower.includes('fence') || nameLower.includes('gate')) return 'Fencing';
    if (nameLower.includes('post') || nameLower.includes('pole')) return 'Posts';
    if (nameLower.includes('wire') || nameLower.includes('mesh')) return 'Wire Products';
    
    return 'General';
  }

  private generateKeywords(name: string, variant?: string): string[] {
    const keywords: string[] = [];
    
    // Split name into words
    const nameWords = name.toLowerCase().split(/\s+/);
    keywords.push(...nameWords);
    
    // Extract variant keywords
    if (variant) {
      // Extract size information
      const sizeMatch = variant.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|inch|"|')/gi);
      if (sizeMatch) {
        keywords.push(...sizeMatch.map(s => s.toLowerCase()));
      }
      
      // Extract other variant words
      const variantWords = variant.toLowerCase().split(/[:\s,]+/).filter(w => w.length > 2);
      keywords.push(...variantWords);
    }
    
    // Remove duplicates
    return [...new Set(keywords)];
  }
}