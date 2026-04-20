# ProctorAI - Deployment & Setup Guide

Complete guide to setting up and deploying ProctorAI in development and production environments.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Docker Deployment](#docker-deployment)
4. [Cloud Deployment (AWS/Azure/GCP)](#cloud-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Security Checklist](#security-checklist)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- **Node.js**: v18+ (tested with v22)
- **Python**: 3.9+
- **PostgreSQL**: 13+ (for database)
- **Docker** & **Docker Compose**: (optional, for containerized deployment)

### Tools
```bash
# macOS
brew install node postgresql python3 docker docker-compose

# Ubuntu/Debian
sudo apt-get install nodejs postgresql postgresql-contrib python3 docker.io docker-compose

# Windows
# Use Docker Desktop (includes Docker & Docker Compose)
# Install Node.js from nodejs.org
# Install PostgreSQL from postgresql.org
# Install Python from python.org
```

---

## Local Development Setup

### Step 1: Clone & Install Dependencies

```bash
cd /path/to/Proctorproject

# Install Node dependencies
npm install
```

### Step 2: Setup PostgreSQL Database

```bash
# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql

# Or start PostgreSQL service on Linux/Windows

# Create database and user
createdb proctordb
psql proctordb << EOF
CREATE USER proctoruser WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE proctordb TO proctoruser;
EOF
```

### Step 3: Initialize Database Schema

```bash
cd backend

# Copy .env.example to .env
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use your preferred editor

# Run initialization script
node init-db.js
# Output should show:
# ✅ Tables created successfully
# ✅ Initial data seeded successfully
# Demo Credentials:
#    Student: student / student123
#    Admin: admin / admin123
```

### Step 4: Start Services

Open 3 terminal windows:

**Terminal 1: Backend API**
```bash
cd backend
node server.js
# Server running on port 3000
```

**Terminal 2: Frontend**
```bash
# Option A: Using live-server
npx live-server Frontend/
# Serving on http://127.0.0.1:8080

# Option B: Using Python http.server
cd Frontend
python3 -m http.server 8080
```

**Terminal 3: AI Service**
```bash
cd ai_service
python3 -m pip install -r requirements.txt
python3 app.py
# AI service running on port 5000
```

### Step 5: Test Application

1. Open browser: http://localhost:8080
2. Login with:
   - **Student**: `student` / `student123`
   - **Admin**: `admin` / `admin123`
3. Student: Start exam, verify webcam works, submit answers
4. Admin: View incidents and submissions dashboard

---

## Docker Deployment

### Quick Start with Docker Compose

```bash
# Generate secrets
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Create .env for docker-compose
cat > .env.docker << EOF
SESSION_SECRET=$SESSION_SECRET
ENCRYPTION_SECRET=$ENCRYPTION_SECRET
CORS_ORIGINS=http://localhost:8080,http://localhost:3000
AI_DEBUG=false
HTTPS_ENABLED=false
EOF

# Start all services
docker-compose up -d

# Initialize database
docker-compose exec backend node backend/init-db.js

# Check logs
docker-compose logs -f
```

### Individual Docker Builds

**Backend**
```bash
docker build -t proctor-api:latest .
docker run -d \
  --name proctor-api \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@postgres:5432/proctordb \
  -e SESSION_SECRET=<your-secret> \
  -e ENCRYPTION_SECRET=<your-secret> \
  proctor-api:latest
```

**AI Service**
```bash
docker build -f Dockerfile.ai -t proctor-ai:latest .
docker run -d \
  --name proctor-ai \
  -p 5000:5000 \
  proctor-ai:latest
```

### Accessing Services in Docker

- Backend API: http://localhost:3000
- Frontend: http://localhost:8080 (needs separate web server)
- AI Service: http://localhost:5000
- Database: postgres://postgres:postgres@localhost:5432/proctordb

---

## Cloud Deployment

### AWS EC2 Deployment

#### 1. Launch EC2 Instance

```bash
# Requirements: Ubuntu 22.04 LTS, t3.medium or larger
# Security Group: Allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000, 5000, 8080

# SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip
```

#### 2. Install Dependencies

```bash
sudo apt update && sudo apt upgrade -y

# Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Python
sudo apt install -y python3 python3-pip

# Docker (optional)
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker ubuntu

# Nginx (for reverse proxy)
sudo apt install -y nginx
```

#### 3. Setup Application

```bash
# Clone repository
git clone https://github.com/your-org/proctorproject.git
cd proctorproject

# Install dependencies
npm install

# Setup PostgreSQL
sudo -u postgres createdb proctordb
sudo -u postgres createuser proctoruser -W
# Create .env with proper DATABASE_URL
cd backend
node init-db.js
```

#### 4. Configure Nginx as Reverse Proxy

```bash
# Create nginx config
sudo cat > /etc/nginx/sites-available/proctorai << 'EOF'
upstream backend {
    server localhost:3000;
}

upstream ai-service {
    server localhost:5000;
}

server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend
    location / {
        root /home/ubuntu/proctorproject/Frontend;
        try_files $uri $uri/ /proctor.html;
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # AI Service
    location /ai {
        proxy_pass http://ai-service;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/proctorai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. Setup SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d your-domain.com
```

#### 6. Start Services with Systemd

```bash
# Backend service
sudo cat > /etc/systemd/system/proctor-api.service << 'EOF'
[Unit]
Description=ProctorAI Backend API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/proctorproject/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# AI service
sudo cat > /etc/systemd/system/proctor-ai.service << 'EOF'
[Unit]
Description=ProctorAI AI Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/proctorproject/ai_service
ExecStart=/usr/bin/python3 app.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable proctor-api proctor-ai
sudo systemctl start proctor-api proctor-ai
```

### Azure Container Instances Deployment

```bash
# Build and push Docker images
docker build -t proctor-api:latest .
docker tag proctor-api:latest yourregistry.azurecr.io/proctor-api:latest
docker push yourregistry.azurecr.io/proctor-api:latest

# Deploy using Azure CLI
az container create \
  --resource-group your-group \
  --name proctor-api \
  --image yourregistry.azurecr.io/proctor-api:latest \
  --cpu 2 --memory 4 \
  --ports 3000 \
  --environment-variables \
    DATABASE_URL="postgresql://user:pass@postgres:5432/db" \
    SESSION_SECRET="your-secret" \
    ENCRYPTION_SECRET="your-secret"
```

### Google Cloud Run Deployment

```bash
# Build container
gcloud builds submit --tag gcr.io/your-project/proctor-api

# Deploy
gcloud run deploy proctor-api \
  --image gcr.io/your-project/proctor-api \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL="postgresql://...",SESSION_SECRET="...",ENCRYPTION_SECRET="..."
```

---

## Environment Configuration

### Backend Environment Variables

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `PORT` | Yes | `3000` | Express server port |
| `NODE_ENV` | Yes | `production` | Environment mode |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/db` | PostgreSQL connection |
| `SESSION_SECRET` | Yes | `a1b2c3d4...` | 32-char hex string for session encryption |
| `ENCRYPTION_SECRET` | Yes | `e5f6g7h8...` | 32-char hex string for answer encryption |
| `CORS_ORIGINS` | No | `http://localhost:8080` | Comma-separated allowed origins |
| `AI_SERVICE_URL` | No | `http://localhost:5000` | AI service endpoint |
| `HTTPS_ENABLED` | No | `true` | Enforce HTTPS in production |

### Generating Secrets

```bash
# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend Configuration

Set `API_BASE_URL` in index.html or via environment:

```html
<script>
  window.API_BASE_URL = 'https://api.your-domain.com';
</script>
```

Or let the frontend auto-detect based on location.

---

## Security Checklist

### Before Production Deployment

- [ ] **Secrets Management**
  - [ ] Generate new `SESSION_SECRET` and `ENCRYPTION_SECRET`
  - [ ] Store in secure vault (AWS Secrets Manager, Azure Key Vault, etc.)
  - [ ] Never commit `.env` files to git
  - [ ] Ensure `.gitignore` includes `.env`

- [ ] **HTTPS/TLS**
  - [ ] Generate SSL certificates (Let's Encrypt recommended)
  - [ ] Set `HTTPS_ENABLED=true` in backend
  - [ ] Configure secure cookie flags
  - [ ] Use HSTS headers (Strict-Transport-Security)

- [ ] **Database Security**
  - [ ] Use strong PostgreSQL passwords
  - [ ] Enable PostgreSQL SSL connections
  - [ ] Restrict database access to backend only
  - [ ] Enable backups and point-in-time recovery
  - [ ] Run SQL: `REVOKE ALL ON DATABASE proctordb FROM PUBLIC;`

- [ ] **Application Security**
  - [ ] Validate all user inputs
  - [ ] Use parameterized queries (already done)
  - [ ] Implement rate limiting on all endpoints
  - [ ] Enable CORS properly (not `*`)
  - [ ] Set security headers (CSP, X-Frame-Options, etc.)
  - [ ] Regular dependency updates: `npm audit fix`

- [ ] **Infrastructure Security**
  - [ ] Use firewall rules to restrict access
  - [ ] Enable VPN/bastion host for SSH access
  - [ ] Use security groups / network ACLs
  - [ ] Regular security patching
  - [ ] Enable CloudTrail / audit logging

- [ ] **Monitoring & Logging**
  - [ ] Setup centralized logging (CloudWatch, DataDog, etc.)
  - [ ] Monitor error rates and performance
  - [ ] Setup alerts for suspicious activities
  - [ ] Regular log review and retention policy

---

## Troubleshooting

### Connection Issues

**Cannot connect to PostgreSQL**
```bash
# Check PostgreSQL is running
psql -U postgres -d postgres -c "SELECT version();"

# Verify DATABASE_URL
echo $DATABASE_URL

# Check connection from Node
node -e "const pg = require('pg'); new pg.Pool({connectionString: process.env.DATABASE_URL}).query('SELECT NOW()').then(r => console.log(r.rows[0]))"
```

**AI Service unreachable**
```bash
# Test AI service health
curl http://localhost:5000/health

# Check backend can reach AI
node -e "fetch('http://localhost:5000/health').then(r => r.json()).then(console.log)"
```

### Authentication Issues

**Login not working**
- Check `SESSION_SECRET` is set correctly
- Verify database has users table populated
- Check browser allows cookies (especially third-party)
- Verify CORS origin in browser matches `CORS_ORIGINS`

**Session expires immediately**
- Check `maxAge` in `backend/server.js` (default 30 minutes)
- Verify clock sync on server
- Check PostgreSQL session table: `SELECT * FROM user_sessions;`

### Performance Issues

**Slow exam submissions**
- Check database indexes are created
- Monitor database query logs
- Verify encryption is not bottleneck
- Check if AI service is hanging

**High memory usage**
- Monitor Node.js heap: `node --max-old-space-size=4096 backend/server.js`
- Check for memory leaks in long-running processes
- Monitor webcam stream cleanup

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL not running | Start PostgreSQL service |
| `DATABASE_URL is undefined` | Env var not set | Load `.env` before starting |
| `CORS error` | Origin not whitelisted | Add origin to `CORS_ORIGINS` |
| `TypeError: Cannot read property 'getTracks'` | Stream not initialized | Ensure webcam permission granted |
| `Failed to submit exam` | Backend error | Check server logs and database |

---

## Health Checks

### Quick Health Check Script

```bash
#!/bin/bash
echo "Checking ProctorAI services..."

# Backend API
echo -n "Backend API (3000): "
curl -s http://localhost:3000/api/auth/login > /dev/null 2>&1 && echo "✅" || echo "❌"

# AI Service
echo -n "AI Service (5000): "
curl -s http://localhost:5000/health | grep -q "ok" && echo "✅" || echo "❌"

# Database
echo -n "Database: "
psql -U postgres -d proctordb -c "SELECT 1;" > /dev/null 2>&1 && echo "✅" || echo "❌"

echo "Done!"
```

---

## Support & Maintenance

### Regular Maintenance Tasks

- [ ] Weekly: Review application logs and error rates
- [ ] Monthly: Update dependencies (`npm audit`, `pip list --outdated`)
- [ ] Quarterly: Security audit and penetration testing
- [ ] Annually: Database optimization and backup testing

### Backup Strategy

```bash
# PostgreSQL backup
pg_dump proctordb > backup_$(date +%Y%m%d).sql

# Restore
psql proctordb < backup_20240101.sql
```

### Scaling Recommendations

For large deployments:
1. Use managed PostgreSQL (RDS, Azure Database)
2. Add caching layer (Redis)
3. Load balance multiple backend instances
4. Use CDN for static assets
5. Scale AI service independently (GPU instances)

---

## Contact & Support

For issues or questions:
- GitHub Issues: [create issue]
- Documentation: https://github.com/your-org/proctorproject/wiki
- Email: support@proctorproject.com
