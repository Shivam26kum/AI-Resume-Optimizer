import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleGenerativeAI } from '@google/generative-ai';
import connectDB from './db.js';
import Scan from './models/Scan.js';
import User from './models/User.js';
import { protect } from './middleware/auth.js';

// Setup old CommonJS require bridge globally at the top level
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

dotenv.config();

// Connect to MongoDB Cloud Atlas
connectDB();

const app = express();

// ====================================================
// IRONCLAD HANDMADE CORS & PREFLIGHT OPTIONS INTERCEPTOR
// ====================================================
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://ai-resume-optimizer-beta-six.vercel.app',
    'https://ai-resume-optimizer-inky.vercel.app',
    process.env.CLIENT_ORIGIN
  ];

  if (origin) {
    if (allowedOrigins.includes(origin) || (origin.includes('ai-resume-optimizer') && origin.includes('.vercel.app'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Safe initialization of Gemini API client
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to generate signed JWTs
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// ==========================================
// AUTHENTICATION ROUTE: USER REGISTRATION
// ==========================================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Please enter all registration fields' });
    }

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ error: 'Username or Email identity already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ username, email, password: hashedPassword });

    return res.status(201).json({
      token: generateToken(user._id),
      username: user.username
    });
  } catch (error) {
    console.error("Registration Failure:", error);
    return res.status(500).json({ error: 'Server authentication initialization fault' });
  }
});

// ==========================================
// AUTHENTICATION ROUTE: USER LOGIN
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid email credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid password credentials' });

    return res.json({
      token: generateToken(user._id),
      username: user.username
    });
  } catch (error) {
    console.error("Login Failure:", error);
    return res.status(500).json({ error: 'Server validation sequence failure' });
  }
});

// ==========================================
// RUN RESUME ANALYSIS (PROTECTED WITH AUTH)
// ==========================================
app.post('/api/analyze', protect, upload.single('resume'), async (req, res) => {
  try {
    const { jobDescription } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Please upload a resume file' });
    }
    if (!jobDescription || !jobDescription.trim()) {
      return res.status(400).json({ error: 'Please provide a target job description' });
    }

    // 1. Safe Robust Text Extraction Fallback Configuration
    let resumeText = '';
    try {
      const pdfData = await pdfParse(file.buffer);
      resumeText = pdfData.text;
    } catch (parseError) {
      console.warn("PDF Parser struggled with layout parsing, fallback processing active:", parseError.message);
      // Fallback: convert complex binary string array cleanly to readable text tokens
      resumeText = file.buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r]/g, ' ');
    }

    if (!resumeText || !resumeText.trim()) {
      // Final fallback safety mechanism
      resumeText = file.buffer.toString('ascii').replace(/[^\x20-\x7E\n\r]/g, ' ');
    }

    if (!resumeText.trim()) {
      return res.status(400).json({ error: 'Unable to parse text from document. Please use a clean font layout.' });
    }

    // 2. Safeguard AI configuration state
    if (!process.env.GEMINI_API_KEY) {
      console.error("CRITICAL ERROR: GEMINI_API_KEY is missing from environment variables.");
      return res.status(500).json({ error: 'AI Client initialization variable mismatch.' });
    }

    const model = ai.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const cleanResume = resumeText.replace(/["\\\r\n]/g, ' ');
    const cleanJD = jobDescription.replace(/["\\\r\n]/g, ' ');

    const prompt = `
      You are an elite corporate recruiter and ATS optimization algorithm. 
      Analyze the following Resume against the given Job Description.
      
      Resume Text: "${cleanResume}"
      Job Description: "${cleanJD}"
      
      You MUST respond with a valid JSON object matching the exact structure below.
      All JSON properties must be present.

      {
        "matchPercentage": 85,
        "summary": "Provide a comprehensive, professional summary explaining the resume's match status against the target profile.",
        "strengths": ["list item 1", "list item 2"],
        "weaknesses": ["list item 1", "list item 2"],
        "missingKeywords": ["keyword1", "keyword2"],
        "actionableImprovements": [
          { 
            "section": "Experience", 
            "currentText": "exact weak text from resume", 
            "suggestedText": "optimized text" 
          }
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();
    
    const jsonStartIndex = responseText.indexOf('{');
    const jsonEndIndex = responseText.lastIndexOf('}');
    
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
      console.error("AI returned malformed data block:", responseText);
      return res.status(500).json({ error: 'AI model failed to respond with a clean data structure.' });
    }
    
    responseText = responseText.substring(jsonStartIndex, jsonEndIndex + 1);

    let analysisResult;
    try {
      analysisResult = JSON.parse(responseText);
    } catch (parseError) {
      console.error("JSON Parsing failed. Raw block was:", responseText);
      return res.status(500).json({ error: 'AI data mapping parsing crash.' });
    }

    // 3. Cast values into absolute type layouts
    const scanPayload = {
      userId: req.user._id, 
      fileName: file.originalname || 'Resume.pdf',
      jobDescription: jobDescription,
      resumeRawText: resumeText,
      matchPercentage: Number(analysisResult.matchPercentage) || 0,
      summary: String(analysisResult.summary || 'Analysis sequence baseline execution finalized.'),
      strengths: Array.isArray(analysisResult.strengths) ? analysisResult.strengths.map(String) : [],
      weaknesses: Array.isArray(analysisResult.weaknesses) ? analysisResult.weaknesses.map(String) : [],
      missingKeywords: Array.isArray(analysisResult.missingKeywords) ? analysisResult.missingKeywords.map(String) : [],
      actionableImprovements: Array.isArray(analysisResult.actionableImprovements) 
        ? analysisResult.actionableImprovements.map(item => ({
            section: String(item.section || 'General'),
            currentText: String(item.currentText || ''),
            suggestedText: String(item.suggestedText || '')
          }))
        : []
    };

    try {
      const savedScan = await Scan.create(scanPayload);
      return res.json(savedScan);
    } catch (dbError) {
      console.error("Mongoose Scan Insertion Failure:", dbError);
      return res.status(500).json({ error: 'Database pipeline failed to validate data types.' });
    }
  } catch (error) {
    console.error("Fatal Top-Level Route Failure:", error);
    return res.status(500).json({ error: 'Internal system pipeline engine error.' });
  }
});

// ==========================================
// GET HISTORY LIST (PROTECTED FOR RELEVANT USER ONLY)
// ==========================================
app.get('/api/history', protect, async (req, res) => {
  try {
    const history = await Scan.find({ userId: req.user._id })
                              .sort({ createdAt: -1 })
                              .select('fileName matchPercentage createdAt summary'); 
    return res.json(history);
  } catch (error) {
    console.error("Fetch History Error:", error);
    return res.status(500).json({ error: 'Failed to access structural tracking index' });
  }
});

// ==========================================
// GET SPECIFIC RECORD DETAILS (PROTECTED)
// ==========================================
app.get('/api/history/:id', protect, async (req, res) => {
  try {
    const scan = await Scan.findOne({ _id: req.params.id, userId: req.user._id });
    if (!scan) return res.status(404).json({ error: 'Record profile tracing parameters rejected' });
    return res.json(scan);
  } catch (error) {
    console.error("Fetch Single Record Error:", error);
    return res.status(500).json({ error: 'Record access initialization fault' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Secure Server processing active on port ${PORT}`));