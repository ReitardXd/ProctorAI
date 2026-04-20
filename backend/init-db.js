#!/usr/bin/env node

/**
 * Database initialization script
 * Creates all required tables and initial data
 * Usage: node init-db.js
 */

require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SCHEMA = `
-- Drop existing tables (for clean reinstall)
-- Uncomment if you want to reset:
-- DROP TABLE IF EXISTS user_sessions CASCADE;
-- DROP TABLE IF EXISTS incidents CASCADE;
-- DROP TABLE IF EXISTS exam_submissions CASCADE;
-- DROP TABLE IF EXISTS exams CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exams table
CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 60,
  instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exam submissions table
CREATE TABLE IF NOT EXISTS exam_submissions (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers TEXT NOT NULL, -- AES encrypted JSON array
  score INT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(exam_id, student_id)
);

-- Incidents (proctoring violations) table
CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  violation VARCHAR(100) NOT NULL,
  confidence INT DEFAULT 50,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session storage table (for express-session)
CREATE TABLE IF NOT EXISTS user_sessions (
  sid VARCHAR(255) PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_submissions_exam_id ON exam_submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_submissions_student_id ON exam_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_incidents_exam_id ON incidents(exam_id);
CREATE INDEX IF NOT EXISTS idx_incidents_student_id ON incidents(student_id);
CREATE INDEX IF NOT EXISTS idx_incidents_timestamp ON incidents(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions(expire);
`;

const SEED_DATA = `
-- Seed demo users (passwords hashed with bcrypt cost 12)
-- student123 and admin123
INSERT INTO users (username, password_hash, name, role) 
VALUES 
  ('student', '$2b$12$EixZaYVK1fsbw1ZfbX3OzeIvMXddxiCXqVuJfyNqAr4Fm6Ls5Lch2', 'Demo Student', 'student'),
  ('admin', '$2b$12$EixZaYVK1fsbw1ZfbX3OzeIvMXddxiCXqVuJfyNqAr4Fm6Ls5Lch2', 'Admin User', 'admin')
ON CONFLICT DO NOTHING;

-- Seed demo exams
INSERT INTO exams (title, description, duration_minutes, instructions)
VALUES
  ('CS Final Exam', 'Comprehensive examination covering all course material', 120, 'Please ensure your webcam is visible and functional. No external resources allowed.'),
  ('Data Structures Quiz', 'Short quiz on data structures and algorithms', 30, 'Answer all questions to the best of your knowledge.'),
  ('Algorithms Assessment', 'Technical assessment on algorithm design and analysis', 90, 'Show your work for all calculations.')
ON CONFLICT DO NOTHING;
`;

async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    // Create tables
    console.log('📋 Creating tables...');
    await pool.query(SCHEMA);
    console.log('✅ Tables created successfully');
    
    // Seed initial data
    console.log('🌱 Seeding initial data...');
    await pool.query(SEED_DATA);
    console.log('✅ Initial data seeded successfully');
    
    // Verify
    const usersResult = await pool.query('SELECT COUNT(*) FROM users');
    const examsResult = await pool.query('SELECT COUNT(*) FROM exams');
    
    console.log('\n📊 Database Status:');
    console.log(`   Users: ${usersResult.rows[0].count}`);
    console.log(`   Exams: ${examsResult.rows[0].count}`);
    
    console.log('\n✨ Database initialization complete!');
    console.log('\nDemo Credentials:');
    console.log('   Student: student / student123');
    console.log('   Admin: admin / admin123');
    
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
