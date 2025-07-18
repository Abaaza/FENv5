import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applicationSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

export const getByKeys = query({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, args) => {
    const settings = await Promise.all(
      args.keys.map(key =>
        ctx.db
          .query("applicationSettings")
          .withIndex("by_key", (q) => q.eq("key", key))
          .first()
      )
    );
    return settings.filter(s => s !== null);
  },
});

export const upsert = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    description: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("applicationSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        description: args.description,
        updatedAt: Date.now(),
        updatedBy: args.userId,
      });
    } else {
      await ctx.db.insert("applicationSettings", {
        key: args.key,
        value: args.value,
        description: args.description,
        updatedAt: Date.now(),
        updatedBy: args.userId,
      });
    }
  },
});

export const getAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("applicationSettings").collect();
  },
});

export const getCurrencySettings = query({
  handler: async (ctx) => {
    const currencySetting = await ctx.db
      .query("applicationSettings")
      .withIndex("by_key", (q) => q.eq("key", "CURRENCY"))
      .first();
    
    // Default to GBP (British Pound) if not set
    return {
      currency: currencySetting?.value || "GBP",
      symbol: getCurrencySymbol(currencySetting?.value || "GBP")
    };
  },
});

// Helper function to get currency symbol
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    GBP: "£",
    USD: "$",
    EUR: "€",
    JPY: "¥",
    CNY: "¥",
    INR: "₹",
    AUD: "A$",
    CAD: "C$",
    CHF: "CHF",
    HKD: "HK$",
    SGD: "S$",
    SEK: "kr",
    NOK: "kr",
    NZD: "NZ$",
    MXN: "$",
    ZAR: "R",
    BRL: "R$",
    RUB: "₽",
    KRW: "₩",
    TRY: "₺",
    AED: "د.إ",
    SAR: "﷼",
    PLN: "zł",
    THB: "฿",
    MYR: "RM",
    PHP: "₱",
    CZK: "Kč",
    HUF: "Ft",
    RON: "lei",
    DKK: "kr",
    ILS: "₪",
    CLP: "$",
    ARS: "$",
    COP: "$",
    PEN: "S/",
    UYU: "$",
    VND: "₫",
    UAH: "₴",
    GHS: "₵",
    KES: "KSh",
    NGN: "₦",
    EGP: "£",
    MAD: "د.م.",
    QAR: "﷼",
    KWD: "د.ك",
    BHD: "د.ب",
    OMR: "﷼"
  };
  
  return symbols[currency] || currency;
}