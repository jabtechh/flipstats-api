# Running FlipStats API - Quick Start Guide

This guide will help you run the FlipStats API on your local machine.

---

## 📋 Prerequisites

Before you start, make sure you have:

- ✅ **Node.js** (v20 or higher) - [Download here](https://nodejs.org/)
- ✅ **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)
- ✅ **Git** - [Download here](https://git-scm.com/)

---

## 🚀 Step-by-Step Setup

### 1. Clone the Repository

```powershell
git clone https://github.com/jabtechh/flipstats-api.git
cd flipstats-api
```

### 2. Install Dependencies

```powershell
npm install
```

This will install all required packages (~200MB).

### 3. Create Environment File

Create a `.env` file in the root directory:

```powershell
Copy-Item .env.example .env
```

Or manually create `.env` with:

```env
# Database
DATABASE_URL=postgresql://flipstats:flipstats_password@localhost:5432/flipstats_db

# Admin
ADMIN_TOKEN=your-secret-admin-token-change-this-in-production

# Server
PORT=3000
NODE_ENV=development

# Scraping (optional)
SCRAPE_DELAY_MIN=500
SCRAPE_DELAY_MAX=1200
SCRAPE_MAX_RETRIES=3
```

### 4. Start PostgreSQL Database

```powershell
docker-compose up -d postgres
```

**Verify database is running:**
```powershell
docker ps
```

You should see `flipstats-postgres` with status "Up" and "(healthy)".

### 5. Run Database Migrations

```powershell
npm run migrate up
```

Expected output:
```
> 1734825600000_init.js
```

### 6. Build the Application

```powershell
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 7. Start the API Server

**Option A: Using the helper script (Recommended)**
```powershell
.\start-dev.ps1
```

**Option B: Manually**
```powershell
$env:DATABASE_URL = "postgresql://flipstats:flipstats_password@localhost:5432/flipstats_db"
$env:ADMIN_TOKEN = "your-secret-admin-token-change-this-in-production"
$env:PORT = "3000"
$env:NODE_ENV = "development"
node dist/server.js
```

Expected output:
```
[12:00:00 UTC] INFO: Server listening at http://0.0.0.0:3000
[12:00:00 UTC] INFO: Server listening on http://0.0.0.0:3000
[12:00:00 UTC] INFO: API Documentation available at http://0.0.0.0:3000/docs
```

---

## 🧪 Test the API

### 1. Health Check

Open PowerShell and run:
```powershell
Invoke-RestMethod http://localhost:3000/health
```

Expected response:
```
status       : healthy
timestamp    : 2025-12-21T12:00:00.000Z
database     : connected
emcees_count : 0
```

### 2. Access API Documentation

Open your browser and go to:
```
http://localhost:3000/docs
```

You should see interactive Swagger documentation.

### 3. Test Endpoints

```powershell
# Get all emcees (will be empty initially)
Invoke-RestMethod http://localhost:3000/v1/emcees

# Get divisions
Invoke-RestMethod http://localhost:3000/v1/divisions
```

---

## 📥 Load Emcees Data

To scrape and populate the database with FlipTop emcees:

```powershell
$headers = @{
    "x-admin-token" = "your-secret-admin-token-change-this-in-production"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://localhost:3000/admin/refresh-emcees" `
    -Method POST `
    -Headers $headers `
    -Body "{}"
```

This will:
- Scrape all 9 pages from fliptop.com.ph/emcees
- Extract profile details for ~178 emcees
- Take 3-5 minutes due to rate limiting
- Show progress in the server logs

---

## 🛑 Stopping the API

**Stop the server:**
- Press `Ctrl+C` in the terminal running the server

**Stop the database:**
```powershell
docker-compose down
```

**Stop and remove all data:**
```powershell
docker-compose down -v
```

---

## 🔄 Restarting the API

If the API is already set up:

```powershell
# 1. Start database (if not running)
docker-compose up -d postgres

# 2. Start API server
.\start-dev.ps1
```

That's it! No need to rebuild or re-migrate.

---

## 📝 Common Commands

```powershell
# Development with auto-reload
npm run dev

# Build only
npm run build

# Run migrations
npm run migrate up

# Rollback migrations
npm run migrate down

# Lint code
npm run lint

# Type check
npm run typecheck

# View logs
docker-compose logs -f postgres
```

---

## 🐛 Troubleshooting

### Server won't start - "address already in use"

Port 3000 is already taken. Kill the process:
```powershell
Get-NetTCPConnection -LocalPort 3000 | 
    Select-Object -ExpandProperty OwningProcess | 
    ForEach-Object { Stop-Process -Id $_ -Force }
```

### Database connection failed

Check if PostgreSQL is running:
```powershell
docker ps
```

If not running:
```powershell
docker-compose up -d postgres
```

### Migration errors

Reset the database:
```powershell
docker-compose down -v
docker-compose up -d postgres
npm run migrate up
```

### Can't access http://localhost:3000

1. Check if server is running (look for the log message)
2. Try `http://127.0.0.1:3000` instead
3. Check firewall settings

### "Module not found" errors

Reinstall dependencies:
```powershell
Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json -Force
npm install
npm run build
```

---

## 🌐 API Endpoints Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/` | API info |
| GET | `/docs` | Swagger documentation |
| GET | `/v1/emcees` | List all emcees (paginated) |
| GET | `/v1/emcees/:slug` | Get single emcee |
| GET | `/v1/divisions` | List divisions |
| POST | `/admin/refresh-emcees` | Scrape data (requires admin token) |

**Query Parameters:**
- `?page=1` - Page number
- `?limit=20` - Items per page (max 100)
- `?search=text` - Search by name
- `?division=Metro%20Manila` - Filter by division
- `?sort=name` - Sort by: name, year_joined, created_at

---

## 🔐 Admin Operations

Admin endpoints require the `x-admin-token` header:

```powershell
$headers = @{
    "x-admin-token" = "your-secret-admin-token-change-this-in-production"
    "Content-Type" = "application/json"
}

# Trigger data refresh
Invoke-RestMethod -Uri "http://localhost:3000/admin/refresh-emcees" `
    -Method POST `
    -Headers $headers `
    -Body "{}"
```

---

## 📊 Verifying Data

Check how many emcees are in the database:

```powershell
docker exec flipstats-postgres psql -U flipstats -d flipstats_db `
    -c "SELECT COUNT(*) FROM emcees;"
```

View sample data:
```powershell
docker exec flipstats-postgres psql -U flipstats -d flipstats_db `
    -c "SELECT name, hometown, division FROM emcees LIMIT 10;"
```

---

## 🎯 Next Steps

Now that your API is running:

1. ✅ Verify all endpoints work via Swagger docs
2. ✅ Load the emcee data (if not already done)
3. ✅ Start building your frontend UI
4. ✅ Keep the API server running while developing

**API Base URL for your UI:**
```
http://localhost:3000
```

**Example fetch in JavaScript:**
```javascript
const response = await fetch('http://localhost:3000/v1/emcees?limit=20');
const data = await response.json();
console.log(data);
```

Happy coding! 🚀

---

## 📚 Additional Resources

- [SETUP.md](./SETUP.md) - Detailed setup guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) - API usage examples
- [CURL_EXAMPLES.md](./CURL_EXAMPLES.md) - curl command examples
- [GitHub Repository](https://github.com/jabtechh/flipstats-api)
