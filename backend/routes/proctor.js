const express = require('express');
const { authenticate, requireRole } = require('../middleware/authenticate');
const router = express.Router();

// POST /api/proctor/analyze — receives frame from frontend, forwards to Python AI service
router.post('/analyze', authenticate, requireRole('student'), async (req, res) => {
  const { frame } = req.body;
  if (!frame) return res.status(400).json({ error: 'No frame provided' });

  try {
    const response = await fetch('http://localhost:5000/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame }),
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    console.error('AI service error:', err.message);
    res.status(503).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
