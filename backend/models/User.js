import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: [true, 'Please provide a username'], 
    unique: true,
    trim: true
  },
  email: { 
    type: String, 
    required: [true, 'Please provide an email'], 
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address'
    ]
  },
  password: { 
    type: String, 
    required: [true, 'Please provide a password'],
    minlength: 6
  }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
export default User;