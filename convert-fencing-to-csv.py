import pandas as pd
import os
import sys

def read_excel_files():
    """Read both Excel files and combine them into a single price list CSV"""
    
    # File paths
    file1 = r"C:\Users\abaza\Downloads\Fencing (1) (1).xlsx"
    file2 = r"C:\Users\abaza\Downloads\Fencing Pricing Document. (1).xlsx"
    
    # Check if files exist
    if not os.path.exists(file1):
        print(f"Error: File not found - {file1}")
        return
    if not os.path.exists(file2):
        print(f"Error: File not found - {file2}")
        return
    
    try:
        # Read first Excel file
        print(f"Reading {os.path.basename(file1)}...")
        df1 = pd.read_excel(file1, sheet_name=None)  # Read all sheets
        
        # Read second Excel file
        print(f"Reading {os.path.basename(file2)}...")
        df2 = pd.read_excel(file2, sheet_name=None)  # Read all sheets
        
        # Print sheet names from both files
        print(f"\nSheets in {os.path.basename(file1)}: {list(df1.keys())}")
        print(f"Sheets in {os.path.basename(file2)}: {list(df2.keys())}")
        
        # Combine all data
        all_items = []
        item_id = 1
        
        # Process first file
        for sheet_name, df in df1.items():
            print(f"\nProcessing sheet '{sheet_name}' from file 1...")
            print(f"Columns: {list(df.columns)}")
            print(f"Shape: {df.shape}")
            
            # Show first few rows
            if not df.empty:
                print("\nFirst 3 rows:")
                print(df.head(3))
                
                # Try to extract price list items
                for idx, row in df.iterrows():
                    # Skip empty rows
                    if pd.isna(row).all():
                        continue
                    
                    # Create item - adjust column names based on actual data
                    item = {
                        'id': f'FENCE_{item_id:04d}',
                        'code': str(row.get('Code', row.get('Item Code', row.get('SKU', '')))),
                        'description': str(row.get('Description', row.get('Item Description', row.get('Product', '')))),
                        'unit': str(row.get('Unit', row.get('UOM', 'EA'))),
                        'rate': float(row.get('Rate', row.get('Price', row.get('Unit Price', 0)))),
                        'category': sheet_name if sheet_name != 'Sheet1' else 'Fencing',
                        'subcategory': str(row.get('Category', row.get('Type', ''))),
                        'material_type': str(row.get('Material', row.get('Material Type', ''))),
                        'material_size': str(row.get('Size', row.get('Dimensions', ''))),
                        'brand': str(row.get('Brand', row.get('Manufacturer', ''))),
                        'remark': str(row.get('Remarks', row.get('Notes', ''))),
                        'isActive': True
                    }
                    
                    # Only add if we have a description and rate
                    if item['description'] and item['description'] != 'nan' and item['rate'] > 0:
                        all_items.append(item)
                        item_id += 1
        
        # Process second file
        for sheet_name, df in df2.items():
            print(f"\nProcessing sheet '{sheet_name}' from file 2...")
            print(f"Columns: {list(df.columns)}")
            print(f"Shape: {df.shape}")
            
            # Show first few rows
            if not df.empty:
                print("\nFirst 3 rows:")
                print(df.head(3))
                
                # Try to extract price list items
                for idx, row in df.iterrows():
                    # Skip empty rows
                    if pd.isna(row).all():
                        continue
                    
                    # Create item - adjust column names based on actual data
                    item = {
                        'id': f'FENCE_{item_id:04d}',
                        'code': str(row.get('Code', row.get('Item Code', row.get('SKU', '')))),
                        'description': str(row.get('Description', row.get('Item Description', row.get('Product', '')))),
                        'unit': str(row.get('Unit', row.get('UOM', 'EA'))),
                        'rate': float(row.get('Rate', row.get('Price', row.get('Unit Price', 0)))),
                        'category': sheet_name if sheet_name != 'Sheet1' else 'Fencing',
                        'subcategory': str(row.get('Category', row.get('Type', ''))),
                        'material_type': str(row.get('Material', row.get('Material Type', ''))),
                        'material_size': str(row.get('Size', row.get('Dimensions', ''))),
                        'brand': str(row.get('Brand', row.get('Manufacturer', ''))),
                        'remark': str(row.get('Remarks', row.get('Notes', ''))),
                        'isActive': True
                    }
                    
                    # Only add if we have a description and rate
                    if item['description'] and item['description'] != 'nan' and item['rate'] > 0:
                        all_items.append(item)
                        item_id += 1
        
        # Create DataFrame from all items
        if all_items:
            result_df = pd.DataFrame(all_items)
            
            # Clean up the data
            result_df = result_df.replace('nan', '')
            result_df = result_df.replace('None', '')
            
            # Save to CSV
            output_file = r"C:\Users\abaza\OneDrive\Desktop\FENv5\fencing_pricelist.csv"
            result_df.to_csv(output_file, index=False)
            
            print(f"\n✓ Successfully created CSV with {len(all_items)} items")
            print(f"✓ Saved to: {output_file}")
            print(f"\nFirst 5 items:")
            print(result_df.head())
        else:
            print("\n✗ No valid items found in the Excel files")
            print("Please check the column names and data structure")
            
    except Exception as e:
        print(f"Error processing files: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    read_excel_files()