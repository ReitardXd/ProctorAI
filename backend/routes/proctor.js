const express = require('express');
const { authenticate, requireRole } = require('../middleware/authenticate');
const pool = require('../db');
const router = express.Router();

// POST /api/proctor/analyze — forward frame to Python AI service + log violations
router.post('/analyze', authenticate, requireRole('student'), async (req, res) => {
  const { frame, exam_id } = req.body;
  if (!frame) return res.status(400).json({ error: 'No frame provided' });

  try {
    const response = await fetch('http://127.0.0.1:5000/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame }),
    });
    const result = await response.json();

    // Log any violation to incidents table
    const violation = !result.face_detected ? 'Face Not Detected'
      : result.multiple_faces               ? 'Multiple Faces Detected'
      : result.looking_away                 ? 'Looking Away'
      : null;

    if (violation) {
      const severity = violation === 'Multiple Faces Detected' ? 'critical'
        : violation === 'Face Not Detected' ? 'high'
        : 'medium';

      await pool.query(
        `INSERT INTO incidents (student_id, exam_id, violation, confidence, severity)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.session.userId, exam_id || 1, violation, 88, severity]
      );
    }

    res.json({ ...result, violation });
  } catch (err) {
    console.error('AI service error:', err.message);
    res.status(503).json({ error: 'AI service unavailable' });
  }
});

// GET /api/proctor/incidents — admin fetches all incidents
router.get('/incidents', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.id, i.violation, i.confidence, i.severity, i.timestamp,
              u.name as student_name, u.username,
              e.title as exam_title
       FROM incidents i
       JOIN users u ON u.id = i.student_id
       JOIN exams e ON e.id = i.exam_id
       ORDER BY i.timestamp DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// DELETE /api/proctor/incidents/:id — admin removes an incident
router.delete('/incidents/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM incidents WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
