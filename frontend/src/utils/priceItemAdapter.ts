// Adapter to map database fields to frontend expected fields
export function adaptPriceItem(item: any) {
  return {
    ...item,
    // Map legacy fields to expected fields
    code: item.code || item.id,
    subcategory: item.subcategory || item.product_template_variant_value_ids || '',
    unit: item.unit || item.uom_id || 'Unit',
    rate: item.rate !== undefined ? item.rate : (item.operation_cost || 0),
    
    // Keep original fields for backward compatibility
    id: item.id,
    product_template_variant_value_ids: item.product_template_variant_value_ids,
    uom_id: item.uom_id,
    operation_cost: item.operation_cost
  };
}

export function adaptPriceItems(items: any[]) {
  return items.map(adaptPriceItem);
}