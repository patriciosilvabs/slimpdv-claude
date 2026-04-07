import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../database/client.js';
import { generateToken, generateRefreshToken, verifyToken, AuthRequest, authMiddleware } from '../auth/jwt.js';
import { authMiddleware as authMiddlewareHandler } from './middleware.js';

const router = Router();

interface LoginRequest extends Request {
  body: {
    email: string;
    password: string;
  };
}

interface RegisterRequest extends Request {
  body: {
    email: string;
    password: string;
    name: string;
    tenant_id?: string;
  };
}

// Login
router.post('/login', async (req: LoginRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Buscar usuário na tabela profiles (migrada do Supabase)
    const result = await query(
      `SELECT p.id, p.email, p.encrypted_password, p.role, t.id as tenant_id
       FROM profiles p
       LEFT JOIN tenants t ON p.tenant_id = t.id
       WHERE p.email = $1`,
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Comparar senha
    const passwordMatch = await bcrypt.compare(password, user.encrypted_password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Gerar tokens
    const token = generateToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
    });

    const refreshToken = generateRefreshToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
      },
      token,
      refreshToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Register
router.post('/register', async (req: RegisterRequest, res: Response) => {
  try {
    const { email, password, name, tenant_id } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Verificar se email existe
    const existing = await query('SELECT id FROM profiles WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário
    const result = await query(
      `INSERT INTO profiles (email, encrypted_password, full_name, role, tenant_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, tenant_id`,
      [email, hashedPassword, name || email, 'user', tenant_id || null]
    );

    const newUser = result.rows[0];

    const token = generateToken({
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
      tenant_id: newUser.tenant_id,
    });

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        tenant_id: newUser.tenant_id,
      },
      token,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const payload = verifyToken(refreshToken);
    const newToken = generateToken({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      tenant_id: payload.tenant_id,
    });

    res.json({ token: newToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Get current user
router.get('/me', authMiddlewareHandler, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({
    user: {
      id: req.user.sub,
      email: req.user.email,
      role: req.user.role,
      tenant_id: req.user.tenant_id,
    },
  });
});

// Logout (client-side, mas pode ser usado para invalidar refresh tokens)
router.post('/logout', authMiddlewareHandler, (req: AuthRequest, res: Response) => {
  // Em um cenário real, você marcaria o refresh token como inválido
  // Por enquanto, apenas retornamos sucesso
  res.json({ message: 'Logged out successfully' });
});

export default router;
