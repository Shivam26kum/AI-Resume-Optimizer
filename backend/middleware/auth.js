import jwt from 'jsonwebtoken';

export const protect = async (req, res, next) => {
  let token;

  // Check if token is sent in the Request Headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      
      // Decrypt and verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Attach the verified user ID directly to the request object
      req.user = { id: decoded.id };
      
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Not authorized, token validation failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, token missing' });
  }
};