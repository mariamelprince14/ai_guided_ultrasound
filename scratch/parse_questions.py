import os
import re
import json
import base64
from html.parser import HTMLParser

class DocParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current_tag = None
        self.in_h = False
        self.h_level = 0
        self.text_content = []
        self.elements = [] # ordered list of elements: ('h', level, text), ('p', text), ('fig', src, caption)
        self.current_fig = {}
        self.in_figcaption = False
        self.caption_text = []

    def handle_starttag(self, tag, attrs):
        self.current_tag = tag
        attrs_dict = dict(attrs)
        if tag in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            self.in_h = True
            self.h_level = int(tag[1])
            self.text_content = []
        elif tag == 'p':
            self.text_content = []
        elif tag == 'figure':
            self.current_fig = {}
        elif tag == 'img':
            if self.current_fig is not None:
                self.current_fig['src'] = attrs_dict.get('src', '')
            else:
                self.elements.append(('img', attrs_dict.get('src', '')))
        elif tag == 'figcaption':
            self.in_figcaption = True
            self.caption_text = []

    def handle_endtag(self, tag):
        if tag in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            self.in_h = False
            text = ''.join(self.text_content).strip()
            if text:
                self.elements.append(('h', self.h_level, text))
        elif tag == 'p':
            text = ''.join(self.text_content).strip()
            if text:
                self.elements.append(('p', text))
        elif tag == 'figure':
            if self.current_fig:
                self.elements.append(('fig', self.current_fig.get('src', ''), self.current_fig.get('caption', '')))
            self.current_fig = None
        elif tag == 'figcaption':
            self.in_figcaption = False
            if self.current_fig:
                self.current_fig['caption'] = ''.join(self.caption_text).strip()

    def handle_data(self, data):
        if self.in_h:
            self.text_content.append(data)
        elif self.current_tag == 'p' and not self.in_figcaption:
            self.text_content.append(data)
        elif self.in_figcaption:
            self.caption_text.append(data)

def clean_answer_key(text):
    # Splits "Q1 Liver; Q2 Pancreas; ..." into a dictionary {1: "Liver", 2: "Pancreas", ...}
    # Pattern to match Q1, Q2, etc.
    parts = re.split(r'\bQ\d+\b', text)
    keys = re.findall(r'\bQ\d+\b', text)
    
    result = {}
    for i, key in enumerate(keys):
        num = int(key[1:])
        val = parts[i+1].strip().strip(';').strip('.').strip()
        result[num] = val
    return result

def main():
    doc_path = r"C:\Users\DELL\Downloads\US_Dateset_V01\Abdominal Ultrasound Training Module for Sonography Students - no image annotations - probe matching real images.doc"
    if not os.path.exists(doc_path):
        print("Error: doc file not found")
        return

    parser = DocParser()
    with open(doc_path, 'r', encoding='utf-8', errors='ignore') as f:
        parser.feed(f.read())

    print(f"Parsed {len(parser.elements)} elements.")

    # Create target directories
    os.makedirs("public/images/questions", exist_ok=True)

    # Let's group elements by sections
    sections = {}
    current_section = 0
    
    for el in parser.elements:
        if el[0] == 'h' and el[1] == 1:
            # New section
            match = re.search(r'Section (\d+):', el[2])
            if match:
                current_section = int(match.group(1))
                sections[current_section] = []
        elif current_section > 0:
            sections[current_section].append(el)

    print(f"Found sections: {list(sections.keys())}")

    # Let's inspect the options character in Section 4
    sec4_p = [el[1] for el in sections[4] if el[0] == 'p' and 'Options:' in el[1]]
    if sec4_p:
        print("Section 4 options preview:")
        print(sec4_p[0])
        print("Char ords:", [ord(c) for c in sec4_p[0][:15]])

if __name__ == '__main__':
    main()
