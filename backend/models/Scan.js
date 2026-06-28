import mongoose from 'mongoose';

const ScanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  jobDescription: {
    type: String,
    required: true
  },
  resumeRawText: {
    type: String,
    required: true
  },
  matchPercentage: {
    type: Number,
    default: 0
  },
  summary: {
    type: String,
    default: ''
  },
  strengths: {
    type: [String],
    default: []
  },
  weaknesses: {
    type: [String],
    default: []
  },
  missingKeywords: {
    type: [String],
    default: []
  },
  actionableImprovements: [
    {
      section: { type: String, default: 'General' },
      currentText: { type: String, default: '' },
      suggestedText: { type: String, default: '' }
    }
  ]
}, { timestamps: true });

export default mongoose.model('Scan', ScanSchema);