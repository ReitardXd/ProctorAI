function authenticate(req, res, next) {
  if (!req.session?.userId)
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.session?.role !== role)
      return res.status(403).json({ error: 'Forbidden.' });
    next();
  };
}

module.exports = { authenticate, requireRole };
