const VALID_ROLES = ['student', 'admin'];

function authenticate(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  
  // Validate role is legitimate
  if (!VALID_ROLES.includes(req.session.role)) {
    return res.status(401).json({ error: 'Invalid session. Please log in again.' });
  }
  
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    
    if (!VALID_ROLES.includes(req.session.role)) {
      return res.status(401).json({ error: 'Invalid session. Please log in again.' });
    }
    
    if (req.session.role !== role) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    
    next();
  };
}

module.exports = { authenticate, requireRole };
