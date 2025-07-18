import { Id } from '../lib/convex-api';
import type { TableNames } from '../convex-generated/dataModel';

/**
 * Safely cast a string to a Convex ID type
 * @param id The string ID to cast
 * @returns The properly typed Convex ID
 */
export function toConvexId<TableName extends TableNames>(id: string): Id<TableName> {
  return id as Id<TableName>;
}

/**
 * Check if a value is a valid Convex ID string
 * @param value The value to check
 * @returns True if the value looks like a Convex ID
 */
export function isConvexId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
