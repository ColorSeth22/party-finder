import jwt from 'jsonwebtoken';

export async function requireAuth(req) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader) {
      return { error: 'Authentication required', status: 401 };
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return { error: 'Invalid authorization format. Use: Bearer <token>', status: 401 };
    }

    const token = parts[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    return {
      user: {
        user_id: decoded.user_id,
        email: decoded.email
      }
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { error: 'Token expired. Please log in again.', status: 401 };
    }
    if (error.name === 'JsonWebTokenError') {
      return { error: 'Invalid token', status: 401 };
    }
    console.error('Auth middleware error:', error);
    return { error: 'Authentication failed', status: 401 };
  }
}

export async function optionalAuth(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader) {
    return { user: null };
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return { user: null };
  }

  try {
    const token = parts[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      user: {
        user_id: decoded.user_id,
        email: decoded.email
      }
    };
  } catch (error) {
    return { user: null };
  }
}
