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

    // 1. Hardened Extraction Pipeline with Fallback Safe-guards
    let resumeText = '';
    try {
      const pdfData = await pdfParse(file.buffer);
      resumeText = pdfData.text;
    } catch (parseError) {
      console.error("PDF Parser Library Failure:", parseError);
      return res.status(400).json({ error: 'Unable to extract text layout structure from this specific PDF template. Please try resaving or changing your file format.' });
    }

    if (!resumeText || !resumeText.trim()) {
      return res.status(400).json({ error: 'Failed to extract plain-text from the uploaded PDF document structure.' });
    }

    // 2. Safe verification of the API Key layer
    if (!process.env.GEMINI_API_KEY) {
      console.error("Missing GEMINI_API_KEY inside Render Environment Panel.");
      return res.status(500).json({ error: 'AI engine authentication mismatch in cloud config.' });
    }

    const model = ai.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are an elite corporate recruiter and ATS optimization algorithm. 
      Analyze the following Resume against the given Job Description.
      
      Resume Text: "${resumeText.replace(/"/g, '\\"')}"
      Job Description: "${jobDescription.replace(/"/g, '\\"')}"
      
      You MUST respond with a valid JSON object matching the exact structure below. 
      CRITICAL RULE FOR "currentText": This field MUST contain the EXACT, LITERAL, WORD-FOR-WORD substring taken directly from the provided Resume text that you intend to optimize. Do not paraphrase, alter punctuation, or summarize the original text in the "currentText" field, otherwise string replacement engines will break.

      {
        "matchPercentage": 85,
        "summary": "Provide a comprehensive, professional summary explaining the resume's match status against the target profile.",
        "strengths": ["list item 1", "list item 2"],
        "weaknesses": ["list item 1", "list item 2"],
        "missingKeywords": ["keyword1", "keyword2"],
        "actionableImprovements": [
          { 
            "section": "Experience", 
            "currentText": "exact weak bullet point text from resume string", 
            "suggestedText": "optimized bullet point incorporating action verbs and metrics" 
          }
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();
    
    responseText = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();

    let analysisResult;
    try {
      analysisResult = JSON.parse(responseText);
    } catch (parseError) {
      console.error("JSON Parsing failed. Raw AI text dump was:", responseText);
      return res.status(500).json({ error: 'AI engine generated a malformed schema layout. Please run the analysis check again.' });
    }

    // 3. Robust Mongoose Database Persistence Injection
    const savedScan = await Scan.create({
      userId: req.user._id, 
      fileName: file.originalname || 'Uploaded_Resume.pdf',
      jobDescription: jobDescription,
      resumeRawText: resumeText,
      matchPercentage: analysisResult.matchPercentage || 50,
      summary: analysisResult.summary || 'Analysis complete.',
      strengths: analysisResult.strengths || [],
      weaknesses: analysisResult.weaknesses || [],
      missingKeywords: analysisResult.missingKeywords || [],
      actionableImprovements: analysisResult.actionableImprovements || []
    });

    return res.json(savedScan);
  } catch (error) {
    console.error("Pipeline Exception Failure:", error);
    return res.status(500).json({ error: 'Internal server engine fault occurred during data mapping.' });
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