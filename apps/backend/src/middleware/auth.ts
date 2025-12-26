import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    
    // Verify user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.clearCookie('token');
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.clearCookie('token');
    res.status(401).json({ error: 'Invalid token' });
  }
};

export default { requireAuth };

