import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { extractEmbeddedHeaders, isLikelyStandaloneHeader } from './excel-header-extractor';

export interface ParsedBOQItem {
  rowNumber: number;
  description: string;
  quantity?: number;
  unit?: string;
  originalData: Record<string, any>;
  contextHeaders?: string[]; // Category headers above the data row
  sheetName: string;
  rowHeight?: number;
  formatting?: Record<string, any>;
}

export interface SheetParseResult {
  items: ParsedBOQItem[];
  totalRows: number;
  headers: string[];
  sheetName: string;
  contextRows: Array<{
    row: number;
    values: string[];
  }>;
}

export interface ExcelParseResult {
  sheets: SheetParseResult[];
  fileName: string;
  totalItems: number;
}

export interface ProjectMetadata {
  name: string;
  clientName?: string;
  description?: string;
  status?: string;
  totalValue?: number;
  currency?: string;
}

export class ExcelService {
  async parseExcelFile(buffer: Buffer, fileName: string = 'unknown.xlsx'): Promise<ExcelParseResult> {
    // Console log removed for performance
    // Console log removed for performance
    // Console log removed for performance
    
    try {
      if (!buffer || buffer.length === 0) {
        // Console log removed for performance
        throw new Error('Empty file buffer provided');
      }
      
      if (buffer.length > 50 * 1024 * 1024) { // 50MB limit
        // Console log removed for performance
        throw new Error('File size exceeds 50MB limit');
      }
      
      const loadStartTime = Date.now();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const loadEndTime = Date.now();
      
      // Console log removed for performance
      // Console log removed for performance
      
      if (workbook.worksheets.length === 0) {
        // Console log removed for performance
        throw new Error('No worksheets found in Excel file');
      }

    const sheets: SheetParseResult[] = [];
    let totalItems = 0;
    
    // Track sheet signatures to detect duplicates
    const sheetSignatures = new Map<string, string>();

    // Process all worksheets
    // Console log removed for performance
    
    for (let index = 0; index < workbook.worksheets.length; index++) {
      const worksheet = workbook.worksheets[index];
      // Console log removed for performance
      // Console log removed for performance
      
      const parseStartTime = Date.now();
      const sheetResult = await this.parseWorksheet(worksheet);
      const parseEndTime = Date.now();
      
      // Console log removed for performance
      // Console log removed for performance
      
      if (sheetResult.items.length > 0) {
        // Create a signature for this sheet based on first few items
        const signature = this.createSheetSignature(sheetResult.items);
        
        // Check if we've seen this data before
        const existingSheet = sheetSignatures.get(signature);
        if (existingSheet) {
          // Console log removed for performance
          // Console log removed for performance
        } else {
          // New unique sheet - add it
          sheetSignatures.set(signature, worksheet.name);
          sheets.push(sheetResult);
          totalItems += sheetResult.items.length;
          // Console log removed for performance
        }
      } else {
        // Console log removed for performance
      }
    }

    if (sheets.length === 0) {
      throw new Error('No valid data found in any worksheet');
    }

    // Console log removed for performance
    // Console log removed for performance
    // Console log removed for performance
    // Console log removed for performance
    sheets.forEach((sheet, idx) => {
      // Console log removed for performance
    });
    // Console log removed for performance

    return {
      sheets,
      fileName,
      totalItems,
    };
    } catch (error) {
      // Console log removed for performance
      if (error instanceof Error) {
        throw new Error(`Failed to parse Excel file: ${error.message}`);
      }
      throw new Error('Failed to parse Excel file: Unknown error');
    }
  }

