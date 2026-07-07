import sys
import json
import base64
import os
import uuid
import re
from docx import Document

def parse_docx(file_path):
    try:
        doc = Document(file_path)
    except Exception as e:
        print(json.dumps({"error": f"Failed to open document: {str(e)}"}))
        sys.exit(1)

    questions = []
    current_q = None

    # Temp dir for images
    temp_img_dir = os.path.join(os.path.dirname(file_path), "temp_images")
    os.makedirs(temp_img_dir, exist_ok=True)

    for para in doc.paragraphs:
        # Extract images from runs
        for run in para.runs:
            drawing_nodes = run._r.findall('.//w:drawing', namespaces=run._r.nsmap)
            for drawing in drawing_nodes:
                blip_nodes = drawing.findall('.//a:blip', namespaces={'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'})
                for blip in blip_nodes:
                    embed_id = blip.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                    if embed_id and embed_id in doc.part.related_parts:
                        image_part = doc.part.related_parts[embed_id]
                        image_bytes = image_part.blob
                        ext = image_part.content_type.split('/')[-1]
                        if ext == 'jpeg': ext = 'jpg'
                        
                        img_filename = f"{uuid.uuid4().hex}.{ext}"
                        img_path = os.path.join(temp_img_dir, img_filename)
                        
                        with open(img_path, 'wb') as f:
                            f.write(image_bytes)
                        
                        # Associate image with current question
                        if current_q is not None:
                            current_q["tempImage"] = img_path

        text = para.text.strip()
        if not text:
            continue

        # Look for [Q]
        if text.startswith("[Q]"):
            # If previous question exists, validate it
            if current_q is not None:
                if not current_q.get("answerKey"):
                    current_q["validationError"] = "Missing [ANS] tag"
                questions.append(current_q)
            
            q_text = text[3:].strip()
            # It's possible the [Q] is just the marker and the question text is on the same line or next line.
            current_q = {
                "type": "MCQ",
                "text": q_text,
                "marks": 1,
                "options": [],
                "answerKey": None
            }
        
        elif current_q is not None:
            # Look for options like [A], [B], [C], [D]
            match = re.match(r"^\[([A-Z])\](.*)", text)
            if match:
                opt_letter = match.group(1)
                opt_text = match.group(2).strip()
                current_q["options"].append(opt_text)
                # Ensure type is MCQ (it is by default)
            elif text.startswith("[ANS]"):
                ans_text = text[5:].strip()
                # ans_text could be the option letter or the text. Let's just store the exact string for now.
                # If they write [ANS] A, we can map it to the first option.
                current_q["answerKey"] = ans_text
            elif text.startswith("[IMG]"):
                # Placeholder for image, we can just note it if they didn't embed
                current_q["hasImagePlaceholder"] = True
            else:
                # If it doesn't match a tag, but we are inside a question, it might be continuation of question text
                # Only append if we haven't seen any options yet
                if len(current_q["options"]) == 0:
                    current_q["text"] += "\n" + text

    # Push the last question
    if current_q is not None:
        if not current_q.get("answerKey"):
            current_q["validationError"] = "Missing [ANS] tag"
        questions.append(current_q)

    # Post-process answer keys if they are just letters (A, B, C, D)
    for q in questions:
        if q.get("answerKey") and len(q["answerKey"]) == 1 and q["answerKey"].upper() in "ABCDEF":
            idx = ord(q["answerKey"].upper()) - ord('A')
            if 0 <= idx < len(q["options"]):
                q["answerKey"] = q["options"][idx]

    print(json.dumps({"status": "success", "data": questions}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(json.dumps({"error": "File does not exist"}))
        sys.exit(1)
        
    parse_docx(file_path)
