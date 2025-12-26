import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import User, { IUser } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

const rpName = process.env.WEBAUTHN_RP_NAME || 'Slatefolio';
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:8080';

const generateToken = (user: IUser): string => {
  return jwt.sign(
    { userId: user._id, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const setTokenCookie = (res: Response, token: string): void => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// Check auth status and if users exist
export const getStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userCount = await User.countDocuments();
    const hasUsers = userCount > 0;

    // Check if user is logged in via cookie
    const token = req.cookies?.token;
    let isLoggedIn = false;
    let user = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
        const foundUser = await User.findById(decoded.userId).select('-passwordHash -currentChallenge');
        if (foundUser) {
          isLoggedIn = true;
          user = {
            id: foundUser._id,
            username: foundUser.username,
            email: foundUser.email,
          };
        }
      } catch {
        // Invalid token, clear it
        res.clearCookie('token');
      }
    }

    res.json({ hasUsers, isLoggedIn, user });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Register first admin (only works when no users exist)
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    // Check if users already exist
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      res.status(403).json({ error: 'Admin user already exists' });
      return;
    }

    // Validate input
    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      username,
      email,
      passwordHash,
      passkeys: [],
    });

    await user.save();

    // Generate token and set cookie
    const token = generateToken(user);
    setTokenCookie(res, token);

    res.status(201).json({
      message: 'Admin user created successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error: unknown) {
    console.error('Registration error:', error);
    if (error instanceof Error && 'code' in error && (error as { code: number }).code === 11000) {
      res.status(409).json({ error: 'Username or email already exists' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Password login
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    // Find user by username or email
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate token and set cookie
    const token = generateToken(user);
    setTokenCookie(res, token);

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Logout
export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
};

// Generate passkey registration options
export const passkeyRegisterOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(user._id.toString()),
      userName: user.username,
      userDisplayName: user.username,
      attestationType: 'none',
      excludeCredentials: user.passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Store challenge for verification
    user.currentChallenge = options.challenge;
    await user.save();

    res.json(options);
  } catch (error) {
    console.error('Passkey registration options error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify and save passkey registration
export const passkeyRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await User.findById(decoded.userId);

    if (!user || !user.currentChallenge) {
      res.status(400).json({ error: 'No registration in progress' });
      return;
    }

    const response: RegistrationResponseJSON = req.body;

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'Verification failed' });
      return;
    }

    const { credential } = verification.registrationInfo;

    // Save the passkey
    user.passkeys.push({
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      transports: response.response.transports,
    });
    user.currentChallenge = undefined;
    await user.save();

    res.json({ message: 'Passkey registered successfully' });
  } catch (error) {
    console.error('Passkey registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Generate passkey login options
export const passkeyLoginOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.body;

    // Find user if username provided
    let user = null;
    if (username) {
      user = await User.findOne({
        $or: [{ username }, { email: username }],
      });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: user?.passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports,
      })) || [],
      userVerification: 'preferred',
    });

    // Store challenge if we have a user
    if (user) {
      user.currentChallenge = options.challenge;
      await user.save();
    }

    res.json({ options, hasUser: !!user });
  } catch (error) {
    console.error('Passkey login options error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify passkey login
export const passkeyLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, response: authResponse }: { username?: string; response: AuthenticationResponseJSON } = req.body;

    // Find user by credential ID or username
    let user = null;
    if (username) {
      user = await User.findOne({
        $or: [{ username }, { email: username }],
      });
    } else {
      // Try to find by credential ID
      user = await User.findOne({
        'passkeys.credentialId': authResponse.id,
      });
    }

    if (!user || !user.currentChallenge) {
      res.status(400).json({ error: 'No login in progress' });
      return;
    }

    const passkey = user.passkeys.find((p) => p.credentialId === authResponse.id);
    if (!passkey) {
      res.status(400).json({ error: 'Passkey not found' });
      return;
    }

    const verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: Buffer.from(passkey.publicKey, 'base64'),
        counter: passkey.counter,
        transports: passkey.transports,
      },
    });

    if (!verification.verified) {
      res.status(400).json({ error: 'Verification failed' });
      return;
    }

    // Update counter
    passkey.counter = verification.authenticationInfo.newCounter;
    user.currentChallenge = undefined;
    await user.save();

    // Generate token and set cookie
    const token = generateToken(user);
    setTokenCookie(res, token);

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Passkey login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getStatus,
  register,
  login,
  logout,
  passkeyRegisterOptions,
  passkeyRegister,
  passkeyLoginOptions,
  passkeyLogin,
};

