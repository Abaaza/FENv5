# Convex Setup Instructions for The Fencing People

To set up Convex for this project, you need to:

1. **Login to Convex**:
   ```bash
   npx convex login
   ```

2. **Initialize the project**:
   ```bash
   npx convex init
   ```
   - When prompted, choose "Create a new project"
   - Project name: "The Fencing People BOQ Matcher" or similar
   - This will create a new Convex project and update your configuration

3. **Deploy the schema**:
   ```bash
   npx convex deploy
   ```

4. **Create an admin user**:
   After deployment, run:
   ```bash
   cd backend
   npx tsx scripts/create-abaza-admin.ts
   ```

5. **Update environment variables**:
   The new Convex URL should be automatically set, but verify it matches:
   - Backend `.env`: `CONVEX_URL=https://lovely-armadillo-372.convex.cloud`
   - Frontend `.env.production`: `VITE_CONVEX_URL=https://lovely-armadillo-372.convex.cloud`

## Important Notes:
- The Convex URL `https://lovely-armadillo-372.convex.cloud` should be used throughout the project
- Make sure to update any deployment scripts with the new URL
- The database schema is already defined in the `convex/` directory