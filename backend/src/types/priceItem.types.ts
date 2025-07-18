export interface PriceItem {
  _id: string;
  id: string;
  code?: string;
  ref?: string;
  description: string;
  keywords?: string[];
  // Construction-specific fields
  material_type?: string;
  material_grade?: string;
  material_size?: string;
  material_finish?: string;
  category?: string;
  subcategory?: string;
  work_type?: string;
  brand?: string;
  unit?: string;
  rate: number;
  labor_rate?: number;
  material_rate?: number;
  wastage_percentage?: number;
  // Supplier info
  supplier?: string;
  location?: string;
  availability?: string;
  remark?: string;
  // Legacy fields
  subCategoryCode?: string;
  subCategoryName?: string;
  sub_category?: string;
  type?: string;
  vendor?: string;
  // Embedding fields
  embedding?: number[];
  embeddingProvider?: 'V2' | 'V1';
  // Metadata
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

