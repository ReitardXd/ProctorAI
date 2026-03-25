require('dotenv').config({ path: __dirname + '/.env' });
const express    = require('express');
const session    = require('express-session');
const pgSession  = require('connect-pg-simple')(session);
const cors       = require('cors');
const pool       = require('./db');
const authRoutes = require('./routes/auth');
const examRoutes = require('./routes/exam');
const proctorRoutes = require('./routes/proctor');
const app = express();

app.use(cors({
  origin: ['http://127.0.0.1:8080', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json());

app.use(session({
  store: new pgSession({ pool, tableName: 'user_sessions' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 2
  }
}));

app.use('/api/auth', authRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/proctor', proctorRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