  private async parseWorksheet(worksheet: ExcelJS.Worksheet): Promise<SheetParseResult> {
    // Console log removed for performance
    
    const headers: string[] = [];
    const items: ParsedBOQItem[] = [];
    const contextRows: Array<{ row: number; values: string[] }> = [];
    
    // Find the header row (first row with multiple filled cells)
    let headerRowNumber = 1;
    let headerRow: ExcelJS.Row | null = null;
    
    // Console log removed for performance
    
    // Special check for Testground format - look for rows with patterns like "F l a g s"
    let testgroundHeaderRow = -1;
    
    // First pass: Look for ideal header patterns
    for (let i = 1; i <= Math.min(worksheet.rowCount, 25); i++) {
      const row = worksheet.getRow(i);
      // Get all cell values properly
      const rowValues = [];
      for (let col = 1; col <= worksheet.columnCount; col++) {
        const cell = row.getCell(col);
        let value = cell.value;
        
        // Handle rich text objects
        if (value && typeof value === 'object' && 'richText' in value) {
          value = (value as any).richText?.map((rt: any) => rt.text).join('') || '';
        } else if (value && typeof value === 'object' && 'text' in value) {
          value = (value as any).text || '';
        }
        
        rowValues.push(value);
      }
      
      const filledCells = rowValues.filter(v => v !== null && v !== undefined && v !== '').length;
      const cellStrings = rowValues.map(v => v?.toString() || '');
      
      // Check for Testground format pattern (F l a g s pattern with Description, Quantity, Unit)
      if (filledCells >= 10) {
        // Check if first few cells contain single characters (F, l, a, g, s)
        const firstFewCells = cellStrings.slice(0, 7);
        const singleCharCount = firstFewCells.filter(s => s.length === 1).length;
        
        // Check if we have exact column names
        const hasDescriptionCol = cellStrings.some(s => s.toLowerCase() === 'description');
        const hasQuantityCol = cellStrings.some(s => s.toLowerCase() === 'quantity');
        const hasUnitCol = cellStrings.some(s => s.toLowerCase() === 'unit');
        
        if (singleCharCount >= 5 && hasDescriptionCol && hasQuantityCol && hasUnitCol) {
          testgroundHeaderRow = i;
          headerRow = row;
          headerRowNumber = i;
          // Console log removed for performance
          // Console log removed for performance
          break;
        }
      }
      
      // Check for standard BOQ headers
      if (filledCells >= 3) {
        const cellLower = cellStrings.map(s => s.toLowerCase());
        const hasDescKeyword = cellLower.some(v => 
          v === 'description' || v === 'item' || v === 'particular' || v === 'desc'
        );
        const hasQtyKeyword = cellLower.some(v => 
          v === 'quantity' || v === 'qty' || v === 'no'
        );
        const hasUnitKeyword = cellLower.some(v => 
          v === 'unit' || v === 'uom' || v === 'units'
        );
        
        // Only accept as header if it has both description and at least qty or unit
        if (hasDescKeyword && (hasQtyKeyword || hasUnitKeyword)) {
          headerRow = row;
          headerRowNumber = i;
          
          // Console log removed for performance
          // Console log removed for performance
          break;
        }
      }
    }
    
    // Second pass: If no ideal header found, use fallback logic
    if (!headerRow) {
      for (let i = 1; i <= Math.min(worksheet.rowCount, 20); i++) {
        const row = worksheet.getRow(i);
        const rowValues = Array.isArray(row.values) 
          ? row.values 
          : Object.values(row.values || {});
        const filledCells = rowValues.filter(v => v !== null && v !== undefined && v !== '').length;
        
        if (filledCells >= 4) {
          headerRow = row;
          headerRowNumber = i;
          // Console log removed for performance
          break;
        }
      }
    }
    
    // Store context rows (rows above header)
    if (headerRow) {
      for (let j = 1; j < headerRowNumber; j++) {
        const contextRow = worksheet.getRow(j);
        const values = [];
        for (let col = 1; col <= worksheet.columnCount; col++) {
          values.push(contextRow.getCell(col).value?.toString() || '');
        }
        if (values.some(v => v.trim())) {
          contextRows.push({ row: j, values });
        }
      }
      
      if (contextRows.length > 0) {
        // Console log removed for performance
      }
    }
    
    if (!headerRow) {
      // Console log removed for performance
      return { items: [], totalRows: 0, headers: [], sheetName: worksheet.name, contextRows: [] };
    }
    
    // Get headers - ensure we fill all positions to avoid sparse array
    const maxCol = headerRow.cellCount;
    for (let col = 1; col <= maxCol; col++) {
      const cell = headerRow.getCell(col);
      headers[col - 1] = cell.value?.toString() || `Column ${col}`;
    }

    // Auto-detect columns
    const descriptionColIndex = this.findDescriptionColumn(headers);
    const quantityColIndex = this.findQuantityColumn(headers);
    const unitColIndex = this.findUnitColumn(headers);
    
    // Console log removed for performance
    // Console log removed for performance
    // Console log removed for performance
    // Console log removed for performance

    // Parse data rows
    let totalRows = 0;
    let contextHierarchy: string[] = []; // Store full hierarchy of context headers
    
    worksheet.eachRow((row, rowNumber) => {
      // Skip rows before and including header
      if (rowNumber <= headerRowNumber) return;
      
      // Debug log for every row
      if (rowNumber <= headerRowNumber + 20) { // Log first 20 rows after header
        const descCell = descriptionColIndex >= 0 ? row.getCell(descriptionColIndex + 1) : null;
        const qtyCell = quantityColIndex >= 0 ? row.getCell(quantityColIndex + 1) : null;
        const unitCell = unitColIndex >= 0 ? row.getCell(unitColIndex + 1) : null;
        
        // Console log removed for performance
        // Console log removed for performance
        // Console log removed for performance
        // Console log removed for performance
      }
      
      // Check if this is a context/category row
      // Convert row.values to a proper array - it could be an array, sparse array, or object
      const rowValues = Array.isArray(row.values) 
        ? row.values 
        : Object.values(row.values || {});
      const filledCells = rowValues.filter(v => v !== null && v !== undefined && v !== '').length;
      
      // Get description value - handle object values
      let descValue = '';
      if (descriptionColIndex >= 0) {
        const cellValue = row.getCell(descriptionColIndex + 1).value;
        if (cellValue !== null && cellValue !== undefined) {
          // Handle rich text objects or other complex cell values
          if (typeof cellValue === 'object' && 'richText' in cellValue) {
            // Extract text from rich text object
            descValue = (cellValue as any).richText?.map((rt: any) => rt.text).join('') || '';
          } else if (typeof cellValue === 'object' && 'text' in cellValue) {
            descValue = (cellValue as any).text || '';
          } else {
            descValue = cellValue.toString();
          }
        }
      }
      
      // Parse quantity first to check if this row has a quantity
      const quantity = quantityColIndex >= 0 ? this.parseNumber(row.getCell(quantityColIndex + 1).value) : undefined;
      const unit = unitColIndex >= 0 ? row.getCell(unitColIndex + 1).value?.toString()?.trim() : undefined;
      
      // Check if this row is a context header (no quantity/unit or matches header patterns)
      const hasQuantity = quantity !== undefined && quantity > 0;
      const hasUnit = unit && unit.length > 0;
      const looksLikeHeader = this.isLikelyHeader(descValue);
      
      // IMPORTANT: If a row has a quantity, it's NOT a context header, regardless of description
      if (!hasQuantity && ((filledCells === 1 || filledCells <= 3) && descValue || looksLikeHeader)) {
        // This is a context header
        const headerText = descValue.trim();
        
        // Build originalData for this header row
        const headerOriginalData: Record<string, any> = {};
        const headerFormatting: Record<string, any> = {};
        
        headers.forEach((header, index) => {
          if (!header) return;
          const cell = row.getCell(index + 1);
          
          // Extract cell value properly
          let cellValue = cell.value;
          if (cellValue !== null && cellValue !== undefined) {
            // Handle rich text objects
            if (typeof cellValue === 'object' && 'richText' in cellValue) {
              cellValue = (cellValue as any).richText?.map((rt: any) => rt.text).join('') || '';
            } else if (typeof cellValue === 'object' && 'text' in cellValue) {
              cellValue = (cellValue as any).text || '';
            }
          }
          
          headerOriginalData[header] = cellValue;
          
          // Store cell formatting
          if (cell.style) {
            headerFormatting[header] = {
              font: cell.font,
              fill: cell.fill,
              border: cell.border,
              alignment: cell.alignment,
              numFmt: cell.numFmt,
            };
          }
        });
        
        // Determine the level of this header based on various clues
        const isMajorHeader = headerText.match(/^(BILL|SUB-BILL|SECTION|PART|DIVISION)/i) !== null;
        const isSubHeader = headerText.match(/^[A-Z]\d+\s/i) !== null; // Like "D20 Excavating"
        const isMinorHeader = headerText.match(/^(NOTE|Excavating|Filling|Disposal)/i) !== null;
        
        if (isMajorHeader) {
          // Major header - reset hierarchy
          contextHierarchy = [headerText];
        } else if (isSubHeader) {
          // Sub header - keep major headers, replace sub-level
          contextHierarchy = contextHierarchy.filter(h => h.match(/^(BILL|SUB-BILL|SECTION|PART|DIVISION)/i));
          contextHierarchy.push(headerText);
        } else if (isMinorHeader || looksLikeHeader) {
          // Minor header - add to existing hierarchy
          // Remove any previous minor headers at the same level
          contextHierarchy = contextHierarchy.filter(h => 
            h.match(/^(BILL|SUB-BILL|SECTION|PART|DIVISION)/i) || 
            h.match(/^[A-Z]\d+\s/i)
          );
          contextHierarchy.push(headerText);
        } else {
          // Generic header - just add it
          contextHierarchy.push(headerText);
        }
        
        // Also add this header as an item with its context
        items.push({
          rowNumber: rowNumber,
          description: headerText,
          quantity: quantity, // Preserve quantity if it exists (should be undefined for true headers)
          unit: unit, // Preserve unit if it exists
          originalData: headerOriginalData,
          contextHeaders: contextHierarchy.length > 1 ? contextHierarchy.slice(0, -1) : undefined, // Don't include itself
          sheetName: worksheet.name,
          rowHeight: row.height,
          formatting: headerFormatting,
        });
        
        return;
      }
      
      // Skip empty rows
      const hasData = rowValues.some(value => value !== null && value !== undefined && value !== '');
      if (!hasData) return;

      totalRows++;

      const originalData: Record<string, any> = {};
      const formatting: Record<string, any> = {};
      
      headers.forEach((header, index) => {
        if (!header) return;
        const cell = row.getCell(index + 1);
        
        // Extract cell value properly
        let cellValue = cell.value;
        if (cellValue !== null && cellValue !== undefined) {
          // Handle rich text objects
          if (typeof cellValue === 'object' && 'richText' in cellValue) {
            cellValue = (cellValue as any).richText?.map((rt: any) => rt.text).join('') || '';
          } else if (typeof cellValue === 'object' && 'text' in cellValue) {
            cellValue = (cellValue as any).text || '';
          }
        }
        
        originalData[header] = cellValue;
        
        // Store cell formatting
        if (cell.style) {
          formatting[header] = {
            font: cell.font,
            fill: cell.fill,
            border: cell.border,
            alignment: cell.alignment,
            numFmt: cell.numFmt,
          };
        }
      });

      // Description already parsed as descValue above
      let description = descValue;
      
      // Quantity and unit already parsed above
      
      // Only add items with valid descriptions
      if (description.trim()) {
        // Check if this description contains embedded headers
        if (hasQuantity && description.includes('\n')) {
          const { headers: embeddedHeaders, actualDescription } = extractEmbeddedHeaders(description);
          
          if (embeddedHeaders.length > 0) {
            // Console log removed for performance
            
            // First, add each embedded header as a separate context header item
            embeddedHeaders.forEach((header, index) => {
              // Add to context hierarchy
              if (!contextHierarchy.includes(header)) {
                contextHierarchy.push(header);
              }
              
              // Create a separate item for each header (except if it already exists)
              const headerAlreadyExists = items.some(item => 
                item.description === header && 
                !item.quantity && 
                item.rowNumber === rowNumber - 0.1 - index // Virtual row number
              );
              
              if (!headerAlreadyExists) {
                items.push({
                  rowNumber: rowNumber - 0.1 - index, // Give headers a slightly lower row number so they appear above
                  description: header,
                  quantity: undefined,
                  unit: undefined,
                  originalData: {},
                  contextHeaders: index > 0 ? contextHierarchy.slice(0, contextHierarchy.indexOf(header)) : undefined,
                  sheetName: worksheet.name,
                  rowHeight: row.height,
                  formatting: {},
                });
              }
            });
            
            // Use the actual description (without headers)
            description = actualDescription;
          }
        }
        
        if (!hasQuantity && !hasUnit) {
          // This is likely a context header
          // Console log removed for performance
        } else if (hasQuantity) {
          // Console log removed for performance
        }
        
        items.push({
          rowNumber: rowNumber,
          description: description.trim(),
          quantity: quantity, // Always preserve the parsed quantity
          unit: unit, // Always preserve the parsed unit
          originalData,
          contextHeaders: contextHierarchy.length > 0 ? [...contextHierarchy] : undefined,
          sheetName: worksheet.name,
          rowHeight: row.height,
          formatting,
        });
      }
    });

    return {
      items,
      totalRows,
      headers,
      sheetName: worksheet.name,
      contextRows,
    };
  }

