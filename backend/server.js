require('dotenv').config({ path: __dirname + '/.env' });
const express    = require('express');
const session    = require('express-session');
const pgSession  = require('connect-pg-simple')(session);
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const pool       = require('./db');
const authRoutes = require('./routes/auth');
const examRoutes = require('./routes/exam');
const proctorRoutes = require('./routes/proctor');

// Validate required environment variables
const requiredEnvVars = ['PORT', 'DATABASE_URL', 'SESSION_SECRET', 'ENCRYPTION_SECRET', 'NODE_ENV'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

const app = express();

// Logging middleware
const logRequest = (req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;

  res.send = function(data) {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(`[${level}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    if (res.statusCode >= 500) {
      console.error(`[ERROR] Response:`, data);
    }
    return originalSend.call(this, data);
  };

  next();
};

app.use(logRequest);

// Validate HTTPS in production
if (process.env.NODE_ENV === 'production' && !process.env.HTTPS_ENABLED) {
  console.warn('WARNING: Running in production without HTTPS. Set HTTPS_ENABLED=true');
}

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8080').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[WARN] CORS request blocked from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Global rate limiter (basic protection)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true, // Return rate limit info in headers
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  }
});

app.use(globalLimiter);

app.use(session({
  store: new pgSession({ pool, tableName: 'user_sessions' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 1000 * 60 * 30  // 30 minutes
  }
}));

app.use('/api/auth', authRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/proctor', proctorRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  console.warn(`[WARN] 404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }

  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(process.env.PORT, () => {
  console.log(`[INFO] Server running on port ${process.env.PORT}`);
  console.log(`[INFO] Environment: ${process.env.NODE_ENV}`);
  console.log(`[INFO] CORS Origins: ${allowedOrigins.join(', ')}`);
});

// Set request timeout to 30 seconds
server.setTimeout(30000);

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('[INFO] SIGTERM received, closing server gracefully');
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[INFO] SIGINT received, closing server gracefully');
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, just log
});
