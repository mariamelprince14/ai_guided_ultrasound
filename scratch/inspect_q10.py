import re

def main():
    path = r"C:\Users\DELL\Downloads\US_Dateset_V01\Abdominal Ultrasound Training Module for Sonography Students - no image annotations - probe matching real images.doc"
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()
    
    idx = html.find('Q10. Probe-Application Match')
    if idx != -1:
        sub = html[idx:idx+15000]
        # Replace all src="..." content with src="DATA_URL"
        clean_sub = re.sub(r'src="[^"]+"', 'src="DATA_URL"', sub)
        # Also handle src='...' content
        clean_sub = re.sub(r"src='[^']+'", 'src="DATA_URL"', clean_sub)
        print(clean_sub[:2000])

if __name__ == '__main__':
    main()
