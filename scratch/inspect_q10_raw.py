def main():
    path = r"C:\Users\DELL\Downloads\US_Dateset_V01\Abdominal Ultrasound Training Module for Sonography Students - no image annotations - probe matching real images.doc"
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()
    
    idx = html.find('Q10. Probe-Application Match')
    if idx != -1:
        sub = html[idx:idx+1000]
        print(repr(sub))

if __name__ == '__main__':
    main()
