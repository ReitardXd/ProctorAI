# ProctorAI - Quick Reference Guide

## 🚀 Getting Started (2 minutes)

### Prerequisites Check
```bash
node --version      # v18+ required
npm --version       # v9+ required
psql --version      # PostgreSQL required
python3 --version   # Python 3.9+ required
```

### One-Time Setup
```bash
# Install dependencies
npm install

# Create database
createdb proctordb

# Setup backend configuration
cd backend
cp .env.example .env

# Edit .env - Add this line:
# DATABASE_URL=postgresql://postgres@localhost:5432/proctordb

# Initialize database with tables and demo data
node init-db.js

# Verify database
psql proctordb -c "SELECT COUNT(*) FROM users;"
# Should return: 2 (student + admin)
```

### Start Development (3 Terminals)

**Terminal 1 - Backend API**
```bash
cd backend
node server.js
# → [INFO] Server running on port 3000
```

**Terminal 2 - Frontend SPA**
```bash
cd Frontend
python3 -m http.server 8080
# → Serving on http://127.0.0.1:8080
```

**Terminal 3 - AI Service**
```bash
cd ai_service
pip install -r requirements.txt
python3 app.py
# → AI service running on port 5000
```

### Access Application
- **Student**: http://localhost:8080 → `student` / `student123`
- **Admin**: http://localhost:8080 → `admin` / `admin123`

---

## 🐳 Docker Setup (1 minute)

```bash
# Start all services
docker-compose up -d

# Initialize database
docker-compose exec backend node backend/init-db.js

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

**Endpoints**:
- Backend: http://localhost:3000
- AI Service: http://localhost:5000
- Database: postgresql://postgres:postgres@localhost:5432/proctordb

---

## 📚 Environment Variables

### Backend (.env)
```bash
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres@localhost:5432/proctordb
SESSION_SECRET=your-secret-here
ENCRYPTION_SECRET=your-secret-here
CORS_ORIGINS=http://localhost:8080
AI_SERVICE_URL=http://localhost:5000
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🔑 Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Student | `student` | `student123` |
| Admin | `admin` | `admin123` |

---

## 🧪 Testing the Features

### Student Exam
1. Login as `student` / `student123`
2. Click "Take Exam"
3. Allow camera permission
4. Answer questions
5. Submit or wait for auto-submit

### Admin Dashboard
1. Login as `admin` / `admin123`
2. View "Exam Submissions"
3. View "Incidents" (AI violations)
4. Check incident timeline
5. Delete incidents as needed

### AI Proctoring
- Multiple faces → critical incident
- No face → high severity
- Looking away → medium severity
- Confidence score recorded

---

## 🛠️ Troubleshooting

### Database Issues
```bash
# Check PostgreSQL running
sudo systemctl status postgresql

# Create database
createdb proctordb

# Check tables created
psql proctordb -c "\dt"

# View demo users
psql proctordb -c "SELECT username, role FROM users;"
```

### Backend Issues
```bash
# Check port 3000 available
lsof -i :3000

# Check env variables loaded
node -e "require('dotenv').config({path: 'backend/.env'}); console.log(process.env.DATABASE_URL)"

# Test database connection
node -e "const pool = require('./backend/db'); pool.query('SELECT NOW()').then(r => console.log(r.rows[0])).catch(e => console.error(e))"
```

### Frontend Issues
```bash
# Clear browser cache
# Open DevTools (F12) → Application → Clear Storage

# Check console for errors
# Open DevTools (F12) → Console tab

# Test API endpoint
curl http://localhost:3000/api/health
```

### AI Service Issues
```bash
# Check service running
curl http://localhost:5000/health

# Test frame analysis
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{"frame":"iVBORw0KGg..."}'
```

---

## 📊 API Quick Reference

### Authentication
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"student123"}' \
  -c cookies.txt

# Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

### Exams
```bash
# Submit exam
curl -X POST http://localhost:3000/api/exam/submit \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"exam_id":1,"answers":["A","B","C"]}'

# Get submissions (admin only)
curl http://localhost:3000/api/exam/submissions?limit=10 \
  -b cookies.txt
```

### Proctoring
```bash
# Analyze frame
curl -X POST http://localhost:3000/api/proctor/analyze \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"frame":"base64...","exam_id":1}'

# Get incidents (admin only)
curl http://localhost:3000/api/proctor/incidents?limit=10 \
  -b cookies.txt

# Delete incident
curl -X DELETE http://localhost:3000/api/proctor/incidents/1 \
  -b cookies.txt
```

---

## 📁 Important Files

| Path | Purpose |
|------|---------|
| `Frontend/proctor.html` | Complete SPA (2,290 lines) |
| `backend/server.js` | Express app with logging |
| `backend/db.js` | PostgreSQL connection |
| `backend/routes/auth.js` | Login/logout endpoints |
| `backend/routes/exam.js` | Exam submission endpoints |
| `backend/routes/proctor.js` | AI analysis endpoints |
| `backend/init-db.js` | Database setup script |
| `ai_service/app.py` | Face detection service |
| `docker-compose.yml` | Container orchestration |
| `DEPLOYMENT.md` | Full deployment guide |

---

## 🔒 Security Checklist

Development:
- [ ] Using `.env` (not committed to git)
- [ ] Secrets not hardcoded
- [ ] Database validated before operations
- [ ] All endpoints check authentication

Production:
- [ ] Generate new SESSION_SECRET and ENCRYPTION_SECRET
- [ ] Set HTTPS_ENABLED=true
- [ ] Configure CORS_ORIGINS with actual domain
- [ ] Use PostgreSQL managed service (RDS, Azure DB, etc.)
- [ ] Enable database backups
- [ ] Setup monitoring and logging
- [ ] Regular security updates: `npm audit fix`

---

## 📈 Performance Tips

```bash
# Monitor backend memory
node --max-old-space-size=4096 backend/server.js

# Check database indexes
psql proctordb -c "\d+ exam_submissions"

# Monitor active connections
psql proctordb -c "SELECT * FROM pg_stat_activity;"
```

---

## 🚀 Deployment Checklist

- [ ] Database migrations run: `node init-db.js`
- [ ] Environment variables set
- [ ] Secrets generated and stored securely
- [ ] HTTPS configured (Let's Encrypt)
- [ ] CORS origins updated
- [ ] Database backups enabled
- [ ] Health checks configured
- [ ] Monitoring/logging setup
- [ ] Rate limiting verified
- [ ] Load testing completed

---

## 📞 Support

**Documentation**: See `DEPLOYMENT.md` for detailed guides

**Common Issues**:
1. Database connection → Check `DATABASE_URL`
2. CORS error → Add origin to `CORS_ORIGINS`
3. Login fails → Check `users` table: `psql proctordb -c "SELECT * FROM users;"`
4. AI timeout → Check `AI_SERVICE_URL` and Python service status

---

## 🎯 Next Steps

1. ✅ **Verify Setup**: Test all features locally
2. ✅ **Review Code**: Check bug fixes in `FIXES_SUMMARY.md`
3. ✅ **Read Documentation**: `DEPLOYMENT.md` for production
4. ✅ **Generate Secrets**: New SESSION_SECRET, ENCRYPTION_SECRET
5. ✅ **Deploy**: Follow deployment guide for your platform
6. ✅ **Monitor**: Setup logging and error tracking
7. ✅ **Backup**: Configure database backups

---

**Version**: 2.0 (Complete Fix Release)  
**Status**: Production Ready ✅  
**Last Updated**: April 2026
