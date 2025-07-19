import pandas as pd
import os

def analyze_excel_structure():
    """Analyze the structure of Excel files to understand the data format"""
    
    # File paths
    file1 = r"C:\Users\abaza\Downloads\Fencing (1) (1).xlsx"
    file2 = r"C:\Users\abaza\Downloads\Fencing Pricing Document. (1).xlsx"
    
    try:
        # Read first Excel file
        print(f"=== Analyzing {os.path.basename(file1)} ===")
        xl1 = pd.ExcelFile(file1)
        
        for sheet_name in xl1.sheet_names:
            print(f"\nSheet: {sheet_name}")
            df = pd.read_excel(file1, sheet_name=sheet_name)
            print(f"Shape: {df.shape}")
            print(f"Columns: {list(df.columns)}")
            
            # Skip first few rows if they look like headers
            # Look for rows with actual data
            data_start = 0
            for i in range(min(10, len(df))):
                row = df.iloc[i]
                # Check if this row has numeric data in Rate column
                if 'Rate' in df.columns and pd.notna(row.get('Rate', None)):
                    try:
                        float(row['Rate'])
                        data_start = i
                        break
                    except:
                        pass
            
            if data_start > 0:
                print(f"\nData starts at row {data_start}")
            
            # Show actual data rows
            print("\nSample data rows:")
            for i in range(data_start, min(data_start + 5, len(df))):
                row = df.iloc[i]
                if pd.notna(row).any():  # Skip completely empty rows
                    print(f"Row {i}: {dict(row.dropna())}")
        
        # Read second Excel file
        print(f"\n\n=== Analyzing {os.path.basename(file2)} ===")
        xl2 = pd.ExcelFile(file2)
        
        for sheet_name in xl2.sheet_names:
            print(f"\nSheet: {sheet_name}")
            
            # Try reading with no header first to see raw data
            df_raw = pd.read_excel(file2, sheet_name=sheet_name, header=None)
            print(f"Raw shape: {df_raw.shape}")
            print("\nFirst 10 rows (raw):")
            print(df_raw.head(10))
            
            # Look for the actual header row
            header_row = None
            for i in range(min(20, len(df_raw))):
                row = df_raw.iloc[i]
                row_str = ' '.join(str(val) for val in row if pd.notna(val))
                # Common header keywords
                if any(keyword in row_str.lower() for keyword in ['description', 'item', 'code', 'rate', 'price', 'unit']):
                    header_row = i
                    print(f"\nFound potential header at row {i}: {list(row.dropna())}")
                    break
            
            if header_row is not None:
                # Read with proper header
                df = pd.read_excel(file2, sheet_name=sheet_name, header=header_row)
                print(f"\nColumns after setting header: {list(df.columns)}")
                print("\nSample data:")
                print(df.head())
                
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    analyze_excel_structure()