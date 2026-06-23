import os
from html.parser import HTMLParser

class DocParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
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

def main():
    path = r"C:\Users\DELL\Downloads\US_Dateset_V01\Abdominal Ultrasound Training Module for Sonography Students - no image annotations - probe matching real images.doc"
    if not os.path.exists(path):
        print("File not found")
        return

    parser = DocParser()
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        parser.feed(f.read())

    print(f"Total parsed elements: {len(parser.elements)}")
    
    # Print the first 150 elements to see structure
    for i, el in enumerate(parser.elements[:150]):
        if el[0] == 'h':
            print(f"{i}: H{el[1]} - {el[2]}")
        elif el[0] == 'p':
            text = el[1]
            if len(text) > 80:
                text = text[:80] + "..."
            print(f"{i}: P - {text}")
        elif el[0] == 'fig':
            print(f"{i}: FIG - Caption: {el[2]} | Src len: {len(el[1])} | Src prefix: {el[1][:50]}")

if __name__ == '__main__':
    main()
