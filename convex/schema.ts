import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: v.union(v.literal("user"), v.literal("admin")),
    isApproved: v.boolean(),
    isActive: v.optional(v.boolean()),
    createdAt: v.number(),
    lastLogin: v.optional(v.number()),
    refreshToken: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_refresh_token", ["refreshToken"]),

  applicationSettings: defineTable({
    key: v.string(),
    value: v.string(),
    description: v.optional(v.string()),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("by_key", ["key"]),

  priceItems: defineTable({
    id: v.string(),
    code: v.optional(v.string()),
    ref: v.optional(v.string()),
    description: v.string(),
    keywords: v.optional(v.array(v.string())),
    // Construction-specific fields
    material_type: v.optional(v.string()),
    material_grade: v.optional(v.string()),
    material_size: v.optional(v.string()),
    material_finish: v.optional(v.string()),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    work_type: v.optional(v.string()),
    brand: v.optional(v.string()),
    unit: v.optional(v.string()),
    rate: v.number(),
    labor_rate: v.optional(v.number()),
    material_rate: v.optional(v.number()),
    wastage_percentage: v.optional(v.number()),
    // Supplier info
    supplier: v.optional(v.string()),
    location: v.optional(v.string()),
    availability: v.optional(v.string()),
    remark: v.optional(v.string()),
    // Legacy fields (keeping for compatibility)
    subCategoryCode: v.optional(v.string()),
    subCategoryName: v.optional(v.string()),
    sub_category: v.optional(v.string()),
    type: v.optional(v.string()),
    vendor: v.optional(v.string()),
    // Embedding fields
    embedding: v.optional(v.array(v.number())),
    embeddingProvider: v.optional(v.union(v.literal("cohere"), v.literal("openai"))),
    // Metadata
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_item_id", ["id"])
    .index("by_code", ["code"])
    .index("by_category", ["category"])
    .index("by_subcategory", ["subcategory"])
    .index("by_active", ["isActive"])
    .searchIndex("search_price_items", {
      searchField: "description",
      filterFields: ["category", "subcategory", "isActive"]
    }),

  aiMatchingJobs: defineTable({
    userId: v.id("users"),
    clientId: v.optional(v.id("clients")),
    projectId: v.optional(v.id("projects")),
    projectName: v.optional(v.string()),
    fileName: v.string(),
    fileUrl: v.string(),
    originalFileId: v.optional(v.string()), // ID for retrieving original Excel from fileStorage
    status: v.union(
      v.literal("pending"),
      v.literal("parsing"),
      v.literal("matching"),
      v.literal("completed"),
      v.literal("failed")
    ),
    progress: v.number(),
    progressMessage: v.optional(v.string()),
    itemCount: v.number(),
    matchedCount: v.number(),
    matchingMethod: v.union(
      v.literal("LOCAL"),
      v.literal("COHERE"),
      v.literal("OPENAI"),
      v.literal("V1"),
      v.literal("V2")
    ),
    totalValue: v.optional(v.number()),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    resultFileUrl: v.optional(v.string()),
    headers: v.optional(v.array(v.string())),
    sheetName: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_client", ["clientId"])
    .index("by_project", ["projectId"]),

  matchResults: defineTable({
    jobId: v.id("aiMatchingJobs"),
    rowNumber: v.number(),
    originalDescription: v.string(),
    originalQuantity: v.optional(v.number()),
    originalUnit: v.optional(v.string()),
    originalRowData: v.optional(v.any()),
    contextHeaders: v.optional(v.array(v.string())),
    matchedItemId: v.optional(v.id("priceItems")),
    matchedDescription: v.optional(v.string()),
    matchedCode: v.optional(v.string()),
    matchedUnit: v.optional(v.string()),
    matchedRate: v.optional(v.number()),
    confidence: v.number(),
    matchMethod: v.string(),
    isManuallyEdited: v.optional(v.boolean()),
    totalPrice: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_job", ["jobId"])
    .index("by_row", ["jobId", "rowNumber"]),

  clients: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_name", ["name"])
    .index("by_active", ["isActive"]),

  projects: defineTable({
    name: v.string(),
    clientId: v.id("clients"),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    totalValue: v.optional(v.number()),
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_client", ["clientId"])
    .index("by_status", ["status"]),

  activityLogs: defineTable({
    userId: v.id("users"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    details: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_entity", ["entityType", "entityId"]),

  importJobs: defineTable({
    userId: v.id("users"),
    type: v.string(),
    fileName: v.string(),
    totalItems: v.number(),
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    progress: v.number(),
    progressMessage: v.optional(v.string()),
    results: v.optional(v.object({
      created: v.number(),
      updated: v.number(),
      skipped: v.number(),
      errors: v.array(v.string()),
    })),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  jobLogs: defineTable({
    jobId: v.string(),
    level: v.union(v.literal("info"), v.literal("error"), v.literal("warning")),
    message: v.string(),
    timestamp: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_job_timestamp", ["jobId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),
});