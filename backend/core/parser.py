import fitz  # PyMuPDF
import docx2txt
import os

def extract_text(file_path: str) -> str:
    """ It extracts words on PDF or DOCX files."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        text = ""
        with fitz.open(file_path) as pdf:
            for page in pdf:
                text += page.get_text()
        return text

    elif ext == ".docx":
        return docx2txt.process(file_path)

    else:
        raise ValueError("Unsupported file type! Only PDF or DOCX allowed.")
