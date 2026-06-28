import mongoose from 'mongoose';

const ActionableImprovementSchema = new mongoose.Schema({
  section: { type: String, default: 'Experience' },
  currentText: { type: String, required: true },
  suggestedText: { type: String, required: true }
});

const ScanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true },
  jobDescription: { type: String, required: true },
  
  // INJECTED: Stores the true word-for-word text structure parsed from your uploaded PDF
  resumeRawText: { type: String, required: true },
  
  matchPercentage: { type: Number, required: true },
  summary: { type: String, required: true },
  strengths: [{ type: String }],
  weaknesses: [{ type: String }],
  missingKeywords: [{ type: String }],
  actionableImprovements: [ActionableImprovementSchema],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Scan = mongoose.model('Scan', ScanSchema);
export default Scan;