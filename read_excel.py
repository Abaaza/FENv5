import csv
import sys

def read_excel_as_text(file_path):
    try:
        # Try to read the file as binary first to check its format
        with open(file_path, 'rb') as f:
            # Read first few bytes to identify file type
            header = f.read(8)
            if header[:4] == b'\x50\x4b\x03\x04':  # ZIP format (xlsx)
                print("This is an XLSX file. We need openpyxl to read it properly.")
                print("However, I'll try to extract readable text from it...")
                
                # Reset to beginning
                f.seek(0)
                content = f.read()
                
                # Try to find readable text patterns
                readable_parts = []
                current_text = b""
                
                for byte in content:
                    if 32 <= byte <= 126:  # Printable ASCII
                        current_text += bytes([byte])
                    else:
                        if len(current_text) > 3:  # Only keep strings longer than 3 chars
                            try:
                                decoded = current_text.decode('utf-8', errors='ignore')
                                if decoded.strip():
                                    readable_parts.append(decoded)
                            except:
                                pass
                        current_text = b""
                
                # Print found text
                print("\nExtracted text from Excel file:")
                for i, text in enumerate(readable_parts[:100]):  # First 100 readable parts
                    if any(keyword in text.upper() for keyword in ['BILL', 'STRUCTURE', 'PILING', 'EXCAVAT', 'NOTE', 'GROUND']):
                        print(f"{i}: {text}")
                
    except Exception as e:
        print(f"Error reading file: {e}")

if __name__ == "__main__":
    file_path = "/mnt/c/Users/abaza/Downloads/TESTFILE.xlsx"
    read_excel_as_text(file_path)