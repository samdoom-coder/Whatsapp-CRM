import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  registerSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
} from './auth.service.js';

const router = Router();

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const result = await register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const result = await login(req.body, req.ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', validate(forgotSchema), async (req, res, next) => {
  try {
    const result = await forgotPassword(req.body.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', validate(resetSchema), async (req, res, next) => {
  try {
    const result = await resetPassword(req.body.token, req.body.password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await getMe(req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authenticate, (_req, res) => {
  // Stateless JWT: client discards the token. Reserved for future revocation via Redis.
  res.json({ ok: true });
});

export default router;