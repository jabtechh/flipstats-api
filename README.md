# FlipStats API

A learning-focused backend service that converts the FlipTop Emcees website into a clean, reusable REST API.

## 🎯 Project Goals

- **Learn Backend Development**: Understand API design, database management, and scraping best practices
- **DevOps Fundamentals**: Docker, CI/CD, environment management, and deployment
- **Production-Ready Code**: Clean architecture, proper error handling, structured logging

## 🏗️ Architecture

### Separation of Concerns
- **Ingestion Layer**: Scrapes data from FlipTop website (admin-only, controlled)
- **Data Layer**: Postgres database as the source of truth
- **API Layer**: Fastify server that reads from database only (never scrapes)

### Why This Approach?

1. **Performance**: Public APIs read from database (fast) instead of scraping (slow)
2. **Reliability**: Scraping failures don't affect public API availability
3. **Respectful**: Controlled scraping with delays, retries, and proper user agent
4. **Scalable**: Database can handle many concurrent reads
5. **Observable**: Ingest runs tracked in database for monitoring

## 📦 Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **API Framework**: Fastify (fast, schema-based)
- **Database**: PostgreSQL 16
- **Database Client**: pg (node-postgres) with raw SQL
- **Migrations**: node-pg-migrate
- **Scraping**: Cheerio (jQuery-like HTML parsing)
- **Validation**: Zod
- **Logging**: Pino (structured JSON logging)
- **Documentation**: OpenAPI/Swagger
- **DevOps**: Docker, Docker Compose, GitHub Actions

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### 1. Clone and Install

```bash
git clone <repository-url>
cd flipstats-api
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` and update values (especially `ADMIN_TOKEN`):

```env
PORT=3000
DATABASE_URL=postgresql://flipstats:flipstats_password@localhost:5432/flipstats_db
ADMIN_TOKEN=your-secret-admin-token-change-this
```

### 3. Start Database

```bash
docker-compose up -d postgres
```

### 4. Run Migrations

```bash
npm run migrate:up
```

### 5. Start Development Server

```bash
npm run dev
```

API will be available at http://localhost:3000

## 🗂️ Project Structure

```
flipstats-api/
├── src/
│   ├── server.ts              # Entry point
│   ├── app.ts                 # Fastify app setup
│   ├── db/
│   │   ├── pool.ts            # Database connection pool
│   │   └── queries/
│   │       ├── emcees.ts      # Emcees SQL queries
│   │       └── ingestRuns.ts  # Ingest runs SQL queries
│   ├── routes/
│   │   ├── health.ts          # Health check endpoint
│   │   ├── emcees.ts          # Emcees public endpoints
│   │   ├── divisions.ts       # Divisions endpoint
│   │   └── admin.ts           # Admin endpoints (protected)
│   └── ingest/
│       └── emcees.ts          # Scraping & ingestion logic
├── migrations/
│   └── 1734825600000_init.js  # Initial database schema
├── .github/workflows/
│   ├── ci.yml                 # CI pipeline
│   └── refresh-data.yml       # Data refresh workflow
├── Dockerfile                 # Production container
├── docker-compose.yml         # Local development stack
├── package.json
├── tsconfig.json
└── README.md
```

## 📊 Database Schema

### `emcees` Table
Stores all emcee data scraped from FlipTop.

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| slug | TEXT | Unique URL slug |
| name | TEXT | Emcee name |
| division | TEXT | Division (nullable) |
| hometown | TEXT | Hometown (nullable) |
| reppin | TEXT | What they rep (nullable) |
| year_joined | INT | Year joined (nullable) |
| bio | TEXT | Biography (nullable) |
| source_url | TEXT | Source URL from FlipTop |
| created_at | TIMESTAMPTZ | First ingested |
| updated_at | TIMESTAMPTZ | Last updated |

**Indexes**: `slug` (unique), `division`, `name`

### `ingest_runs` Table
Tracks scraping/ingestion runs for monitoring.

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| type | TEXT | Type (EMCEES) |
| started_at | TIMESTAMPTZ | When started |
| finished_at | TIMESTAMPTZ | When finished |
| found_count | INT | Items found |
| updated_count | INT | Items updated |
| failed_count | INT | Items failed |
| status | TEXT | SUCCESS/FAIL |
| error_summary | TEXT | Error details |

## 🔌 API Endpoints

### Public Endpoints

#### `GET /health`
Health check with database status.

```bash
curl http://localhost:3000/health
```

#### `GET /v1/emcees`
List emcees with filtering and pagination.

**Query Parameters:**
- `division` (string): Filter by division
- `search` (string): Search by name
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `sort` (string): Sort by `name`, `year_joined`, or `created_at`

