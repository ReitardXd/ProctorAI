const express = require('express');
const rateLimit = require('express-rate-limit');
const pool    = require('../db');
const { encrypt, decrypt } = require('../utils/encrypt');
const { authenticate, requireRole } = require('../middleware/authenticate');
const router  = express.Router();

// Rate limiting for submissions
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 submissions per exam per hour
  message: { error: 'Too many submissions. Please try again later.' },
  standardHeaders: true,
  keyGenerator: (req) => `${req.session?.userId}:${req.body?.exam_id}`
});

// Validate exam submission input
function validateSubmission(exam_id, answers) {
  if (!exam_id || typeof exam_id !== 'number' || exam_id <= 0) {
    return 'Invalid exam_id';
  }
  
  if (!Array.isArray(answers)) {
    return 'Answers must be an array';
  }
  
  if (answers.length === 0) {
    return 'Answers array cannot be empty';
  }
  
  return null;
}

router.post('/submit', authenticate, requireRole('student'), submitLimiter, async (req, res) => {
  const { exam_id, answers } = req.body;
  const studentId = req.session.userId;
  
  // Validate input
  const validationError = validateSubmission(exam_id, answers);
  if (validationError) {
    console.warn(`[WARN] Invalid submission from student ${studentId}: ${validationError}`);
    return res.status(400).json({ error: validationError });
  }
  
  try {
    // Check if exam exists
    const examCheck = await pool.query('SELECT id FROM exams WHERE id = $1', [exam_id]);
    if (examCheck.rows.length === 0) {
      console.warn(`[WARN] Exam ${exam_id} not found for submission by student ${studentId}`);
      return res.status(404).json({ error: 'Exam not found' });
    }
    
    // Check for duplicate submission
    const dupCheck = await pool.query(
      'SELECT id FROM exam_submissions WHERE exam_id = $1 AND student_id = $2',
      [exam_id, studentId]
    );
    if (dupCheck.rows.length > 0) {
      console.warn(`[WARN] Duplicate submission attempt from student ${studentId} for exam ${exam_id}`);
      return res.status(409).json({ error: 'Exam already submitted' });
    }
    
    const encrypted = encrypt(answers);
    const result = await pool.query(
      `INSERT INTO exam_submissions (exam_id, student_id, answers)
       VALUES ($1, $2, $3) RETURNING id, submitted_at`,
      [exam_id, studentId, encrypted]
    );
    
    console.log(`[INFO] Exam submitted: student=${studentId}, exam=${exam_id}, submission_id=${result.rows[0].id}`);
    
    res.json({ 
      success: true, 
      submission_id: result.rows[0].id, 
      submitted_at: result.rows[0].submitted_at 
    });
  } catch (err) {
    console.error('[ERROR] Exam submit error:', err);
    res.status(500).json({ error: 'Failed to submit exam' });
  }
});

router.get('/submissions', authenticate, requireRole('admin'), async (req, res) => {
  try {
    // Add pagination
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    console.log(`[INFO] Admin fetching submissions: limit=${limit}, offset=${offset}`);
    
    const result = await pool.query(
      `SELECT es.id, es.submitted_at, es.score,
              u.name as student_name, u.username, u.id as student_id,
              e.title as exam_title, e.id as exam_id
       FROM exam_submissions es
       JOIN users u ON u.id = es.student_id
       JOIN exams e ON e.id = es.exam_id
       ORDER BY es.submitted_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    const countResult = await pool.query('SELECT COUNT(*) FROM exam_submissions');
    const total = parseInt(countResult.rows[0].count);
    
    res.json({ 
      data: result.rows, 
      total, 
      limit, 
      offset 
    });
  } catch (err) {
    console.error('[ERROR] Get submissions error:', err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

module.exports = router;
