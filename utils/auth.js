import jwt from 'jsonwebtoken';

export async function requireAuth(req) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    console.log('[requireAuth] Headers:', {
      hasAuth: !!authHeader,
      authPreview: authHeader ? authHeader.substring(0, 30) + '...' : 'missing',
      allHeaders: Object.keys(req.headers),
      hasJwtSecret: !!process.env.JWT_SECRET,
    });

    if (!authHeader) {
      console.log('[requireAuth] No authorization header found');
      return { error: 'Authentication required', status: 401 };
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.log('[requireAuth] Invalid auth format:', { parts });
      return { error: 'Invalid authorization format. Use: Bearer <token>', status: 401 };
    }

    const token = parts[1];
    console.log('[requireAuth] Token received, length:', token.length);
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[requireAuth] Token verified successfully:', { user_id: decoded.user_id, email: decoded.email });

    return {
      user: {
        user_id: decoded.user_id,
        email: decoded.email
      }
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('[requireAuth] Token expired');
      return { error: 'Token expired. Please log in again.', status: 401 };
    }
    if (error.name === 'JsonWebTokenError') {
      console.log('[requireAuth] Invalid JWT:', error.message);
      return { error: 'Invalid token', status: 401 };
    }
    console.error('[requireAuth] Auth middleware error:', error);
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