```bash
# Get all emcees
curl http://localhost:3000/v1/emcees

# Filter by division
curl http://localhost:3000/v1/emcees?division=Metro%20Manila

# Search by name
curl http://localhost:3000/v1/emcees?search=anygma

# Paginate
curl http://localhost:3000/v1/emcees?page=2&limit=10
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "slug": "anygma",
      "name": "Anygma",
      "division": "Metro Manila",
      "hometown": "Quezon City",
      "reppin": "FlipTop",
      "year_joined": 2010,
      "bio": "...",
      "source_url": "https://www.fliptop.com.ph/emcees/anygma",
      "created_at": "2024-12-21T10:00:00Z",
      "updated_at": "2024-12-21T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### `GET /v1/emcees/:slug`
Get a single emcee by slug.

```bash
curl http://localhost:3000/v1/emcees/anygma
```

#### `GET /v1/divisions`
Get all unique divisions.

```bash
curl http://localhost:3000/v1/divisions
```

**Response:**
```json
{
  "divisions": [
    "Metro Manila",
    "Luzon",
    "Visayas",
    "Mindanao"
  ]
}
```

### Admin Endpoints

#### `POST /admin/refresh-emcees`
Trigger emcees data ingestion (requires admin token).

```bash
curl -X POST http://localhost:3000/admin/refresh-emcees \
  -H "X-Admin-Token: your-secret-admin-token"
```

**Response:**
```json
{
  "success": true,
  "message": "Emcees ingestion completed successfully",
  "result": {
    "found": 150,
    "updated": 150,
    "failed": 0,
    "runId": 1
  }
}
```

## 🐳 Docker Usage

### Development with Docker Compose

```bash
# Start all services (postgres + api)
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop all services
docker-compose down

# Stop and remove volumes (deletes database)
docker-compose down -v
```

### Production Docker Build

```bash
# Build image
docker build -t flipstats-api:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e ADMIN_TOKEN=secret \
  flipstats-api:latest
```

## 🔄 Database Migrations

```bash
# Run all pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Create new migration
npm run migrate:create -- my-migration-name
```

## 🧪 Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript to JavaScript
npm start            # Start production server (requires build)
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking
npm test             # Run tests (placeholder)
```

## 📝 Ingestion Logic

The scraping/ingestion process:

1. **Fetch Directory**: Scrapes https://www.fliptop.com.ph/emcees
2. **Extract Links**: Gets all emcee profile URLs and slugs
3. **Scrape Profiles**: Visits each profile page one at a time
4. **Extract Data**: Parses HTML to extract emcee details
5. **Upsert Database**: Inserts new or updates existing records
6. **Track Results**: Records run statistics in `ingest_runs` table

**Key Features:**
- Random delay (500-1200ms) between requests
- Retry with exponential backoff (3 attempts)
- Graceful handling of missing/changed HTML fields
- Comprehensive error logging
- Transaction safety

## 🔐 Security Notes

1. **Admin Token**: Change `ADMIN_TOKEN` in production
2. **CORS**: Configure allowed origins in production
3. **Rate Limiting**: Add rate limiting for production
4. **HTTPS**: Use HTTPS in production
5. **Database**: Use strong passwords and restrict access

## 🚦 CI/CD Workflows

### CI Pipeline (`.github/workflows/ci.yml`)
Runs on push/PR:
1. Install dependencies
2. Run linter
3. Run type check
4. Build application
5. Run database migrations
6. Run tests
7. Build Docker image

### Data Refresh (`.github/workflows/refresh-data.yml`)
- Manual trigger via GitHub Actions UI
- Scheduled yearly (January 1st)
- Calls admin endpoint to refresh data

**Setup:**
1. Add GitHub secrets:
   - `API_URL`: Your production API URL
   - `ADMIN_TOKEN`: Your admin token

## 🎓 Learning Points

### Backend Concepts
- REST API design and versioning
- Database modeling and indexing
- Raw SQL vs ORM tradeoffs
- Connection pooling
- Transaction management
- Input validation and error handling
- Structured logging
- API documentation

### DevOps Concepts
- Containerization (Docker)
- Multi-stage builds
- Environment variables
- Service orchestration (Docker Compose)
- Health checks
- Graceful shutdown
- CI/CD pipelines
- Infrastructure as Code

### Web Scraping Best Practices
- Respectful scraping (delays, retries)
- User agent identification
- HTML parsing with Cheerio
- Error handling and fallbacks
- Separating ingestion from serving

## 🤝 Contributing

This is a learning project. Feel free to:
- Report issues with scraping selectors
- Suggest improvements to architecture
- Add tests
- Improve documentation

## 📄 License

MIT

## 🔗 Resources

- [Fastify Documentation](https://www.fastify.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [node-postgres Documentation](https://node-postgres.com/)
- [Cheerio Documentation](https://cheerio.js.org/)
- [Docker Documentation](https://docs.docker.com/)

---

Built with ❤️ for learning backend development and DevOps practices.
