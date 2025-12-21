# FlipStats API - Setup Guide

## Complete Project File Tree

```
flipstats-api/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Continuous integration pipeline
│       └── refresh-data.yml          # Scheduled data refresh workflow
│
├── migrations/
│   └── 1734825600000_init.js         # Initial database schema
│
├── src/
│   ├── db/
│   │   ├── pool.ts                   # Database connection pool & utilities
│   │   └── queries/
│   │       ├── emcees.ts             # Emcees CRUD operations (raw SQL)
│   │       └── ingestRuns.ts         # Ingest tracking operations
│   │
│   ├── ingest/
│   │   └── emcees.ts                 # Scraping & ingestion logic
│   │
│   ├── routes/
│   │   ├── admin.ts                  # Admin endpoints (protected)
│   │   ├── divisions.ts              # Divisions endpoint
│   │   ├── emcees.ts                 # Emcees public endpoints
│   │   └── health.ts                 # Health check endpoint
│   │
│   ├── app.ts                        # Fastify application setup
│   └── server.ts                     # Server entry point
│
├── .dockerignore                     # Docker ignore patterns
├── .env.example                      # Environment variables template
├── .eslintrc.json                    # ESLint configuration
├── .gitignore                        # Git ignore patterns
├── .pgmigrate.json                   # Migration tool configuration
├── docker-compose.yml                # Local development stack
├── Dockerfile                        # Production container definition
├── package.json                      # NPM dependencies & scripts
├── README.md                         # Main documentation
├── SETUP.md                          # This file
└── tsconfig.json                     # TypeScript configuration
```

## Step-by-Step Setup

### 1. Initial Setup

```bash
# Navigate to project
cd flipstats-api

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://flipstats:flipstats_password@localhost:5432/flipstats_db

# Admin Security - CHANGE THIS!
ADMIN_TOKEN=your-secret-admin-token-change-this-in-production

# Scraping Configuration (optional)
SCRAPE_DELAY_MIN=500
SCRAPE_DELAY_MAX=1200
SCRAPE_MAX_RETRIES=3
```

### 3. Start PostgreSQL

#### Option A: Docker Compose (Recommended)
```bash
docker-compose up -d postgres
```

#### Option B: Local PostgreSQL
If you have PostgreSQL installed locally:
```bash
createdb flipstats_db
```

### 4. Run Database Migrations

```bash
npm run migrate:up
```

Expected output:
```
> 1734825600000_init
```

### 5. Verify Migration

```bash
# Connect to database
docker exec -it flipstats-postgres psql -U flipstats -d flipstats_db

# Inside psql:
\dt                    # List tables (should show emcees, ingest_runs, pgmigrations)
\d emcees              # Describe emcees table
\q                     # Quit
```

### 6. Start Development Server

```bash
npm run dev
```

You should see:
```
[HH:MM:SS] Server listening on http://0.0.0.0:3000
[HH:MM:SS] API Documentation available at http://0.0.0.0:3000/docs
```

### 7. Test the API

Open another terminal and test endpoints:

```bash
# Health check
curl http://localhost:3000/health

# API documentation (open in browser)
open http://localhost:3000/docs

# Try listing emcees (empty at first)
curl http://localhost:3000/v1/emcees
```

### 8. Trigger First Ingestion

```bash
curl -X POST http://localhost:3000/admin/refresh-emcees \
  -H "X-Admin-Token: your-secret-admin-token-change-this-in-production"
```

This will:
1. Scrape https://www.fliptop.com.ph/emcees
2. Extract all emcee profile links
3. Visit each profile page
4. Parse and extract data
5. Upsert into database
6. Return summary statistics

**Note**: This may take several minutes depending on the number of emcees.

### 9. Verify Data

```bash
# List emcees
curl http://localhost:3000/v1/emcees

# Get a specific emcee (replace 'slug' with actual slug)
curl http://localhost:3000/v1/emcees/anygma

# Get divisions
curl http://localhost:3000/v1/divisions
```

## Production Deployment

### Full Stack with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Run migrations in container
docker-compose exec api npm run migrate:up

# Trigger ingestion
curl -X POST http://localhost:3000/admin/refresh-emcees \
  -H "X-Admin-Token: your-secret-admin-token"
