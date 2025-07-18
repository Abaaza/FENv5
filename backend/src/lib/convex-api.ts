// Re-export Convex API
// Use local copy for Lambda, parent directory for local development

// For Lambda, we need to use the local copy
export { api } from '../convex-generated/api';
export type { Id, TableNames } from '../convex-generated/dataModel';