import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import express from "express";
import cors from "cors";
import multer from "multer";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const extractInfoFromText = (text) => {
    const extractedInfo = {
        fullName: null,
        documentNumber: null,
        expirationDate: null
    };

    const nameRegex = /name[:\s]+([^\n]+)/i;
    const docNumberRegex = /document\s+number[:\s]+([^\n]+)/i;
    const expirationRegex = /expiration\s+date[:\s]+([^\n]+)/i;

    const nameMatch = text.match(nameRegex);
    const docNumberMatch = text.match(docNumberRegex);
    const expirationMatch = text.match(expirationRegex);

    if (nameMatch) extractedInfo.fullName = nameMatch[1].trim();
    if (docNumberMatch) extractedInfo.documentNumber = docNumberMatch[1].trim();
    if (expirationMatch) extractedInfo.expirationDate = expirationMatch[1].trim();

    return extractedInfo;
};

const extractInfo = async (imageBuffer) => {
    try {
        const genAI = new GoogleGenerativeAI(process.env.API_KEY);
        const model = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Extract the following information from this document image and return it in JSON format:
        {
            "Name": "extracted name",
            "documentNumber": "extracted document number",
            "expirationDate": "extracted expiration date in YYYY-MM-DD format"
        }
        Only return the JSON object, no additional text.`;

        // Convert image buffer to base64
        const imageBase64 = imageBuffer.toString('base64');
        const imageData = {
            inlineData: {
                data: imageBase64,
                mimeType: 'image/png'
            }
        };

        const result = await model.generateContent([prompt, imageData]);

        // Parse the response from the model
        const text = result.response.text();
        console.log("Model response:", text);

        try {
            const extractedInfo = JSON.parse(text);            
            return extractedInfo;
        } catch (parseError) {
            // Fallback to regex extraction if JSON parsing fails
            const extractedInfo = extractInfoFromText(text);
            console.log("parse error");
            return extractedInfo;
        }

    } catch (error) {
        console.error("Error in extractInfo function:", error);
        throw new Error("Failed to process the document.");
    }
};

// Main extraction endpoint
app.post('/extract', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No document provided' });
        }

        const results = await extractInfo(req.file.buffer);

        console.log(results);
        
        if (!Object.values(results).some(value => value !== null)) {
            return res.status(400).json({
                error: 'Could not extract any information from the document'
            });
        }

        res.json(results);

    } catch (error) {
        console.error('Error processing document:', error);
        res.status(500).json({
            error: 'Error processing document',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
