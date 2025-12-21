# Quick Start Guide (Without Docker/PostgreSQL)

## Current Situation

Your system doesn't have Docker or PostgreSQL installed. Here are your options:

## Option 1: Install Docker Desktop (Recommended)

1. **Download Docker Desktop for Windows**:
   - Visit: https://www.docker.com/products/docker-desktop
   - Install Docker Desktop
   - Restart your computer

2. **After Docker is installed, run**:
   ```powershell
   cd d:\Coding\flipstats-api
   docker compose up -d postgres
   npm run migrate:up
   npm run dev
   ```

## Option 2: Install PostgreSQL Locally

1. **Download PostgreSQL**:
   - Visit: https://www.postgresql.org/download/windows/
   - Install PostgreSQL 16 (remember your password!)

2. **Create database**:
   ```powershell
   # Using psql (replace 'postgres' with your username if different)
   psql -U postgres -c "CREATE DATABASE flipstats_db;"
   psql -U postgres -c "CREATE USER flipstats WITH PASSWORD 'flipstats_password';"
   psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE flipstats_db TO flipstats;"
   ```

3. **Update .env file**:
   ```env
   DATABASE_URL=postgresql://flipstats:flipstats_password@localhost:5432/flipstats_db
   ```

4. **Run the app**:
   ```powershell
   npm run migrate:up
   npm run dev
   ```

## Option 3: Test Without Database (Code Review Only)

For now, you can:

1. **Review the code structure**:
   ```powershell
   # Check TypeScript compilation
   npm run typecheck
   
   # Run linter
   npm run lint
   
   # Build the project
   npm run build
   ```

2. **Explore the files**:
   - Read through `src/` directory
   - Review the API routes
   - Study the ingestion logic
   - Check the database queries

## Next Steps

Choose one of the options above based on your preference:

- **Want full experience?** → Install Docker (Option 1) ✅ Recommended
- **Already have PostgreSQL?** → Use local PostgreSQL (Option 2)
- **Just exploring?** → Review code structure (Option 3)

After setting up the database, you can:
1. Run migrations: `npm run migrate:up`
2. Start dev server: `npm run dev`
3. Test endpoints with curl/Postman
4. Trigger data ingestion: `POST /admin/refresh-emcees`
