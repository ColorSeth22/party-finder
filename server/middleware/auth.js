import { requireAuth, optionalAuth } from '../../utils/auth.js';

export async function authRequired(req, res, next) {
  try {
    const result = await requireAuth(req);
    if (result.error) {
      return res.status(result.status || 401).json({ error: result.error });
    }
    req.user = result.user;
    next();
  } catch (err) {
    next(err);
  }
}

export async function authOptional(req, res, next) {
  try {
    const result = await optionalAuth(req);
    if (result.user) {
      req.user = result.user;
    }
    next();
  } catch (err) {
    next(err);
  }
}