```

### Manual Production Deployment

1. **Build Docker Image**
   ```bash
   docker build -t flipstats-api:latest .
   ```

2. **Run Database**
   ```bash
   docker run -d \
     --name flipstats-postgres \
     -e POSTGRES_USER=flipstats \
     -e POSTGRES_PASSWORD=strong_password_here \
     -e POSTGRES_DB=flipstats_db \
     -p 5432:5432 \
     -v flipstats_data:/var/lib/postgresql/data \
     postgres:16-alpine
   ```

3. **Run Migrations**
   ```bash
   docker run --rm \
     -e DATABASE_URL=postgresql://flipstats:strong_password_here@host.docker.internal:5432/flipstats_db \
     flipstats-api:latest \
     npm run migrate:up
   ```

4. **Run API**
   ```bash
   docker run -d \
     --name flipstats-api \
     -p 3000:3000 \
     -e NODE_ENV=production \
     -e DATABASE_URL=postgresql://flipstats:strong_password_here@host.docker.internal:5432/flipstats_db \
     -e ADMIN_TOKEN=your-secure-token \
     --restart unless-stopped \
     flipstats-api:latest
   ```

## GitHub Actions Setup

### For CI/CD Pipeline

1. Push code to GitHub
2. CI will automatically run on push/PR
3. No additional setup needed

### For Scheduled Data Refresh

1. Deploy your API to a server with public URL
2. Add GitHub repository secrets:
   - `API_URL`: Your production API URL (e.g., `https://api.example.com`)
   - `ADMIN_TOKEN`: Your production admin token

3. Go to Actions tab → "Refresh Emcees Data" → Run workflow

## Troubleshooting

### Database Connection Issues

```bash
# Check if postgres is running
docker ps | grep postgres

# Check postgres logs
docker logs flipstats-postgres

# Test connection
docker exec flipstats-postgres pg_isready -U flipstats
```

### Migration Issues

```bash
# Check migration status
npm run migrate:up

# If stuck, rollback and retry
npm run migrate:down
npm run migrate:up
```

### Scraping Issues

Common issues:
1. **Website structure changed**: Update selectors in `src/ingest/emcees.ts`
2. **Rate limiting**: Increase delays in `.env`
3. **Network errors**: Check retries configuration

Enable debug logging:
```bash
export LOG_LEVEL=debug
npm run dev
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
export PORT=3001
npm run dev
```

## Development Workflow

### Making Code Changes

1. Edit files in `src/`
2. Server auto-reloads (using `tsx watch`)
3. Test changes with curl or Swagger UI

### Adding New Endpoints

1. Create route handler in `src/routes/`
2. Register route in `src/app.ts`
3. Add Swagger schema for documentation
4. Test endpoint

### Modifying Database Schema

1. Create new migration:
   ```bash
   npm run migrate:create -- add-new-field
   ```

2. Edit the generated file in `migrations/`

3. Run migration:
   ```bash
   npm run migrate:up
   ```

## Code Quality Checks

```bash
# Run all checks
npm run lint
npm run typecheck
npm run build

# Auto-fix lint issues
npx eslint src --ext .ts --fix
```

## Useful Commands

```bash
# View all database tables
docker exec -it flipstats-postgres psql -U flipstats -d flipstats_db -c "\dt"

# Query emcees count
docker exec -it flipstats-postgres psql -U flipstats -d flipstats_db -c "SELECT COUNT(*) FROM emcees;"

# View recent ingest runs
docker exec -it flipstats-postgres psql -U flipstats -d flipstats_db -c "SELECT * FROM ingest_runs ORDER BY started_at DESC LIMIT 5;"

# Reset database (caution!)
docker-compose down -v
docker-compose up -d postgres
npm run migrate:up
```

## Next Steps

1. ✅ Set up the project
2. ✅ Run first ingestion
3. ✅ Test all API endpoints
4. 📚 Read through the code to understand architecture
5. 🔧 Customize selectors for actual website structure
6. 🧪 Add tests (future enhancement)
7. 🚀 Deploy to production
8. 📊 Add monitoring and alerting

## Support

For issues or questions:
1. Check the [README.md](README.md)
2. Review the code comments
3. Check API docs at `/docs`
4. Review logs with `docker-compose logs -f api`

---

Good luck with your learning journey! 🚀
