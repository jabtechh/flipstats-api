# 🚀 FlipStats API - Quick Test Instructions

## ✅ What's Already Done:
- ✓ PostgreSQL is running in Docker
- ✓ Database migrations completed
- ✓ Tables created (`emcees`, `ingest_runs`)
- ✓ Code compiled and ready

## 🎯 How to Test the API:

### Step 1: Start the Server

Open a PowerShell terminal and run:

```powershell
cd d:\Coding\flipstats-api

$env:DATABASE_URL='postgresql://flipstats:flipstats_password@localhost:5432/flipstats_db'
$env:ADMIN_TOKEN='your-secret-admin-token-change-this-in-production'
$env:PORT='3000'

npm run dev
```

You should see:
```
Server listening on http://0.0.0.0:3000
API Documentation available at http://0.0.0.0:3000/docs
```

**Leave this terminal running!**

---

### Step 2: Test the API

Open a **NEW** PowerShell terminal and run:

```powershell
cd d:\Coding\flipstats-api
.\run-tests.ps1
```

This will test all endpoints and show you the results!

---

### Step 3: View API Documentation

Open your browser:
- http://localhost:3000/docs

You can test endpoints interactively here!

---

### Step 4: Trigger Data Ingestion (Optional)

In your **second** terminal (not the server terminal), run:

```powershell
.\trigger-ingestion.ps1
```

This will:
1. Scrape https://www.fliptop.com.ph/emcees
2. Visit each emcee's profile
3. Save data to database
4. Take 5-15 minutes

---

## 🧪 Manual Testing with curl:

If you prefer curl, here are some commands:

```powershell
# Health check
curl http://localhost:3000/health

# List all emcees
curl http://localhost:3000/v1/emcees

# Get emcee by slug (replace with actual slug after ingestion)
curl http://localhost:3000/v1/emcees/anygma

# Get divisions
curl http://localhost:3000/v1/divisions

# Trigger ingestion (admin only)
curl -X POST http://localhost:3000/admin/refresh-emcees `
  -H "X-Admin-Token: your-secret-admin-token-change-this-in-production"
```

---

## 📊 Expected Test Results:

### Before Ingestion:
- ✓ Health check: healthy
- ✓ List emcees: 0 results (empty database)
- ✓ Divisions: 0 divisions

### After Ingestion:
- ✓ Health check: healthy
- ✓ List emcees: 100+ results
- ✓ Divisions: Multiple divisions (Metro Manila, Luzon, etc.)
- ✓ Individual emcee data with bio, hometown, etc.

---

## 🔧 Troubleshooting:

### Server won't start?
Check if PostgreSQL is running:
```powershell
docker ps | Select-String postgres
```

If not running:
```powershell
docker compose up -d postgres
```

### Tests fail?
Make sure the server is running in another terminal first!

### Port already in use?
Change the port:
```powershell
$env:PORT='3001'
npm run dev
```

Then update the URL in tests to http://localhost:3001

---

## 🎉 That's It!

You now have a fully functional REST API! Explore the Swagger docs to see all available endpoints and try them out interactively.
