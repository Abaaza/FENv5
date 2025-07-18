import { ConvexHttpClient } from 'convex/browser';
import dotenv from 'dotenv';

dotenv.config();

// Force use of production URL where API keys are stored
const convexUrl = process.env.CONVEX_URL || 'https://lovely-armadillo-372.convex.cloud';

// Create standard Convex client
const convexClient = new ConvexHttpClient(convexUrl);
console.log('[Convex] Using URL:', convexUrl);

// Export both as default and named export for compatibility
export default convexClient;
export const getConvexClient = () => convexClient;

