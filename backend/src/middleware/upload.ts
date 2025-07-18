import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Configure storage
const storage = multer.memoryStorage();

// MIME type validation for security
const ALLOWED_MIME_TYPES = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'text/csv': '.csv',
  'application/csv': '.csv',
};

// File filter with MIME type validation
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.xlsx', '.xls', '.csv']; // Added CSV support
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Check file extension
  if (!allowedExtensions.includes(ext)) {
    cb(new Error('Only Excel files (.xlsx, .xls) and CSV files (.csv) are allowed'));
    return;
  }
  
  // Validate MIME type
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv'
  ];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error('Invalid file type. Only Excel and CSV files are allowed'));
    return;
  }
  
  // Additional validation: Check file signature (magic numbers)
  // This would require reading the file buffer, which happens after upload
  // So we'll validate this in the controller after upload
  
  cb(null, true);
};

// Create multer instance with enhanced security
export const uploadExcel = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Reduced to 10MB for better DoS protection
    files: 1, // Only one file at a time
    fields: 10, // Limit number of fields
    parts: 20, // Limit number of parts
  },
}).single('file');

// CSV/Excel file filter for price list with MIME validation
const priceListFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Check file extension
  if (!allowedExtensions.includes(ext)) {
    cb(new Error('Only CSV and Excel files are allowed'));
    return;
  }
  
  // Validate MIME type
  if (!Object.keys(ALLOWED_MIME_TYPES).includes(file.mimetype)) {
    cb(new Error('Invalid file type. Only CSV and Excel files are allowed'));
    return;
  }
  
  // Verify extension matches MIME type
  const expectedExt = ALLOWED_MIME_TYPES[file.mimetype as keyof typeof ALLOWED_MIME_TYPES];
  if (expectedExt && ext !== expectedExt) {
    cb(new Error('File extension does not match file type'));
    return;
  }
  
  cb(null, true);
};

// CSV/Excel upload for price list with enhanced security
export const uploadCSV = multer({
  storage,
  fileFilter: priceListFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Reduced to 10MB for better DoS protection
    files: 1, // Only one file at a time
    fields: 10, // Limit number of fields
    parts: 20, // Limit number of parts
  },
}).single('file');

// Helper function to validate file content after upload
export function validateFileContent(buffer: Buffer, expectedType: 'excel' | 'csv'): boolean {
  if (!buffer || buffer.length === 0) {
    return false;
  }
  
  // Check magic numbers (file signatures)
  if (expectedType === 'excel') {
    // XLSX signature: 50 4B 03 04 (ZIP format)
    const xlsxSignature = buffer.slice(0, 4).toString('hex');
    if (xlsxSignature === '504b0304') {
      return true;
    }
    
    // XLS signature: D0 CF 11 E0 A1 B1 1A E1
    const xlsSignature = buffer.slice(0, 8).toString('hex');
    if (xlsSignature === 'd0cf11e0a1b11ae1') {
      return true;
    }
    
    return false;
  }
  
  if (expectedType === 'csv') {
    // CSV files are text, so check if it's valid UTF-8 text
    try {
      const text = buffer.toString('utf8');
      // Basic CSV validation - should contain commas or semicolons
      return text.includes(',') || text.includes(';');
    } catch {
      return false;
    }
  }
  
  return false;
}

// Sanitize filename to prevent path traversal
export function sanitizeFilename(filename: string): string {
  // Remove any directory components
  const basename = path.basename(filename);
  // Replace any remaining suspicious characters
  return basename.replace(/[^a-zA-Z0-9._-]/g, '_');
}