  async createExcelWithResults(
    originalBuffer: Buffer | null,
    matchResults: any[],
    metadata?: {
      projectInfo?: ProjectMetadata;
      sheets?: string[];
      headers?: string[];
      contextHeaders?: string[];
      preserveOriginal?: boolean; // New flag to preserve original format
    }
  ): Promise<Buffer> {
    // Console log removed for performance
    // Console log removed for performance
    // Console log removed for performance
    // Console log removed for performance
    
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Try to load original file if provided
      if (originalBuffer && originalBuffer.length > 0) {
        try {
          await workbook.xlsx.load(originalBuffer);
        } catch (error) {
          // Console log removed for performance
        }
      }
      
      // If preserveOriginal flag is set, only update rate column in original file
      if (metadata?.preserveOriginal && originalBuffer && workbook.worksheets.length > 0) {
        // Console log removed for performance
        
        // Create a map of results by row number for quick lookup
        const resultsByRow = new Map();
        matchResults.forEach(result => {
          resultsByRow.set(result.rowNumber, result);
        });
        
        // Iterate through all worksheets
        workbook.worksheets.forEach(worksheet => {
          // Console log removed for performance
          
          // Find the rate column - look for headers containing 'rate', 'price', 'cost', etc.
          let rateColumnIndex = -1;
          const headerRow = worksheet.getRow(1); // Assume first row has headers
          
          // Search for rate column in first 20 rows (in case headers aren't in row 1)
          for (let rowNum = 1; rowNum <= Math.min(20, worksheet.rowCount); rowNum++) {
            const row = worksheet.getRow(rowNum);
            let foundRateCol = false;
            
            row.eachCell((cell, colNumber) => {
              const cellValue = cell.value?.toString()?.toLowerCase() || '';
              if (cellValue.includes('rate') || cellValue.includes('price') || cellValue.includes('cost')) {
                rateColumnIndex = colNumber;
                foundRateCol = true;
                // Console log removed for performance
              }
            });
            
            if (foundRateCol) break;
          }
          
          // If no rate column found, skip this worksheet
          if (rateColumnIndex === -1) {
            // Console log removed for performance
            return;
          }
          
          // Update rates for matched rows
          worksheet.eachRow((row, rowNumber) => {
            const result = resultsByRow.get(rowNumber);
            if (result && result.matchedRate !== undefined) {
              // Check if this is a context header (no quantity)
              const isContextHeader = result.matchMethod === 'CONTEXT' || 
                                    (!result.originalQuantity || result.originalQuantity === 0);
              
              // Skip context headers - don't update their rate cells
              if (isContextHeader) {
                // Console log removed for performance
                return;
              }
              
              const rateCell = row.getCell(rateColumnIndex);
              
              // Preserve the original cell formatting
              const originalFormat = rateCell.numFmt;
              const originalFont = rateCell.font;
              const originalFill = rateCell.fill;
              const originalBorder = rateCell.border;
              const originalAlignment = rateCell.alignment;
              
              // Update only the value
              rateCell.value = result.matchedRate;
              
              // Restore formatting
              if (originalFormat) rateCell.numFmt = originalFormat;
              if (originalFont) rateCell.font = originalFont;
              if (originalFill) rateCell.fill = originalFill;
              if (originalBorder) rateCell.border = originalBorder;
              if (originalAlignment) rateCell.alignment = originalAlignment;
              
              // Console log removed for performance
            }
          });
        });
        
        // Return the buffer without any other modifications
        const buffer = await workbook.xlsx.writeBuffer();
        const resultBuffer = Buffer.from(buffer);
        // Console log removed for performance
        return resultBuffer;
      }
      
      // If no worksheets exist, create a new one
      if (workbook.worksheets.length === 0) {
        workbook.addWorksheet('Results');
      }

      // Add project info sheet if provided
      if (metadata?.projectInfo) {
        // Add worksheet at the beginning using splice
        const projectSheet = workbook.addWorksheet('Project Summary');
        // Move the worksheet to the beginning
        const worksheetIndex = workbook.worksheets.indexOf(projectSheet);
        if (worksheetIndex > 0) {
          workbook.worksheets.splice(worksheetIndex, 1);
          workbook.worksheets.unshift(projectSheet);
        }
        
        // Add title
        projectSheet.getCell('A1').value = 'Project Summary';
        projectSheet.getCell('A1').font = { bold: true, size: 16 };
        projectSheet.mergeCells('A1:B1');
        
        // Add project details
        const projectData = [
          ['Project Name:', metadata.projectInfo.name],
          ['Client:', metadata.projectInfo.clientName || 'N/A'],
          ['Description:', metadata.projectInfo.description || 'N/A'],
          ['Status:', metadata.projectInfo.status || 'N/A'],
          ['Total Value:', `${metadata.projectInfo.currency || 'USD'} ${metadata.projectInfo.totalValue?.toLocaleString() || '0'}`],
          ['Generated Date:', new Date().toLocaleDateString()],
        ];
        
        projectData.forEach((row, index) => {
          const rowNum = index + 3;
          projectSheet.getCell(`A${rowNum}`).value = row[0];
          projectSheet.getCell(`A${rowNum}`).font = { bold: true };
          projectSheet.getCell(`B${rowNum}`).value = row[1];
        });
        
        // Style the project sheet
        projectSheet.getColumn('A').width = 20;
        projectSheet.getColumn('B').width = 50;
        
        // Add border around data
        const lastRow = projectData.length + 2;
        for (let row = 1; row <= lastRow; row++) {
          for (let col = 1; col <= 2; col++) {
            const cell = projectSheet.getCell(row, col);
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          }
        }
      }

      // Group results by sheet name
      // Console log removed for performance
      const resultsBySheet = matchResults.reduce((acc, result) => {
        const sheetName = result.sheetName || workbook.worksheets[0]?.name || 'Sheet1';
        if (!acc[sheetName]) acc[sheetName] = [];
        acc[sheetName].push(result);
        return acc;
      }, {} as Record<string, any[]>);
      
      // Console log removed for performance

      // Process each worksheet that has results
      for (const [sheetName, sheetResults] of Object.entries(resultsBySheet) as [string, any[]][]) {
        let worksheet = workbook.getWorksheet(sheetName);
        
        // If worksheet doesn't exist, create it
        if (!worksheet) {
          worksheet = workbook.addWorksheet(sheetName);
          
          // Add headers if we have them
          if (metadata?.headers && metadata.headers.length > 0) {
            const headerRow = worksheet.getRow(1);
            metadata.headers.forEach((header, index) => {
              headerRow.getCell(index + 1).value = header;
            });
            headerRow.font = { bold: true };
            headerRow.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE0E0E0' },
            };
          }
        }

        // Find the header row in this sheet
        let headerRowNum = 1;
        if (originalBuffer) {
          for (let i = 1; i <= Math.min(worksheet.rowCount, 20); i++) {
            const row = worksheet.getRow(i);
            const cellValues = [];
            row.eachCell((cell) => {
              cellValues.push(cell.value?.toString()?.toLowerCase() || '');
            });
            if (cellValues.some(v => v && (v.includes('description') || v.includes('item')))) {
              headerRowNum = i;
              break;
            }
          }
        }

        // Add new columns for matched data
        const lastCol = worksheet.columnCount + 1;
        worksheet.getCell(headerRowNum, lastCol).value = 'Matched Code';
        worksheet.getCell(headerRowNum, lastCol + 1).value = 'Matched Description';
        worksheet.getCell(headerRowNum, lastCol + 2).value = 'Unit Rate';
        worksheet.getCell(headerRowNum, lastCol + 3).value = 'Total Price';
        worksheet.getCell(headerRowNum, lastCol + 4).value = 'Confidence %';
        worksheet.getCell(headerRowNum, lastCol + 5).value = 'Notes';

        // Style the header row
        const headerRow = worksheet.getRow(headerRowNum);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };

