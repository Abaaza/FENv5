import { PriceItem } from '../types/priceItem.types';

export function validatePriceItem(item: any): item is PriceItem {
  return (
    item &&
    typeof item === 'object' &&
    typeof item._id === 'string' &&
    typeof item.description === 'string' &&
    typeof item.rate === 'number' &&
    item.rate >= 0
  );
}

export function validatePriceItems(items: any[]): PriceItem[] {
  const validItems = items.filter(validatePriceItem);
  
  if (validItems.length !== items.length) {
    console.warn(`Filtered out ${items.length - validItems.length} invalid price items`);
  }
  
  return validItems;
}

export function sanitizeDescription(description: string): string {
  // Remove extra whitespace
  let sanitized = description.trim().replace(/\s+/g, ' ');
  
  // Remove special characters that might cause issues
  sanitized = sanitized.replace(/[^\w\s\-.,()\/]/g, '');
  
  // Ensure minimum length
  if (sanitized.length < 3) {
    throw new Error('Description too short for meaningful matching');
  }
  
  return sanitized;
}
