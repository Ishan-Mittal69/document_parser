from flask import Flask, request, jsonify
from flask_cors import CORS
import pytesseract
from PIL import Image
import re
from datetime import datetime
import io
import os
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

def validate_date(date_str):
    """Validate if the string is a valid date and not expired."""
    try:
        # Try different date formats
        for fmt in ('%m/%d/%Y', '%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y'):
            try:
                date_obj = datetime.strptime(date_str, fmt)
                # Check if date is not expired
                if date_obj > datetime.now():
                    return date_str
                break
            except ValueError:
                continue
        return None
    except Exception as e:
        logger.error(f"Date validation error: {str(e)}")
        return None

def preprocess_image(image):
    """Preprocess image for better OCR results."""
    try:
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if image is too large
        max_size = 2000
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            image = image.resize(
                (int(image.size[0] * ratio), int(image.size[1] * ratio)),
                Image.Resampling.LANCZOS
            )
        
        return image
    except Exception as e:
        logger.error(f"Image preprocessing error: {str(e)}")
        raise

def extract_document_info(image_path):
    """Extract and validate document information using OCR."""
    try:
        # Preprocess image
        processed_image = preprocess_image(image_path)
        
        # Convert image to text
        logger.debug("Starting OCR processing")
        text = pytesseract.image_to_string(processed_image)
        logger.debug(f"Extracted text: {text[:]}") # Log first 200 chars
        
        lines = text.split('\n')
        
        # Initialize results
        results = {
            'name': None,
            'document_number': None,
            'expiration_date': None
        }
        
        # Common patterns
        name_patterns = [
            r'(?:NAME|GIVEN NAME|SURNAME)[\s:]*([\w\s]+)',
            r'(?:FIRST NAME|LAST NAME)[\s:]*([\w\s]+)',
            # ... add more patterns if necessary
        ]
        
        doc_number_patterns = [
            r'(?:DOCUMENT NO|PASSPORT NO|LICENSE NO|ID NO|ID NO\.|NO\.)[\s:]*([A-Z0-9/]+)',
            r'ID NO\.\s*:\s*([0-9]{4}/[0-9]{2})',
            # ... add more patterns if necessary
        ]
        
        date_patterns = [
            r'(?:EXPIRY DATE|EXPIRATION DATE|VALID UNTIL|VALID UPTO|VALID TO|VALID till | VALIDITY(NT) )[\s:]*([\d]{1,2}[-/][\d]{1,2}[-/][\d]{2,4})',
            r'(?:VALID THRU)[\s:]*([\d]{1,2}[-/][\d]{1,2}[-/][\d]{2,4})',
            # ... add more patterns if necessary
        ]
        
        # Extract information
        for line in lines:
            line = line.strip()
            
            # Extract name
            if not results['name']:
                for pattern in name_patterns:
                    match = re.search(pattern, line, re.IGNORECASE)
                    if match:
                        results['name'] = match.group(1).strip()
                        logger.debug(f"Found name: {results['name']}")
                        break
            
            # Extract document number
            if not results['document_number']:
                for pattern in doc_number_patterns:
                    match = re.search(pattern, line, re.IGNORECASE)
                    if match:
                        results['document_number'] = match.group(1).strip()
                        logger.debug(f"Found document number: {results['document_number']}")
                        break
            
            # Extract expiration date
            if not results['expiration_date']:
                for pattern in date_patterns:
                    match = re.search(pattern, line, re.IGNORECASE)
                    if match:
                        date_str = match.group(1).strip()
                        validated_date = validate_date(date_str)
                        if validated_date:
                            results['expiration_date'] = validated_date
                            logger.debug(f"Found expiration date: {results['expiration_date']}")
                            break
        
        return results
        
    except Exception as e:
        logger.error(f"Error in extract_document_info: {str(e)}")
        raise

@app.route('/extract', methods=['POST'])
def extract_info():
    try:
        # Validate request
        if 'document' not in request.files:
            return jsonify({'error': 'No document provided'}), 400
        
        file = request.files['document']
        
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        # Validate file type
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}
        if not ('.' in file.filename and 
                file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({'error': 'Invalid file type'}), 400
        
        # Process the image
        try:
            image = Image.open(io.BytesIO(file.read()))
        except Exception as e:
            logger.error(f"Error opening image: {str(e)}")
            return jsonify({'error': 'Invalid image file'}), 400
        
        # Extract information
        results = extract_document_info(image)
        print("extracted successfully")
        # Validate results
        if not any(results.values()):
            logger.info("no value populated")
            # return jsonify({
            #     'error': 'Could not extract any information from the document'
            # }), 400
        
        logger.info("Successfully processed document")
        return jsonify(results)
    
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'details': str(e) if app.debug else None
        }), 500

if __name__ == '__main__':
    # Print important information at startup
    logger.info("Starting Document Scanner API")
    logger.info(f"Python version: {sys.version}")
    logger.info(f"PIL version: {Image.__version__}")
    logger.info(f"Tesseract version: {pytesseract.get_tesseract_version()}")
    
    app.run(debug=True)