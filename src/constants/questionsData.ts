// Auto-generated questions data file
export interface MultipleChoiceQuestion {
    id: string;
    type: 'multiple_choice';
    title: string;
    image: string;
    questionText: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}

export interface NormalVsAbnormalQuestion {
    id: string;
    type: 'normal_vs_abnormal';
    title: string;
    images: {
        normal: string;
        abnormal: string;
    };
    explanation: string;
}

export interface SelectPresentOrgansQuestion {
    id: string;
    type: 'select_present_organs';
    title: string;
    image: string;
    questionText: string;
    options: string[];
    correctOptions: string[];
    explanation: string;
}

export interface MatchingQuestion {
    id: string;
    type: 'matching';
    title: string;
    probesImage: string;
    resultsImage: string;
    questionText: string;
    pairs: { key: string; label: string; imageLabel: string }[];
    matches: { [key: string]: string };
    explanation: string;
}

export type Question = MultipleChoiceQuestion | NormalVsAbnormalQuestion | SelectPresentOrgansQuestion | MatchingQuestion;

export interface QuestionsDatabase {
    clinical_case_assessment: Question[];
    abdominal_anatomy_id: Question[];
}

export const questionsDatabase: QuestionsDatabase = {
    "clinical_case_assessment": [
        {
            "id": "sec1_q1",
            "type": "normal_vs_abnormal",
            "title": "Liver Echogenicity: Normal vs Fatty Change",
            "images": {
                "normal": "/images/questions/sec1_q1_normal.jpg",
                "abnormal": "/images/questions/sec1_q1_abnormal.jpg"
            },
            "explanation": "The abnormality shown is steatosis pattern. Normal abdominal ultrasound scan of the corresponding organ is on the left, displaying correct echogenicity, wall thickness, and texture. The abnormal scan on the right displays clinical features corresponding to steatosis pattern."
        },
        {
            "id": "sec1_q2",
            "type": "normal_vs_abnormal",
            "title": "Liver Texture: Smooth vs Coarse Parenchyma",
            "images": {
                "normal": "/images/questions/sec1_q2_normal.jpg",
                "abnormal": "/images/questions/sec1_q2_abnormal.jpg"
            },
            "explanation": "The abnormality shown is chronic/coarse hepatic parenchymal disease. Normal abdominal ultrasound scan of the corresponding organ is on the left, displaying correct echogenicity, wall thickness, and texture. The abnormal scan on the right displays clinical features corresponding to chronic/coarse hepatic parenchymal disease."
        },
        {
            "id": "sec1_q3",
            "type": "normal_vs_abnormal",
            "title": "Focal Liver Lesion: Cystic Pattern",
            "images": {
                "normal": "/images/questions/sec1_q3_normal.jpg",
                "abnormal": "/images/questions/sec1_q3_abnormal.jpg"
            },
            "explanation": "The abnormality shown is hepatic cyst pattern. Normal abdominal ultrasound scan of the corresponding organ is on the left, displaying correct echogenicity, wall thickness, and texture. The abnormal scan on the right displays clinical features corresponding to hepatic cyst pattern."
        },
        {
            "id": "sec1_q4",
            "type": "normal_vs_abnormal",
            "title": "Kidney: Normal Sinus vs Hydronephrosis",
            "images": {
                "normal": "/images/questions/sec1_q4_normal.jpg",
                "abnormal": "/images/questions/sec1_q4_abnormal.jpg"
            },
            "explanation": "The abnormality shown is hydronephrosis. Normal abdominal ultrasound scan of the corresponding organ is on the left, displaying correct echogenicity, wall thickness, and texture. The abnormal scan on the right displays clinical features corresponding to hydronephrosis."
        },
        {
            "id": "sec1_q5",
            "type": "normal_vs_abnormal",
            "title": "Kidney: Normal Cortex vs Renal Calculus",
            "images": {
                "normal": "/images/questions/sec1_q5_normal.jpg",
                "abnormal": "/images/questions/sec1_q5_abnormal.jpg"
            },
            "explanation": "The abnormality shown is nephrolithiasis. Normal abdominal ultrasound scan of the corresponding organ is on the left, displaying correct echogenicity, wall thickness, and texture. The abnormal scan on the right displays clinical features corresponding to nephrolithiasis."
        },
        {
            "id": "sec1_q6",
            "type": "normal_vs_abnormal",
            "title": "Kidney: Normal Parenchyma vs Renal Cyst",
            "images": {
                "normal": "/images/questions/sec1_q6_normal.jpg",
                "abnormal": "/images/questions/sec1_q6_abnormal.jpg"
            },
            "explanation": "The abnormality shown is renal cyst pattern. Normal abdominal ultrasound scan of the corresponding organ is on the left, displaying correct echogenicity, wall thickness, and texture. The abnormal scan on the right displays clinical features corresponding to renal cyst pattern."
        },
        {
            "id": "sec1_q7",
            "type": "normal_vs_abnormal",
            "title": "Gallbladder: Normal Lumen vs Cholelithiasis",
            "images": {
                "normal": "/images/questions/sec1_q7_normal.jpg",
                "abnormal": "/images/questions/sec1_q7_abnormal.jpg"
            },
            "explanation": "The abnormality shown is cholelithiasis. Normal abdominal ultrasound scan of the corresponding organ is on the left, displaying correct echogenicity, wall thickness, and texture. The abnormal scan on the right displays clinical features corresponding to cholelithiasis."
        },
        {
            "id": "sec1_q8",
            "type": "normal_vs_abnormal",
            "title": "Gallbladder: Thin Wall vs Cholecystitis Pattern",
            "images": {
                "normal": "/images/questions/sec1_q8_normal.jpg",
                "abnormal": "/images/questions/sec1_q8_abnormal.jpg"
            },
            "explanation": "The abnormality shown is cholecystitis pattern. Normal abdominal ultrasound scan of the corresponding organ is on the left, displaying correct echogenicity, wall thickness, and texture. The abnormal scan on the right displays clinical features corresponding to cholecystitis pattern."
        },
        {
            "id": "sec1_q9",
            "type": "normal_vs_abnormal",
            "title": "Gallbladder: Clear Bile vs Sludge",
            "images": {
                "normal": "/images/questions/sec1_q9_normal.jpg",
                "abnormal": "/images/questions/sec1_q9_abnormal.jpg"
            },
            "explanation": "The abnormality shown is biliary sludge. Normal abdominal ultrasound scan of the corresponding organ is on the left, displaying correct echogenicity, wall thickness, and texture. The abnormal scan on the right displays clinical features corresponding to biliary sludge."
        },
        {
            "id": "sec1_q10",
            "type": "normal_vs_abnormal",
            "title": "Kidney: Mild vs More Advanced Collecting-System Dilatation",
            "images": {
                "normal": "/images/questions/sec1_q10_normal.jpg",
                "abnormal": "/images/questions/sec1_q10_abnormal.jpg"
            },
            "explanation": "The abnormality shown is hydronephrosis. Normal abdominal ultrasound scan of the corresponding organ is on the left, displaying correct echogenicity, wall thickness, and texture. The abnormal scan on the right displays clinical features corresponding to hydronephrosis."
        },
        {
            "id": "sec5_q1",
            "type": "multiple_choice",
            "title": "Liver Abnormality",
            "image": "/images/questions/sec5_q1.jpg",
            "questionText": "A patient with obesity and mildly elevated transaminases undergoes liver ultrasound. What abnormality is most likely?",
            "options": [
                "Fatty liver/steatosis",
                "Hydronephrosis",
                "Gallstone",
                "Urinary bladder debris"
            ],
            "correctIndex": 0,
            "explanation": "The correct answer is 'Fatty liver/steatosis'. Pathological features in the ultrasound scan match the clinical case of Fatty liver/steatosis."
        },
        {
            "id": "sec5_q2",
            "type": "multiple_choice",
            "title": "Liver Abnormality",
            "image": "/images/questions/sec5_q2.jpg",
            "questionText": "A patient with chronic viral hepatitis is scanned. Which diagnosis best matches a coarse heterogeneous liver pattern?",
            "options": [
                "Cirrhosis/chronic parenchymal disease",
                "Simple renal cyst",
                "Acute cystitis",
                "Cholelithiasis"
            ],
            "correctIndex": 0,
            "explanation": "The correct answer is 'Cirrhosis/chronic parenchymal disease'. Pathological features in the ultrasound scan match the clinical case of Cirrhosis/chronic parenchymal disease pattern."
        },
        {
            "id": "sec5_q3",
            "type": "multiple_choice",
            "title": "Liver Abnormality",
            "image": "/images/questions/sec5_q3.jpg",
            "questionText": "An incidental focal liver lesion appears cystic. What is the most likely teaching diagnosis?",
            "options": [
                "Hepatic cyst",
                "Gallbladder sludge",
                "Renal stone",
                "Pancreatitis"
            ],
            "correctIndex": 0,
            "explanation": "The correct answer is 'Hepatic cyst'. Pathological features in the ultrasound scan match the clinical case of Hepatic cyst."
        },
        {
            "id": "sec5_q4",
            "type": "multiple_choice",
            "title": "Liver Abnormality",
            "image": "/images/questions/sec5_q4.jpg",
            "questionText": "A well-defined echogenic hepatic lesion is considered during a screening scan. What benign lesion is a classic differential?",
            "options": [
                "Hemangioma",
                "Hydronephrosis",
                "Cholecystitis",
                "Bladder stone"
            ],
            "correctIndex": 0,
            "explanation": "The correct answer is 'Hemangioma'. Pathological features in the ultrasound scan match the clinical case of Hemangioma differential."
        },
        {
            "id": "sec5_q5",
            "type": "multiple_choice",
            "title": "Kidney Abnormality",
            "image": "/images/questions/sec5_q5.jpg",
            "questionText": "A patient has flank pain and rising creatinine. What abnormality is present?",
            "options": [
                "Hydronephrosis",
                "Fatty liver",
                "Gallbladder polyp",
                "Splenic hemangioma"
            ],
            "correctIndex": 0,
            "explanation": "The correct answer is 'Hydronephrosis'. Pathological features in the ultrasound scan match the clinical case of Hydronephrosis."
        },
        {
            "id": "sec5_q6",
            "type": "multiple_choice",
            "title": "Kidney Abnormality",
            "image": "/images/questions/sec5_q6.jpg",
            "questionText": "A patient has severe colicky flank pain and hematuria. Which diagnosis best fits a bright shadowing renal focus?",
            "options": [
                "Kidney stone",
                "Hepatic cyst",
                "Biliary sludge",
                "Cirrhosis"
            ],
            "correctIndex": 0,
            "explanation": "The correct answer is 'Kidney stone'. Pathological features in the ultrasound scan match the clinical case of Kidney stone."
        },
        {
            "id": "sec5_q7",
            "type": "multiple_choice",
            "title": "Kidney Abnormality",
            "image": "/images/questions/sec5_q7.jpg",
            "questionText": "An incidental round anechoic renal lesion is found. What is the most likely diagnosis?",
            "options": [
                "Renal cyst",
                "Cholecystitis",
                "Fatty liver",
                "Hepatic hemangioma"
            ],
            "correctIndex": 0,
            "explanation": "The correct answer is 'Renal cyst'. Pathological features in the ultrasound scan match the clinical case of Renal cyst."
        },
        {
            "id": "sec5_q8",
            "type": "multiple_choice",
            "title": "Gallbladder Abnormality",
            "image": "/images/questions/sec5_q8.jpg",
            "questionText": "A patient has episodic right upper quadrant pain after meals. What abnormality is present?",
            "options": [
                "Cholelithiasis",
                "Hydronephrosis",
                "Hepatic cyst",
                "Renal cortical cyst"
            ],
            "correctIndex": 0,
            "explanation": "The correct answer is 'Cholelithiasis'. Pathological features in the ultrasound scan match the clinical case of Cholelithiasis."
        },
        {
            "id": "sec5_q9",
            "type": "multiple_choice",
            "title": "Gallbladder Abnormality",
            "image": "/images/questions/sec5_q9.jpg",
            "questionText": "A febrile patient has constant right upper quadrant pain and focal probe tenderness. What is the best diagnosis?",
            "options": [
                "Acute cholecystitis",
                "Simple hepatic cyst",
                "Renal stone without obstruction",
                "Fatty liver only"
            ],
            "correctIndex": 0,
            "explanation": "The correct answer is 'Acute cholecystitis'. Pathological features in the ultrasound scan match the clinical case of Acute cholecystitis."
        },
        {
            "id": "sec5_q10",
            "type": "multiple_choice",
            "title": "Gallbladder Abnormality",
            "image": "/images/questions/sec5_q10.jpg",
            "questionText": "A fasting inpatient has low-level echoes layering in the gallbladder. What is the most likely abnormality?",
            "options": [
                "Biliary sludge",
                "Renal cyst",
                "Portal vein thrombosis",
                "Splenic rupture"
            ],
            "correctIndex": 0,
            "explanation": "The correct answer is 'Biliary sludge'. Pathological features in the ultrasound scan match the clinical case of Biliary sludge."
        }
    ],
    "abdominal_anatomy_id": [
        {
            "id": "sec2_q1",
            "type": "multiple_choice",
            "title": "Patient 10 Right Upper Quadrant",
            "image": "/images/questions/sec2_q1.jpg",
            "questionText": "Identify the abdominal organ(s) or structure(s) highlighted/shown in the ultrasound scan below.",
            "options": [
                "Right kidney and liver",
                "Gallbladder and liver",
                "Pancreas",
                "Liver"
            ],
            "correctIndex": 3,
            "explanation": "The correct answer is 'Liver'. The scan shows characteristic echoic features, shape, and anatomic relations corresponding to this organ/structure."
        },
        {
            "id": "sec2_q2",
            "type": "multiple_choice",
            "title": "Patient 10 Pancreatic Region",
            "image": "/images/questions/sec2_q2.jpg",
            "questionText": "Identify the abdominal organ(s) or structure(s) highlighted/shown in the ultrasound scan below.",
            "options": [
                "Gallbladder and liver",
                "Pancreas",
                "Right kidney and liver",
                "Liver"
            ],
            "correctIndex": 1,
            "explanation": "The correct answer is 'Pancreas'. The scan shows characteristic echoic features, shape, and anatomic relations corresponding to this organ/structure."
        },
        {
            "id": "sec2_q3",
            "type": "multiple_choice",
            "title": "Patient 10 Gallbladder Fossa",
            "image": "/images/questions/sec2_q3.jpg",
            "questionText": "Identify the abdominal organ(s) or structure(s) highlighted/shown in the ultrasound scan below.",
            "options": [
                "Liver",
                "Gallbladder and liver",
                "Right kidney and liver",
                "Pancreas"
            ],
            "correctIndex": 1,
            "explanation": "The correct answer is 'Gallbladder and liver'. The scan shows characteristic echoic features, shape, and anatomic relations corresponding to this organ/structure."
        },
        {
            "id": "sec2_q4",
            "type": "multiple_choice",
            "title": "Patient 10 Right Kidney",
            "image": "/images/questions/sec2_q4.jpg",
            "questionText": "Identify the abdominal organ(s) or structure(s) highlighted/shown in the ultrasound scan below.",
            "options": [
                "Liver",
                "Right kidney and liver",
                "Pancreas",
                "Gallbladder and liver"
            ],
            "correctIndex": 1,
            "explanation": "The correct answer is 'Right kidney and liver'. The scan shows characteristic echoic features, shape, and anatomic relations corresponding to this organ/structure."
        },
        {
            "id": "sec2_q5",
            "type": "multiple_choice",
            "title": "Patient 10 Spleen",
            "image": "/images/questions/sec2_q5.jpg",
            "questionText": "Identify the abdominal organ(s) or structure(s) highlighted/shown in the ultrasound scan below.",
            "options": [
                "Spleen",
                "Pancreas",
                "Liver",
                "Gallbladder and liver"
            ],
            "correctIndex": 0,
            "explanation": "The correct answer is 'Spleen'. The scan shows characteristic echoic features, shape, and anatomic relations corresponding to this organ/structure."
        },
        {
            "id": "sec2_q6",
            "type": "multiple_choice",
            "title": "Patient 54 Liver and Vessels",
            "image": "/images/questions/sec2_q6.jpg",
            "questionText": "Identify the abdominal organ(s) or structure(s) highlighted/shown in the ultrasound scan below.",
            "options": [
                "Gallbladder and liver",
                "Liver and hepatic/portal vessels",
                "Liver",
                "Pancreas"
            ],
            "correctIndex": 1,
            "explanation": "The correct answer is 'Liver and hepatic/portal vessels'. The scan shows characteristic echoic features, shape, and anatomic relations corresponding to this organ/structure."
        },
        {
            "id": "sec2_q7",
            "type": "multiple_choice",
            "title": "Patient 54 Gallbladder",
            "image": "/images/questions/sec2_q7.jpg",
            "questionText": "Identify the abdominal organ(s) or structure(s) highlighted/shown in the ultrasound scan below.",
            "options": [
                "Right kidney and liver",
                "Pancreas",
                "Liver",
                "Gallbladder and liver"
            ],
            "correctIndex": 3,
            "explanation": "The correct answer is 'Gallbladder and liver'. The scan shows characteristic echoic features, shape, and anatomic relations corresponding to this organ/structure."
        },
        {
            "id": "sec2_q8",
            "type": "multiple_choice",
            "title": "Patient 54 Right Kidney",
            "image": "/images/questions/sec2_q8.jpg",
            "questionText": "Identify the abdominal organ(s) or structure(s) highlighted/shown in the ultrasound scan below.",
            "options": [
                "Right kidney",
                "Gallbladder and liver",
                "Liver",
                "Pancreas"
            ],
            "correctIndex": 0,
            "explanation": "The correct answer is 'Right kidney'. The scan shows characteristic echoic features, shape, and anatomic relations corresponding to this organ/structure."
        },
        {
            "id": "sec2_q9",
            "type": "multiple_choice",
            "title": "Patient 55 Right Kidney",
            "image": "/images/questions/sec2_q9.jpg",
            "questionText": "Identify the abdominal organ(s) or structure(s) highlighted/shown in the ultrasound scan below.",
            "options": [
                "Gallbladder and liver",
                "Right kidney",
                "Pancreas",
                "Liver"
            ],
            "correctIndex": 1,
            "explanation": "The correct answer is 'Right kidney'. The scan shows characteristic echoic features, shape, and anatomic relations corresponding to this organ/structure."
        },
        {
            "id": "sec2_q10",
            "type": "multiple_choice",
            "title": "Patient 161 Gallbladder Region",
            "image": "/images/questions/sec2_q10.jpg",
            "questionText": "Identify the abdominal organ(s) or structure(s) highlighted/shown in the ultrasound scan below.",
            "options": [
                "Gallbladder and liver",
                "Pancreas",
                "Right kidney and liver",
                "Liver"
            ],
            "correctIndex": 0,
            "explanation": "The correct answer is 'Gallbladder and liver'. The scan shows characteristic echoic features, shape, and anatomic relations corresponding to this organ/structure."
        },
        {
            "id": "sec3_q1",
            "type": "multiple_choice",
            "title": "Curvilinear Abdominal Probe",
            "image": "/images/questions/sec3_q1.jpg",
            "questionText": "A curvilinear probe produces which image shape and primary use?",
            "options": [
                "Rectangular field for thyroid imaging",
                "Diverging sector/trapezoid field for abdominal imaging",
                "Pure sector field for cardiac imaging",
                "Needle-only field for vascular access"
            ],
            "correctIndex": 1,
            "explanation": "The correct option is B) 'Diverging sector/trapezoid field for abdominal imaging'. This probe configuration matches the described acoustic field-of-view, frequency, and clinical application."
        },
        {
            "id": "sec3_q2",
            "type": "multiple_choice",
            "title": "Linear Probe Frequency",
            "image": "/images/questions/sec3_q2.jpg",
            "questionText": "Which probe is best for superficial high-resolution imaging?",
            "options": [
                "Linear probe, high frequency about 3-19 MHz",
                "Curvilinear probe, low frequency about 1-5 MHz",
                "Phased array probe only",
                "Endocavitary probe only"
            ],
            "correctIndex": 0,
            "explanation": "The correct option is A) 'Linear probe, high frequency about 3-19 MHz'. This probe configuration matches the described acoustic field-of-view, frequency, and clinical application."
        },
        {
            "id": "sec3_q3",
            "type": "multiple_choice",
            "title": "Phased Array Shape",
            "image": "/images/questions/sec3_q3.jpg",
            "questionText": "A small probe footprint with a narrow origin and sector-shaped image is most consistent with:",
            "options": [
                "Linear probe",
                "Curvilinear probe",
                "Phased array probe",
                "Hockey-stick probe only"
            ],
            "correctIndex": 2,
            "explanation": "The correct option is C) 'Phased array probe'. This probe configuration matches the described acoustic field-of-view, frequency, and clinical application."
        },
        {
            "id": "sec3_q4",
            "type": "multiple_choice",
            "title": "Best Probe for Obese Adult Liver",
            "image": "/images/questions/sec3_q4.jpg",
            "questionText": "An adult patient has a deep liver and limited penetration. Which probe is most appropriate?",
            "options": [
                "High-frequency linear",
                "Low-frequency curvilinear",
                "Dermatologic ultrasound probe",
                "Intravascular ultrasound probe"
            ],
            "correctIndex": 1,
            "explanation": "The correct option is B) 'Low-frequency curvilinear'. This probe configuration matches the described acoustic field-of-view, frequency, and clinical application."
        },
        {
            "id": "sec3_q5",
            "type": "multiple_choice",
            "title": "Rectangular Field of View",
            "image": "/images/questions/sec3_q5.jpg",
            "questionText": "The ultrasound image is rectangular, with parallel sides from near to far field. Which probe most likely produced it?",
            "options": [
                "Linear",
                "Curvilinear",
                "Phased array",
                "Mechanical sector"
            ],
            "correctIndex": 0,
            "explanation": "The correct option is A) 'Linear'. This probe configuration matches the described acoustic field-of-view, frequency, and clinical application."
        },
        {
            "id": "sec3_q6",
            "type": "multiple_choice",
            "title": "Diverging Abdominal Field",
            "image": "/images/questions/sec3_q6.jpg",
            "questionText": "The image has a broad far field and curved near-field footprint, typical of routine abdominal scanning. Which probe?",
            "options": [
                "Linear",
                "Curvilinear",
                "Phased array",
                "Transesophageal"
            ],
            "correctIndex": 1,
            "explanation": "The correct option is B) 'Curvilinear'. This probe configuration matches the described acoustic field-of-view, frequency, and clinical application."
        },
        {
            "id": "sec3_q7",
            "type": "multiple_choice",
            "title": "Ribs Limit the Window",
            "image": "/images/questions/sec3_q7.jpg",
            "questionText": "A patient needs a subcostal/intercostal view where the acoustic window is narrow. Which probe may help?",
            "options": [
                "Phased array",
                "Large linear",
                "18 MHz dermatologic probe",
                "Rectal probe"
            ],
            "correctIndex": 0,
            "explanation": "The correct option is A) 'Phased array'. This probe configuration matches the described acoustic field-of-view, frequency, and clinical application."
        },
        {
            "id": "sec3_q8",
            "type": "multiple_choice",
            "title": "Pediatric Superficial Bowel Wall",
            "image": "/images/questions/sec3_q8.jpg",
            "questionText": "For a thin child with a superficial bowel target, what probe gives best detail?",
            "options": [
                "Linear high-frequency probe",
                "Curvilinear low-frequency probe only",
                "Phased array only",
                "Non-imaging Doppler pencil"
            ],
            "correctIndex": 0,
            "explanation": "The correct option is A) 'Linear high-frequency probe'. This probe configuration matches the described acoustic field-of-view, frequency, and clinical application."
        },
        {
            "id": "sec3_q9",
            "type": "multiple_choice",
            "title": "Deep Pelvic Survey",
            "image": "/images/questions/sec3_q9.jpg",
            "questionText": "A transabdominal pelvic survey requires depth and a broad field. Which probe is usually selected?",
            "options": [
                "Linear",
                "Curvilinear",
                "Phased array cardiac only",
                "Intraoperative probe"
            ],
            "correctIndex": 1,
            "explanation": "The correct option is B) 'Curvilinear'. This probe configuration matches the described acoustic field-of-view, frequency, and clinical application."
        },
        {
            "id": "sec3_q10",
            "type": "multiple_choice",
            "title": "Probe-Application Match",
            "image": "/images/questions/sec3_q10.jpg",
            "questionText": "Which pairing is most accurate?",
            "options": [
                "Linear: adult deep liver survey",
                "Curvilinear: adult deep liver survey",
                "Linear: cardiac survey",
                "Phased array: thyroid high-resolution survey"
            ],
            "correctIndex": 1,
            "explanation": "The correct option is B) 'Curvilinear: adult deep liver survey'. This probe configuration matches the described acoustic field-of-view, frequency, and clinical application."
        },
        {
            "id": "sec3_q11",
            "type": "matching",
            "title": "Match Probe to Resulting Ultrasound Image",
            "probesImage": "/images/questions/sec3_q11_probes.jpg",
            "resultsImage": "/images/questions/sec3_q11_results.jpg",
            "questionText": "Match each probe type (A, B, C) in the top row with its resulting ultrasound image shape/scan (1, 2, 3) in the bottom row.",
            "pairs": [
                {
                    "key": "A",
                    "label": "Probe A (Linear)",
                    "imageLabel": "Image 1 (Rectangular)"
                },
                {
                    "key": "B",
                    "label": "Probe B (Curvilinear)",
                    "imageLabel": "Image 2 (Diverging sector/trapezoid)"
                },
                {
                    "key": "C",
                    "label": "Probe C (Phased Array)",
                    "imageLabel": "Image 3 (Narrow sector)"
                }
            ],
            "matches": {
                "A": "1",
                "B": "2",
                "C": "3"
            },
            "explanation": "Probe A (Linear) operates at high frequencies with parallel scan lines, yielding a rectangular image (Image 1). Probe B (Curvilinear) utilizes a curved crystal array to produce a diverging sector/trapezoid image (Image 2) ideal for abdominal surveys. Probe C (Phased Array) has a small footprint and electronically steers beams in a wide sector format (Image 3), allowing it to scan through narrow intercostal windows."
        },
        {
            "id": "sec4_q1",
            "type": "select_present_organs",
            "title": "Patient 54 Gallbladder Fossa",
            "image": "/images/questions/sec4_q1.jpg",
            "questionText": "Observe the ultrasound image and select all organs, structures, or landmarks that are visible in this frame.",
            "options": [
                "Liver",
                "Gallbladder",
                "Kidney",
                "Spleen",
                "Pancreas",
                "Urinary bladder"
            ],
            "correctOptions": [
                "Liver",
                "Gallbladder"
            ],
            "explanation": "The visible structures in this frame are: Liver, gallbladder. Correct identification of these elements is vital for orienting yourself during scanning."
        },
        {
            "id": "sec4_q2",
            "type": "select_present_organs",
            "title": "Patient 10 Right Kidney Window",
            "image": "/images/questions/sec4_q2.jpg",
            "questionText": "Observe the ultrasound image and select all organs, structures, or landmarks that are visible in this frame.",
            "options": [
                "Liver",
                "Right kidney",
                "Gallbladder",
                "Portal vein",
                "Spleen",
                "Aorta"
            ],
            "correctOptions": [
                "Liver",
                "Right kidney"
            ],
            "explanation": "The visible structures in this frame are: Liver, right kidney. Correct identification of these elements is vital for orienting yourself during scanning."
        },
        {
            "id": "sec4_q3",
            "type": "select_present_organs",
            "title": "Patient 55 Hepatorenal View",
            "image": "/images/questions/sec4_q3.jpg",
            "questionText": "Observe the ultrasound image and select all organs, structures, or landmarks that are visible in this frame.",
            "options": [
                "Liver",
                "Right kidney",
                "Portal/hepatic vessel",
                "Gallbladder",
                "Spleen",
                "Urinary bladder"
            ],
            "correctOptions": [
                "Liver",
                "Right kidney",
                "Portal/hepatic vessel"
            ],
            "explanation": "The visible structures in this frame are: Liver, right kidney, vessel. Correct identification of these elements is vital for orienting yourself during scanning."
        },
        {
            "id": "sec4_q4",
            "type": "select_present_organs",
            "title": "Patient 161 Gallbladder and Liver",
            "image": "/images/questions/sec4_q4.jpg",
            "questionText": "Observe the ultrasound image and select all organs, structures, or landmarks that are visible in this frame.",
            "options": [
                "Liver",
                "Gallbladder",
                "Bile/sludge interface",
                "Kidney",
                "Spleen",
                "Pancreas"
            ],
            "correctOptions": [
                "Liver",
                "Gallbladder"
            ],
            "explanation": "The visible structures in this frame are: Liver, gallbladder, sludge/bile interface. Correct identification of these elements is vital for orienting yourself during scanning."
        },
        {
            "id": "sec4_q5",
            "type": "select_present_organs",
            "title": "Patient 54 Hepatic Vessel Image",
            "image": "/images/questions/sec4_q5.jpg",
            "questionText": "Observe the ultrasound image and select all organs, structures, or landmarks that are visible in this frame.",
            "options": [
                "Liver",
                "Portal/hepatic vessels",
                "Gallbladder",
                "Kidney",
                "Spleen",
                "Pancreas"
            ],
            "correctOptions": [
                "Liver"
            ],
            "explanation": "The visible structures in this frame are: Liver and vessels. Correct identification of these elements is vital for orienting yourself during scanning."
        },
        {
            "id": "sec4_q6",
            "type": "select_present_organs",
            "title": "Patient 10 Gallbladder Image",
            "image": "/images/questions/sec4_q6.jpg",
            "questionText": "Observe the ultrasound image and select all organs, structures, or landmarks that are visible in this frame.",
            "options": [
                "Liver",
                "Gallbladder",
                "Stone/sludge focus",
                "Kidney",
                "Spleen",
                "Urinary bladder"
            ],
            "correctOptions": [
                "Liver",
                "Gallbladder",
                "Stone/sludge focus"
            ],
            "explanation": "The visible structures in this frame are: Liver, gallbladder, stone/sludge focus. Correct identification of these elements is vital for orienting yourself during scanning."
        },
        {
            "id": "sec4_q7",
            "type": "select_present_organs",
            "title": "Patient 54 Kidney and Liver Region",
            "image": "/images/questions/sec4_q7.jpg",
            "questionText": "Observe the ultrasound image and select all organs, structures, or landmarks that are visible in this frame.",
            "options": [
                "Liver",
                "Right kidney",
                "Renal sinus",
                "Gallbladder",
                "Pancreas",
                "Spleen"
            ],
            "correctOptions": [
                "Liver",
                "Right kidney",
                "Renal sinus"
            ],
            "explanation": "The visible structures in this frame are: Liver, right kidney, renal sinus. Correct identification of these elements is vital for orienting yourself during scanning."
        },
        {
            "id": "sec4_q8",
            "type": "select_present_organs",
            "title": "Patient 55 Spleen Frame",
            "image": "/images/questions/sec4_q8.jpg",
            "questionText": "Observe the ultrasound image and select all organs, structures, or landmarks that are visible in this frame.",
            "options": [
                "Spleen",
                "Diaphragm",
                "Left upper quadrant soft tissue",
                "Gallbladder",
                "Urinary bladder",
                "Pancreas"
            ],
            "correctOptions": [
                "Spleen",
                "Diaphragm"
            ],
            "explanation": "The visible structures in this frame are: Spleen, diaphragm, LUQ tissue. Correct identification of these elements is vital for orienting yourself during scanning."
        },
        {
            "id": "sec4_q9",
            "type": "select_present_organs",
            "title": "Patient 161 Kidney and Collecting System",
            "image": "/images/questions/sec4_q9.jpg",
            "questionText": "Observe the ultrasound image and select all organs, structures, or landmarks that are visible in this frame.",
            "options": [
                "Kidney",
                "Renal pelvis/collecting system",
                "Renal cortex",
                "Liver",
                "Gallbladder",
                "Spleen"
            ],
            "correctOptions": [
                "Kidney",
                "Renal pelvis/collecting system",
                "Renal cortex"
            ],
            "explanation": "The visible structures in this frame are: Kidney, collecting system, cortex. Correct identification of these elements is vital for orienting yourself during scanning."
        },
        {
            "id": "sec4_q10",
            "type": "select_present_organs",
            "title": "Patient 10 Spleen Survey",
            "image": "/images/questions/sec4_q10.jpg",
            "questionText": "Observe the ultrasound image and select all organs, structures, or landmarks that are visible in this frame.",
            "options": [
                "Spleen",
                "Diaphragm",
                "Left upper quadrant tissue",
                "Gallbladder",
                "Right kidney",
                "Urinary bladder"
            ],
            "correctOptions": [
                "Spleen",
                "Diaphragm"
            ],
            "explanation": "The visible structures in this frame are: Spleen, diaphragm, LUQ tissue. Correct identification of these elements is vital for orienting yourself during scanning."
        }
    ]
};
