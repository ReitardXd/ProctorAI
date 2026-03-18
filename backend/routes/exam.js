const express = require('express');
const pool    = require('../db');
const { encrypt, decrypt } = require('../utils/encrypt');
const { authenticate, requireRole } = require('../middleware/authenticate');
const router  = express.Router();

router.post('/submit', authenticate, requireRole('student'), async (req, res) => {
  const { exam_id, answers } = req.body;
  if (!exam_id || !answers)
    return res.status(400).json({ error: 'exam_id and answers required.' });
  try {
    const encrypted = encrypt(answers);
    const result = await pool.query(
      `INSERT INTO exam_submissions (exam_id, student_id, answers)
       VALUES ($1, $2, $3) RETURNING id, submitted_at`,
      [exam_id, req.session.userId, encrypted]
    );
    res.json({ success: true, submission_id: result.rows[0].id, submitted_at: result.rows[0].submitted_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/submissions', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT es.id, es.submitted_at, es.score,
              u.name as student_name, u.username,
              e.title as exam_title
       FROM exam_submissions es
       JOIN users u ON u.id = es.student_id
       JOIN exams e ON e.id = es.exam_id
       ORDER BY es.submitted_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
