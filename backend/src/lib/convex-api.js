// Re-export Convex API
// Use local copy for Lambda, parent directory for local development

if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  // Lambda environment - use local copy
  const { api } = require('../convex-generated/api');
  const { Id } = require('../convex-generated/dataModel');
  module.exports = { api, Id };
} else {
  // Local development - use parent directory
  const { api } = require('../../../convex/_generated/api');
  const { Id } = require('../../../convex/_generated/dataModel');
  module.exports = { api, Id };
}