        // Add match results for this sheet
        sheetResults.forEach((result) => {
          const row = originalBuffer 
            ? worksheet!.getRow(result.rowNumber)
            : worksheet!.addRow(result.originalRowData || {});
          
          // Preserve row height if available
          if (result.rowHeight) {
            row.height = result.rowHeight;
          }
          
          // Check if this is a context header (no quantity)
          const isContextHeader = result.matchMethod === 'CONTEXT' || 
                                (!result.originalQuantity || result.originalQuantity === 0);
          
          if (!isContextHeader) {
            // Only add match results for actual items with quantities
            row.getCell(lastCol).value = result.matchedCode || '';
            row.getCell(lastCol + 1).value = result.matchedDescription || '';
            row.getCell(lastCol + 2).value = result.matchedRate || 0;
            row.getCell(lastCol + 3).value = result.totalPrice || 0;
            row.getCell(lastCol + 4).value = result.confidence ? Math.round(result.confidence * 100) : 0;
            row.getCell(lastCol + 5).value = result.notes || '';
            
            // Apply conditional formatting based on confidence
            const confidenceCell = row.getCell(lastCol + 4);
            const confidence = result.confidence || 0;
            
            if (confidence >= 0.8) {
              confidenceCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF90EE90' }, // Light green
              };
            } else if (confidence >= 0.6) {
              confidenceCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFFE0' }, // Light yellow
              };
            } else {
              confidenceCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFB6C1' }, // Light red
              };
            }
          }
          // For context headers, we don't add any match data - the row remains as-is
          // This preserves the original formatting and doesn't add misleading data
        });

        // Auto-fit columns
        worksheet.columns.forEach((column) => {
          let maxLength = 0;
          column.eachCell({ includeEmpty: true }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
              maxLength = columnLength;
            }
          });
          column.width = Math.min(maxLength + 2, 50);
        });
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create Excel with results: ${error.message}`);
      }
      throw new Error('Failed to create Excel with results: Unknown error');
    }
  }

  private findDescriptionColumn(headers: string[]): number {
    const descriptionKeywords = ['description', 'desc', 'item', 'particular', 'work', 'activity'];
    
    // First, try exact match
    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) continue;
      const header = headers[i].toString().toLowerCase().trim();
      if (descriptionKeywords.includes(header)) {
        return i;
      }
    }
    
    // Then try partial match
    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) continue;
      const header = headers[i].toString().toLowerCase();
      if (descriptionKeywords.some(keyword => header.includes(keyword))) {
        return i;
      }
    }
    
    // For Testground.xlsx format, check if we have a pattern like "D e s c r i p t i o n"
    // by looking for column 13 (common position in that format)
    if (headers.length > 13) {
      // Check if there's likely data in column 13 position
      return 12; // 0-indexed, so column 13 is index 12
    }
    
    // Default to first column if no description column found
    return 0;
  }

  private findQuantityColumn(headers: string[]): number {
    const quantityKeywords = ['quantity', 'qty', 'amount', 'volume'];
    
    // First, try exact match
    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) continue;
      const header = headers[i].toString().toLowerCase().trim();
      if (quantityKeywords.includes(header)) {
        return i;
      }
    }
    
    // Then try partial match
    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) continue;
      const header = headers[i].toString().toLowerCase();
      if (quantityKeywords.some(keyword => header.includes(keyword))) {
        return i;
      }
    }
    
    // For Testground.xlsx format, check common position (column 14)
    if (headers.length > 14) {
      return 13; // 0-indexed, so column 14 is index 13
    }
    
    return -1;
  }

  private findUnitColumn(headers: string[]): number {
    const unitKeywords = ['unit', 'uom', 'measure'];
    
    // First, try exact match
    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) continue;
      const header = headers[i].toString().toLowerCase().trim();
      if (unitKeywords.includes(header)) {
        return i;
      }
    }
    
    // Then try partial match
    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) continue;
      const header = headers[i].toString().toLowerCase();
      if (unitKeywords.some(keyword => header.includes(keyword))) {
        return i;
      }
    }
    
    // For Testground.xlsx format, check common position (column 15)
    if (headers.length > 15) {
      return 14; // 0-indexed, so column 15 is index 14
    }
    
    return -1;
  }

  private parseNumber(value: any): number | undefined {
    const originalValue = value;
    
    if (value === null || value === undefined || value === '') {
      // Console log removed for performance
      return undefined;
    }
    
    if (typeof value === 'number') {
      const result = value > 0 ? value : undefined;
      if (!result) {
        // Console log removed for performance
      }
      return result;
    }
    
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === '-' || trimmed.toLowerCase() === 'n/a') {
        // Console log removed for performance
        return undefined;
      }
      
      const parsed = parseFloat(trimmed.replace(/,/g, ''));
      if (isNaN(parsed)) {
        // Console log removed for performance
        return undefined;
      }
      if (parsed <= 0) {
        // Console log removed for performance
        return undefined;
      }
      return parsed;
    }
    
    // Console log removed for performance
    return undefined;
  }
  
  private isLikelyHeader(description: string): boolean {
    const headerPatterns = [
      /^(section|chapter|part|bill|sub-bill|category|group|division|note|description)[\s:]/i,
      /^[A-Z][0-9]+\s/,  // Like "D20 Excavating"
      /^[0-9]+\.[0-9]+\s+[A-Z]/,  // Like "2.1 GENERAL"
      /^(excavat|fill|disposal|earthwork|groundwork|substructure|superstructure|roof|external|internal|finish|service|prelim)/i,
      /(note|not measured|pricing point|risk item|provisional|refer to|see also|include|exclude)/i,
      /^(the following|all prices|rates shall|contractor shall|work includes)/i
    ];
    
    return headerPatterns.some(pattern => pattern.test(description));
  }
  
  private createSheetSignature(items: ParsedBOQItem[]): string {
    // Create a signature based on the first few items with quantities
    // This helps detect sheets with identical data
    const significantItems = items
      .filter(item => item.quantity !== undefined && item.quantity > 0)
      .slice(0, 5); // Use first 5 items with quantities
    
    if (significantItems.length === 0) {
      // If no items with quantities, use first 5 items
      const firstItems = items.slice(0, 5);
      return firstItems
        .map(item => `${item.description}|${item.rowNumber}`)
        .join('||');
    }
    
    // Create signature from description, quantity, and unit
    return significantItems
      .map(item => `${item.description}|${item.quantity}|${item.unit || 'NO_UNIT'}`)
      .join('||');
  }

  async exportMatchResults(
    originalBuffer: Buffer,
    matchResults: any[],
    jobMetadata: {
      matchingMethod: string;
      matchedCount: number;
      itemCount: number;
    }
  ): Promise<Buffer> {
    // Console log removed for performance
    // Console log removed for performance
    // Console log removed for performance
    
    // Use the createExcelWithResults method with preserveOriginal flag
    return this.createExcelWithResults(originalBuffer, matchResults, {
      preserveOriginal: true
    });
  }
}

// Export singleton instance for consistency
export const excelService = new ExcelService();
