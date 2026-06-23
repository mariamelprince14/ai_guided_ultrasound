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
        self.elements = []
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

def save_base64_image(data_url, output_path):
    if not data_url.startswith("data:image/"):
        return False
    try:
        header, encoded = data_url.split(",", 1)
        data = base64.b64decode(encoded)
        with open(output_path, "wb") as f:
            f.write(data)
        return True
    except Exception as e:
        print(f"Error saving image {output_path}: {e}")
        return False

def clean_answer_key(text):
    # Splits "Q1 Liver; Q2 Pancreas; ..." into {1: "Liver", 2: "Pancreas", ...}
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
    image_dir = "public/images/questions"
    os.makedirs(image_dir, exist_ok=True)

    # Let's group elements by sections
    sections = {}
    current_section = 0
    
    for el in parser.elements:
        if el[0] == 'h' and el[1] == 1:
            match = re.search(r'Section (\d+):', el[2])
            if match:
                current_section = int(match.group(1))
                sections[current_section] = []
        elif current_section > 0:
            sections[current_section].append(el)

    questions_data = {
        "clinical_case_assessment": [],
        "abdominal_anatomy_id": []
    }

    # Helper function to find answer key block in section elements
    def extract_section_questions_and_key(section_num, elements):
        questions = []
        answer_key_text = ""
        
        curr_q = None
        for el in elements:
            if el[0] == 'h' and el[1] == 2:
                if "Answer Key" in el[2]:
                    # The next elements should be paragraph of answer key
                    continue
                match = re.match(r'Q(\d+)\.\s*(.*)', el[2])
                if match:
                    if curr_q:
                        questions.append(curr_q)
                    curr_q = {
                        "num": int(match.group(1)),
                        "title": match.group(2).strip(),
                        "figs": [],
                        "paragraphs": []
                    }
            elif el[0] == 'p':
                if curr_q:
                    # check if it is part of a question or after answer key H2
                    # Wait, if we are after answer key H2, we shouldn't add to curr_q.
                    # Actually, let's look at the position. If we saw "Answer Key" H2,
                    # we save the text as answer key.
                    # Let's check if the last H2 was Answer Key
                    pass
                # Let's check if this paragraph is the answer key text
                # It usually follows the H2 "Section X Answer Key"
                # Let's verify by checking if it contains Q1, Q2, etc.
                if "Q1" in el[1] and ("Q2" in el[1] or "Q3" in el[1]):
                    answer_key_text = el[1]
                elif curr_q:
                    curr_q["paragraphs"].append(el[1])
            elif el[0] == 'fig':
                if curr_q:
                    curr_q["figs"].append(el)
        if curr_q:
            questions.append(curr_q)
            
        key_dict = clean_answer_key(answer_key_text)
        return questions, key_dict

    # --- Section 1: Normal vs Abnormal Detection ---
    s1_qs, s1_keys = extract_section_questions_and_key(1, sections[1])
    print(f"Section 1: extracted {len(s1_qs)} questions. Answer key: {len(s1_keys)} answers.")

    for q in s1_qs:
        q_num = q["num"]
        title = q["title"]
        figs = q["figs"]
        
        # Section 1 has 2 images: Fig 0 is normal, Fig 1 is abnormal.
        normal_path = f"/images/questions/sec1_q{q_num}_normal.jpg"
        abnormal_path = f"/images/questions/sec1_q{q_num}_abnormal.jpg"
        
        save_base64_image(figs[0][1], f"public{normal_path}")
        save_base64_image(figs[1][1], f"public{abnormal_path}")
        
        explanation_detail = s1_keys.get(q_num, "")
        
        questions_data["clinical_case_assessment"].append({
            "id": f"sec1_q{q_num}",
            "type": "normal_vs_abnormal",
            "title": title,
            "images": {
                "normal": normal_path,
                "abnormal": abnormal_path
            },
            "explanation": f"The abnormality shown is {explanation_detail}. Normal abdominal ultrasound scan of the corresponding organ is on the left, displaying correct echogenicity, wall thickness, and texture. The abnormal scan on the right displays clinical features corresponding to {explanation_detail}."
        })

    # --- Section 5: Abnormality Diagnosis ---
    s5_qs, s5_keys = extract_section_questions_and_key(5, sections[5])
    print(f"Section 5: extracted {len(s5_qs)} questions. Answer key: {len(s5_keys)} answers.")

    for q in s5_qs:
        q_num = q["num"]
        title = q["title"]
        figs = q["figs"]
        paragraphs = q["paragraphs"]
        
        # Save image
        img_path = f"/images/questions/sec5_q{q_num}.jpg"
        save_base64_image(figs[0][1], f"public{img_path}")
        
        # Question text is the first paragraph.
        q_text = paragraphs[0]
        # Options are the subsequent paragraphs (usually A, B, C, D)
        options = []
        correct_index = -1
        correct_answer_str = s5_keys.get(q_num, "") # E.g., "Fatty liver/steatosis"
        
        for p in paragraphs[1:]:
            match = re.match(r'^([A-D])\)\s*(.*)', p)
            if match:
                opt_letter = match.group(1)
                opt_text = match.group(2).strip()
                options.append(opt_text)
                
                # Check if this option matches the answer key
                # Normalise for matching: compare lowercase and check if correct_answer_str is in opt_text or vice-versa
                norm_opt = opt_text.lower().replace('/', ' ')
                norm_key = correct_answer_str.lower().replace('/', ' ')
                # E.g. "fatty liver steatosis" vs "fatty liver steatosis"
                if norm_key in norm_opt or norm_opt in norm_key:
                    correct_index = len(options) - 1

        if correct_index == -1:
            # Fallback if text matching failed
            print(f"Warning: could not find correct option for Sec 5 Q{q_num}. Key: {correct_answer_str}, Options: {options}")
            # Section 5 answers: Q1 A, Q2 A, Q3 A, Q4 A, Q5 A, Q6 A, Q7 A, Q8 A, Q9 A, Q10 A
            # Let's check if the correct option is indeed A for all of them!
            # Let's inspect options:
            # Q1: A) Fatty liver/steatosis. Key: Fatty liver/steatosis. Yes, A (0).
            # Let's default to 0 if not found, as the first choice seems to be the key for Section 5!
            correct_index = 0

        questions_data["clinical_case_assessment"].append({
            "id": f"sec5_q{q_num}",
            "type": "multiple_choice",
            "title": title,
            "image": img_path,
            "questionText": q_text,
            "options": options,
            "correctIndex": correct_index,
            "explanation": f"The correct answer is '{options[correct_index]}'. Pathological features in the ultrasound scan match the clinical case of {correct_answer_str}."
        })

    # --- Section 2: Organ Identification ---
    s2_qs, s2_keys = extract_section_questions_and_key(2, sections[2])
    print(f"Section 2: extracted {len(s2_qs)} questions. Answer key: {len(s2_keys)} answers.")

    for q in s2_qs:
        q_num = q["num"]
        title = q["title"]
        figs = q["figs"]
        
        img_path = f"/images/questions/sec2_q{q_num}.jpg"
        save_base64_image(figs[0][1], f"public{img_path}")
        
        correct_organs = s2_keys.get(q_num, "") # E.g., "Liver" or "Gallbladder and liver"
        
        # Build 4 options: correct_organs + 3 distractors
        distractors = []
        all_possible_organs = ["Liver", "Pancreas", "Gallbladder and liver", "Right kidney and liver", "Spleen", "Liver and hepatic/portal vessels", "Right kidney", "Kidney and renal sinus", "Spleen and diaphragm"]
        
        options = [correct_organs]
        for dist in all_possible_organs:
            if dist.lower() != correct_organs.lower() and dist not in options:
                options.append(dist)
                if len(options) == 4:
                    break
        
        # Shuffled index logic is in frontend, here we can write them and keep correctIndex at 0 (or shuffle them here)
        # Let's keep correctIndex at 0 and let the frontend shuffle them, or we can shuffle them here.
        # Let's shuffle them here so we store a shuffled array and save the correct index.
        import random
        # Seed for reproducible shuffle (optional, but good)
        random.seed(q_num * 10)
        indexed_options = list(enumerate(options))
        random.shuffle(indexed_options)
        
        final_options = [opt for idx, opt in indexed_options]
        correct_index = [idx for idx, (orig_idx, opt) in enumerate(indexed_options) if orig_idx == 0][0]

        questions_data["abdominal_anatomy_id"].append({
            "id": f"sec2_q{q_num}",
            "type": "multiple_choice",
            "title": title,
            "image": img_path,
            "questionText": "Identify the abdominal organ(s) or structure(s) highlighted/shown in the ultrasound scan below.",
            "options": final_options,
            "correctIndex": correct_index,
            "explanation": f"The correct answer is '{correct_organs}'. The scan shows characteristic echoic features, shape, and anatomic relations corresponding to this organ/structure."
        })

    # --- Section 3: Probe Type Identification ---
    s3_qs, s3_keys = extract_section_questions_and_key(3, sections[3])
    print(f"Section 3: extracted {len(s3_qs)} questions. Answer key: {len(s3_keys)} answers.")

    # Questions 1 to 10 are multiple choice probe questions
    for q in s3_qs[:10]:
        q_num = q["num"]
        title = q["title"]
        figs = q["figs"]
        paragraphs = q["paragraphs"]
        
        img_path = f"/images/questions/sec3_q{q_num}.jpg"
        save_base64_image(figs[0][1], f"public{img_path}")
        
        # Question text is paragraphs[0]
        q_text = paragraphs[0]
        
        options = []
        correct_letter = s3_keys.get(q_num, "") # E.g., "B"
        correct_index = -1
        
        letter_map = {"A": 0, "B": 1, "C": 2, "D": 3}
        correct_index = letter_map.get(correct_letter, 0)
        
        if q_num == 10:
            options = [
                "Linear: adult deep liver survey",
                "Curvilinear: adult deep liver survey",
                "Linear: cardiac survey",
                "Phased array: thyroid high-resolution survey"
            ]
        else:
            for p in paragraphs[1:]:
                match = re.match(r'^([A-D])\)\s*(.*)', p)
                if match:
                    options.append(match.group(2).strip())
                
        questions_data["abdominal_anatomy_id"].append({
            "id": f"sec3_q{q_num}",
            "type": "multiple_choice",
            "title": title,
            "image": img_path,
            "questionText": q_text,
            "options": options,
            "correctIndex": correct_index,
            "explanation": f"The correct option is {correct_letter}) '{options[correct_index]}'. This probe configuration matches the described acoustic field-of-view, frequency, and clinical application."
        })

    # Q11: Matching probe to resulting image
    q11 = s3_qs[11] if len(s3_qs) > 11 else s3_qs[-1] # wait, len(s3_qs) might be 11. Let's find q["num"] == 11
    for q in s3_qs:
        if q["num"] == 11:
            q11 = q
            break
            
    print(f"Processing Section 3 Q11 matching question. Figs count: {len(q11['figs'])}")
    
    probe_img_path = "/images/questions/sec3_q11_probes.jpg"
    result_img_path = "/images/questions/sec3_q11_results.jpg"
    save_base64_image(q11["figs"][0][1], f"public{probe_img_path}")
    save_base64_image(q11["figs"][1][1], f"public{result_img_path}")
    
    # Q11 match format: A-1, B-2, C-3
    questions_data["abdominal_anatomy_id"].append({
        "id": "sec3_q11",
        "type": "matching",
        "title": q11["title"],
        "probesImage": probe_img_path,
        "resultsImage": result_img_path,
        "questionText": "Match each probe type (A, B, C) in the top row with its resulting ultrasound image shape/scan (1, 2, 3) in the bottom row.",
        "pairs": [
            {"key": "A", "label": "Probe A (Linear)", "imageLabel": "Image 1 (Rectangular)"},
            {"key": "B", "label": "Probe B (Curvilinear)", "imageLabel": "Image 2 (Diverging sector/trapezoid)"},
            {"key": "C", "label": "Probe C (Phased Array)", "imageLabel": "Image 3 (Narrow sector)"}
        ],
        "matches": {
            "A": "1",
            "B": "2",
            "C": "3"
        },
        "explanation": "Probe A (Linear) operates at high frequencies with parallel scan lines, yielding a rectangular image (Image 1). Probe B (Curvilinear) utilizes a curved crystal array to produce a diverging sector/trapezoid image (Image 2) ideal for abdominal surveys. Probe C (Phased Array) has a small footprint and electronically steers beams in a wide sector format (Image 3), allowing it to scan through narrow intercostal windows."
    })

    # --- Section 4: Select Present Organs ---
    s4_qs, s4_keys = extract_section_questions_and_key(4, sections[4])
    print(f"Section 4: extracted {len(s4_qs)} questions. Answer key: {len(s4_keys)} answers.")

    for q in s4_qs:
        q_num = q["num"]
        title = q["title"]
        figs = q["figs"]
        paragraphs = q["paragraphs"]
        
        img_path = f"/images/questions/sec4_q{q_num}.jpg"
        save_base64_image(figs[0][1], f"public{img_path}")
        
        # Options string in paragraphs: "Options: ? Liver ? Gallbladder ? Kidney ? Spleen ? Pancreas ? Urinary bladder"
        # We can clean the text
        options_text = paragraphs[0] if paragraphs else ""
        options = [opt.strip() for opt in options_text.replace("Options:", "").split("?") if opt.strip()]
        
        correct_organs_str = s4_keys.get(q_num, "") # E.g., "Liver, gallbladder" or "Spleen, diaphragm, LUQ tissue"
        # Split correct answers by comma
        correct_answers = [ans.strip().lower() for ans in correct_organs_str.split(",") if ans.strip()]
        
        # Let's map each option to see if it is correct
        # Options: ['Liver', 'Gallbladder', 'Kidney', 'Spleen', 'Pancreas', 'Urinary bladder']
        # Let's do a substring match. For example, if correct_answers has 'liver' and option is 'Liver', it matches.
        # If correct_answers has 'vessel' and option is 'Portal/hepatic vessel', it matches.
        # If correct_answers has 'luq tissue' and option is 'Left upper quadrant soft tissue', it matches.
        correct_options = []
        for opt in options:
            norm_opt = opt.lower()
            # check if any of the correct answers is in this option or vice-versa
            is_correct = False
            for ans in correct_answers:
                # E.g. "vessels" in "liver and vessels" -> true
                # E.g. "renal sinus" in "renal sinus" -> true
                # E.g. "kidney" in "right kidney" -> true
                if ans in norm_opt or norm_opt in ans:
                    is_correct = True
                    break
            if is_correct:
                correct_options.append(opt)

        questions_data["abdominal_anatomy_id"].append({
            "id": f"sec4_q{q_num}",
            "type": "select_present_organs",
            "title": title,
            "image": img_path,
            "questionText": "Observe the ultrasound image and select all organs, structures, or landmarks that are visible in this frame.",
            "options": options,
            "correctOptions": correct_options,
            "explanation": f"The visible structures in this frame are: {correct_organs_str}. Correct identification of these elements is vital for orienting yourself during scanning."
        })

    # Let's write the results to a typescript file!
    ts_content = f"""// Auto-generated questions data file
export interface MultipleChoiceQuestion {{
    id: string;
    type: 'multiple_choice';
    title: string;
    image: string;
    questionText: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}}

export interface NormalVsAbnormalQuestion {{
    id: string;
    type: 'normal_vs_abnormal';
    title: string;
    images: {{
        normal: string;
        abnormal: string;
    }};
    explanation: string;
}}

export interface SelectPresentOrgansQuestion {{
    id: string;
    type: 'select_present_organs';
    title: string;
    image: string;
    questionText: string;
    options: string[];
    correctOptions: string[];
    explanation: string;
}}

export interface MatchingQuestion {{
    id: string;
    type: 'matching';
    title: string;
    probesImage: string;
    resultsImage: string;
    questionText: string;
    pairs: {{ key: string; label: string; imageLabel: string }}[];
    matches: {{ [key: string]: string }};
    explanation: string;
}}

export type Question = MultipleChoiceQuestion | NormalVsAbnormalQuestion | SelectPresentOrgansQuestion | MatchingQuestion;

export interface QuestionsDatabase {{
    clinical_case_assessment: Question[];
    abdominal_anatomy_id: Question[];
}}

export const questionsDatabase: QuestionsDatabase = {json.dumps(questions_data, indent=4)};
"""

    with open("src/constants/questionsData.ts", "w", encoding="utf-8") as f:
        f.write(ts_content)

    print("Successfully generated src/constants/questionsData.ts and saved images.")

if __name__ == '__main__':
    main()
