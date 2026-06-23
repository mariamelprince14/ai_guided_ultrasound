import os
from scratch.inspect_doc import DocParser

def main():
    path = r"C:\Users\DELL\Downloads\US_Dateset_V01\Abdominal Ultrasound Training Module for Sonography Students - no image annotations - probe matching real images.doc"
    parser = DocParser()
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        parser.feed(f.read())
    
    sections = {}
    current_section = 0
    for el in parser.elements:
        if el[0] == 'h' and el[1] == 1:
            if 'Section' in el[2]:
                import re
                match = re.search(r'Section (\d+):', el[2])
                if match:
                    current_section = int(match.group(1))
                    sections[current_section] = []
        elif current_section > 0:
            sections[current_section].append(el)
            
    for sec_num in [3, 5]:
        print(f"--- Section {sec_num} ---")
        curr_q = None
        for el in sections[sec_num]:
            if el[0] == 'h' and el[1] == 2:
                if 'Answer Key' in el[2]:
                    break
                if curr_q:
                    print(f"Q{curr_q['num']}: options_count={len(curr_q['opts'])}")
                curr_q = {"num": el[2].split('.')[0], "opts": []}
            elif el[0] == 'p' and curr_q:
                import re
                if re.match(r'^[A-D]\)', el[1]):
                    curr_q["opts"].append(el[1])
        if curr_q:
            print(f"Q{curr_q['num']}: options_count={len(curr_q['opts'])}")

if __name__ == '__main__':
    main()
