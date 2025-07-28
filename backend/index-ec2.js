// Add fetch polyfill for Node 16
require("cross-fetch/polyfill");

// Add Blob polyfill for OpenAI SDK
if (!global.Blob) {
  const { Blob } = require('buffer');
  global.Blob = Blob;
}

// Add FormData polyfill for OpenAI SDK
if (!global.FormData) {
  const { FormData } = require('formdata-node');
  global.FormData = FormData;
}

// Set required environment variables with proper lengths
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "tfp-boq-matching-access-secret-key-2025-secure";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "tfp-boq-matching-refresh-secret-key-2025-secure";
process.env.CONVEX_URL = process.env.CONVEX_URL || "https://bright-scorpion-424.convex.cloud";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "https://main.d12fkb4dvnmn3s.amplifyapp.com";
process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.PORT = process.env.PORT || "5000";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "https://main.d12fkb4dvnmn3s.amplifyapp.com";
process.env.COOKIE_SECURE = process.env.COOKIE_SECURE || "true";
process.env.JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "16h";
process.env.JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "30d";

const { app } = require("./dist/server");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] API available at http://localhost:${PORT}/api`);
  console.log(`[${new Date().toISOString()}] CORS enabled for: ${process.env.CORS_ORIGIN}`);
  console.log(`[${new Date().toISOString()}] Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\nSIGINT signal received: closing HTTP server");
  process.exit(0);
});