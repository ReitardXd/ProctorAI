const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, requireRole } = require('../middleware/authenticate');
const pool = require('../db');
const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';
const AI_TIMEOUT = 10000; // 10 second timeout

// Rate limiting for analysis (prevent frame spam)
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Max 20 analysis requests per minute per student
  message: { error: 'Too many analysis requests. Please wait.' },
  standardHeaders: true,
  keyGenerator: (req) => req.session?.userId
});

// Severity mapping configuration
const SEVERITY_MAP = {
  'Multiple Faces Detected': 'critical',
  'Face Not Detected': 'high',
  'Looking Away': 'medium'
};

// POST /api/proctor/analyze — forward frame to Python AI service + log violations
router.post('/analyze', authenticate, requireRole('student'), analyzeLimiter, async (req, res) => {
  const { frame, exam_id } = req.body;
  const studentId = req.session.userId;
  
  if (!frame) {
    console.warn(`[WARN] No frame provided in analyze request from student ${studentId}`);
    return res.status(400).json({ error: 'No frame provided' });
  }
  
  // Validate exam_id if provided
  if (exam_id && (typeof exam_id !== 'number' || exam_id <= 0)) {
    console.warn(`[WARN] Invalid exam_id in analyze request from student ${studentId}`);
    return res.status(400).json({ error: 'Invalid exam_id' });
  }

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT);

    const response = await fetch(`${AI_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[ERROR] AI service returned ${response.status}`);
      return res.status(503).json({ error: 'AI service unavailable' });
    }

    const result = await response.json();

    // Log any violation to incidents table
    const violation = !result.face_detected ? 'Face Not Detected'
      : result.multiple_faces               ? 'Multiple Faces Detected'
      : result.looking_away                 ? 'Looking Away'
      : null;

    if (violation && exam_id) {
      const severity = SEVERITY_MAP[violation] || 'medium';
      const confidence = result.confidence || 50;

      try {
        await pool.query(
          `INSERT INTO incidents (student_id, exam_id, violation, confidence, severity)
           VALUES ($1, $2, $3, $4, $5)`,
          [studentId, exam_id, violation, confidence, severity]
        );
        console.log(`[WARN] Incident logged: student=${studentId}, exam=${exam_id}, violation=${violation}, severity=${severity}`);
      } catch (dbErr) {
        console.error('[ERROR] Failed to log incident:', dbErr);
        // Don't fail the request just because logging failed
      }
    }

    res.json({ 
      face_detected: result.face_detected,
      multiple_faces: result.multiple_faces,
      looking_away: result.looking_away,
      face_count: result.face_count,
      violation 
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[ERROR] AI service request timeout for student', studentId);
      return res.status(503).json({ error: 'AI service timeout' });
    }
    console.error('[ERROR] AI service error:', err.message);
    res.status(503).json({ error: 'AI service unavailable' });
  }
});

// GET /api/proctor/incidents — admin fetches all incidents
router.get('/incidents', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    console.log(`[INFO] Admin fetching incidents: limit=${limit}, offset=${offset}`);
    
    const result = await pool.query(
      `SELECT i.id, i.violation, i.confidence, i.severity, i.timestamp,
              u.name as student_name, u.username, u.id as student_id,
              e.title as exam_title, e.id as exam_id
       FROM incidents i
       JOIN users u ON u.id = i.student_id
       JOIN exams e ON e.id = i.exam_id
       ORDER BY i.timestamp DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    const countResult = await pool.query('SELECT COUNT(*) FROM incidents');
    const total = parseInt(countResult.rows[0].count);
    
    res.json({ 
      data: result.rows, 
      total, 
      limit, 
      offset 
    });
  } catch (err) {
    console.error('[ERROR] Get incidents error:', err);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// DELETE /api/proctor/incidents/:id — admin removes an incident
router.delete('/incidents/:id', authenticate, requireRole('admin'), async (req, res) => {
  const incidentId = parseInt(req.params.id);
  const adminId = req.session.userId;
  
  if (!incidentId || incidentId <= 0) {
    return res.status(400).json({ error: 'Invalid incident ID' });
  }
  
  try {
    const result = await pool.query('DELETE FROM incidents WHERE id = $1 RETURNING id', [incidentId]);
    
    if (result.rows.length === 0) {
      console.warn(`[WARN] Admin ${adminId} tried to delete non-existent incident ${incidentId}`);
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    console.log(`[INFO] Incident deleted: incident_id=${incidentId}, admin=${adminId}`);
    
    res.json({ success: true, deleted_id: incidentId });
  } catch (err) {
    console.error('[ERROR] Delete incident error:', err);
    res.status(500).json({ error: 'Failed to delete incident' });
  }
});

module.exports = router;
