const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/server.js',
  external: [
    'express',
    'cors',
    'dotenv',
    'winston',
    'express-rate-limit',
    'convex',
    'xlsx',
    'bcrypt',
    'jsonwebtoken',
    'cohere-ai',
    'openai',
    '@aws-sdk/*',
    'exceljs',
    'multer',
    'natural',
    'fuse.js'
  ],
  sourcemap: true,
  minify: false
}).then(() => {
  console.log('Build completed with esbuild');
}).catch(() => {
  console.error('Build failed');
  process.exit(1);
});
