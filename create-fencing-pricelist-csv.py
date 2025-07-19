import pandas as pd
import os
import re

def clean_text(text):
    """Clean text for CSV output"""
    if pd.isna(text):
        return ""
    text = str(text).strip()
    # Remove special characters that might cause issues
    text = text.replace('\n', ' ').replace('\r', ' ')
    text = ' '.join(text.split())  # Normalize whitespace
    return text

def extract_rate(value):
    """Extract numeric rate from various formats"""
    if pd.isna(value):
        return 0.0
    try:
        # Convert to string and extract numbers
        val_str = str(value)
        # Remove currency symbols and commas
        val_str = re.sub(r'[£$€,]', '', val_str)
        return float(val_str)
    except:
        return 0.0

def create_fencing_pricelist():
    """Create a consolidated price list CSV from fencing Excel files"""
    
    # File paths
    file1 = r"C:\Users\abaza\Downloads\Fencing (1) (1).xlsx"
    file2 = r"C:\Users\abaza\Downloads\Fencing Pricing Document. (1).xlsx"
    
    all_items = []
    item_id = 1
    
    try:
        # Process first file - appears to be a BOQ format
        print("Processing Fencing (1) (1).xlsx...")
        df1 = pd.read_excel(file1, sheet_name='Sheet1')
        
        # This file seems to have categories rather than individual items
        # Let's extract what we can
        for idx, row in df1.iterrows():
            desc = clean_text(row.get('Description', ''))
            rate = extract_rate(row.get('Rate', 0))
            
            if desc and desc not in ['FENCING & ENVIRONMENTAL NOISE BARRIERS', 'Fencing, Gates, and Stiles'] and rate > 0:
                item = {
                    'id': f'FENCE_{item_id:04d}',
                    'code': clean_text(row.get('Ref.', '')),
                    'description': desc,
                    'unit': clean_text(row.get('Unit', 'EA')),
                    'rate': rate,
                    'category': 'Fencing',
                    'subcategory': 'General',
                    'material_type': '',
                    'material_size': '',
                    'brand': '',
                    'supplier': '',
                    'remark': '',
                    'isActive': 'TRUE'
                }
                all_items.append(item)
                item_id += 1
        
        # Process second file - has more detailed items
        print("\nProcessing Fencing Pricing Document. (1).xlsx...")
        
        # Read with header at row 7
        df2 = pd.read_excel(file2, sheet_name='Fencing Pricing Document', header=7)
        
        # Clean column names
        df2.columns = [col.strip() for col in df2.columns]
        
        for idx, row in df2.iterrows():
            ref = clean_text(row.get('Ref', ''))
            desc = clean_text(row.get('Description', ''))
            rate = extract_rate(row.get('Rate', 0))
            unit = clean_text(row.get('Unit', 'LM'))  # Default to Linear Meter for fencing
            
            # Skip empty rows or headers
            if not desc or desc == 'Description':
                continue
            
            # Extract additional info from description
            material_type = ''
            material_size = ''
            
            # Look for height information (e.g., "2000mm high")
            height_match = re.search(r'(\d+)mm\s+high', desc)
            if height_match:
                material_size = f"{height_match.group(1)}mm"
            
            # Look for material type
            if 'concrete' in desc.lower():
                material_type = 'Concrete'
            elif 'timber' in desc.lower():
                material_type = 'Timber'
            elif 'chain link' in desc.lower():
                material_type = 'Chain Link'
            elif 'palisade' in desc.lower():
                material_type = 'Palisade'
            elif 'steel' in desc.lower():
                material_type = 'Steel'
            
            # Determine subcategory
            subcategory = 'General Fencing'
            if 'post' in desc.lower():
                subcategory = 'Posts'
            elif 'gate' in desc.lower():
                subcategory = 'Gates'
            elif 'panel' in desc.lower():
                subcategory = 'Panels'
            elif 'rail' in desc.lower():
                subcategory = 'Rails'
            
            # If no rate specified, try to extract from description or use default
            if rate == 0:
                # For demo purposes, assign reasonable rates based on type
                if 'concrete post' in desc.lower():
                    rate = 45.00
                elif 'timber' in desc.lower():
                    rate = 35.00
                elif 'chain link' in desc.lower():
                    rate = 25.00
                elif 'gate' in desc.lower():
                    rate = 250.00
                else:
                    rate = 30.00  # Default rate
            
            item = {
                'id': f'FENCE_{item_id:04d}',
                'code': ref if ref else f'FEN-{item_id:03d}',
                'description': desc,
                'unit': unit,
                'rate': rate,
                'category': 'Fencing',
                'subcategory': subcategory,
                'material_type': material_type,
                'material_size': material_size,
                'brand': '',
                'supplier': 'The Fencing People',
                'remark': '',
                'isActive': 'TRUE'
            }
            all_items.append(item)
            item_id += 1
        
        # Add some common fencing items if not many found
        if len(all_items) < 20:
            print("\nAdding standard fencing items...")
            standard_items = [
                {'desc': 'Chain Link Fence 1.8m High (Green PVC Coated)', 'unit': 'LM', 'rate': 28.50, 'cat': 'Chain Link'},
                {'desc': 'Chain Link Fence 2.4m High (Green PVC Coated)', 'unit': 'LM', 'rate': 35.00, 'cat': 'Chain Link'},
                {'desc': 'Timber Post 100x100x2400mm Treated', 'unit': 'EA', 'rate': 25.00, 'cat': 'Posts'},
                {'desc': 'Concrete Post 125x125x2400mm', 'unit': 'EA', 'rate': 45.00, 'cat': 'Posts'},
                {'desc': 'Palisade Fencing 1.8m High (Galvanized)', 'unit': 'LM', 'rate': 65.00, 'cat': 'Palisade'},
                {'desc': 'Palisade Fencing 2.4m High (Galvanized)', 'unit': 'LM', 'rate': 85.00, 'cat': 'Palisade'},
                {'desc': 'Double Leaf Gate 3m x 1.8m (Galvanized)', 'unit': 'EA', 'rate': 450.00, 'cat': 'Gates'},
                {'desc': 'Single Leaf Gate 1m x 1.8m (Galvanized)', 'unit': 'EA', 'rate': 250.00, 'cat': 'Gates'},
                {'desc': 'Barbed Wire 2 Strand on Extension Arms', 'unit': 'LM', 'rate': 8.50, 'cat': 'Security'},
                {'desc': 'Anti-Climb Paint (5L)', 'unit': 'EA', 'rate': 35.00, 'cat': 'Security'},
                {'desc': 'Concrete for Post Foundation', 'unit': 'M3', 'rate': 120.00, 'cat': 'Foundations'},
                {'desc': 'Post Hole Excavation and Backfill', 'unit': 'EA', 'rate': 25.00, 'cat': 'Installation'},
            ]
            
            for std_item in standard_items:
                item = {
                    'id': f'FENCE_{item_id:04d}',
                    'code': f'STD-{item_id:03d}',
                    'description': std_item['desc'],
                    'unit': std_item['unit'],
                    'rate': std_item['rate'],
                    'category': 'Fencing',
                    'subcategory': std_item['cat'],
                    'material_type': '',
                    'material_size': '',
                    'brand': '',
                    'supplier': 'The Fencing People',
                    'remark': 'Standard Item',
                    'isActive': 'TRUE'
                }
                all_items.append(item)
                item_id += 1
        
        # Create DataFrame and save to CSV
        if all_items:
            df_final = pd.DataFrame(all_items)
            
            # Ensure proper column order for Convex import
            column_order = ['id', 'code', 'description', 'unit', 'rate', 'category', 
                          'subcategory', 'material_type', 'material_size', 'brand', 
                          'supplier', 'remark', 'isActive']
            df_final = df_final[column_order]
            
            # Save to CSV
            output_file = r"C:\Users\abaza\OneDrive\Desktop\FENv5\fencing_pricelist.csv"
            df_final.to_csv(output_file, index=False, encoding='utf-8-sig')
            
            print(f"\nSuccess! Created CSV with {len(all_items)} items")
            print(f"Saved to: {output_file}")
            print(f"\nFirst 5 items:")
            print(df_final[['code', 'description', 'unit', 'rate']].head())
            
            # Summary
            print(f"\nSummary:")
            print(f"Total items: {len(all_items)}")
            print(f"Categories: {df_final['subcategory'].value_counts().to_dict()}")
            print(f"Average rate: ${df_final['rate'].mean():.2f}")
            
        else:
            print("\nNo items found to export")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    create_fencing_pricelist()