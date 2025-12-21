# FlipStats API - Architecture Documentation

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         EXTERNAL USERS                          │
│                    (Developers, Applications)                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP Requests
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      FASTIFY API SERVER                         │
│                      (Port 3000)                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    PUBLIC ROUTES                         │  │
│  │  - GET  /health          (Health Check)                  │  │
│  │  - GET  /v1/emcees       (List Emcees)                   │  │
│  │  - GET  /v1/emcees/:slug (Get Single)                    │  │
│  │  - GET  /v1/divisions    (List Divisions)                │  │
│  │                                                           │  │
│  │  ✓ No authentication required                            │  │
│  │  ✓ Reads from database only (NEVER scrapes)              │  │
│  │  ✓ Fast response times                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             │ Database Queries                   │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│                      ADMIN ROUTES                                │
│                   (Protected by Token)                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  - POST /admin/refresh-emcees                            │   │
│  │                                                           │   │
│  │  ✓ Requires X-Admin-Token header                         │   │
│  │  ✓ Triggers scraping workflow                            │   │
│  │  ✓ Returns ingestion summary                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             │ Triggers                           │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │              INGESTION ENGINE                            │   │
│  │              (src/ingest/emcees.ts)                      │   │
│  │                                                           │   │
│  │  1. Scrape directory page                                │   │
│  │     ├─ Extract emcee links                               │   │
│  │     └─ Parse slugs                                       │   │
│  │                                                           │   │
│  │  2. Scrape individual profiles                           │   │
│  │     ├─ Random delays (500-1200ms)                        │   │
│  │     ├─ Retry with backoff (3 attempts)                   │   │
│  │     ├─ Parse HTML with Cheerio                           │   │
│  │     └─ Extract structured data                           │   │
│  │                                                           │   │
│  │  3. Database operations                                  │   │
│  │     ├─ Upsert emcees (insert or update)                  │   │
│  │     ├─ Track ingest_run                                  │   │
│  │     └─ Record statistics                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               │ HTTPS
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                    EXTERNAL DATA SOURCE                          │
│              https://www.fliptop.com.ph/emcees                   │
│                                                                   │
│  - Emcees directory page                                         │
│  - Individual emcee profile pages                                │
│  - HTML content (parsed with Cheerio)                            │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                              │
│                   PostgreSQL 16 (Port 5432)                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  TABLE: emcees                                           │   │
│  │  ├─ id (BIGSERIAL, PK)                                   │   │
│  │  ├─ slug (TEXT, UNIQUE)  ← Indexed                       │   │
│  │  ├─ name (TEXT)          ← Indexed                       │   │
│  │  ├─ division (TEXT)      ← Indexed                       │   │
│  │  ├─ hometown (TEXT)                                      │   │
│  │  ├─ reppin (TEXT)                                        │   │
│  │  ├─ year_joined (INT)                                    │   │
│  │  ├─ bio (TEXT)                                           │   │
│  │  ├─ source_url (TEXT)                                    │   │
│  │  ├─ created_at (TIMESTAMPTZ)                             │   │
│  │  └─ updated_at (TIMESTAMPTZ)                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  TABLE: ingest_runs                                      │   │
│  │  ├─ id (BIGSERIAL, PK)                                   │   │
│  │  ├─ type (TEXT)          ← Indexed                       │   │
│  │  ├─ started_at (TIMESTAMPTZ) ← Indexed                   │   │
│  │  ├─ finished_at (TIMESTAMPTZ)                            │   │
│  │  ├─ found_count (INT)                                    │   │
│  │  ├─ updated_count (INT)                                  │   │
│  │  ├─ failed_count (INT)                                   │   │
│  │  ├─ status (TEXT) - SUCCESS/FAIL                         │   │
│  │  └─ error_summary (TEXT)                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Public API Request Flow (Fast Path)

```
User Request
    │
    ├─ GET /v1/emcees?division=Metro Manila
    │
    ▼
Fastify Router
    │
    ├─ Validate query params (Zod)
    │
    ▼
Database Query (src/db/queries/emcees.ts)
    │
    ├─ SELECT * FROM emcees WHERE division = $1
    ├─ Apply pagination (LIMIT/OFFSET)
    ├─ Apply sorting (ORDER BY)
    │
    ▼
Return JSON Response
    │
    └─ { data: [...], pagination: {...} }
```

**Response Time**: ~10-50ms (database query only)

---

### Admin Ingestion Flow (Slow Path)

```
Admin Request
    │
    ├─ POST /admin/refresh-emcees
    ├─ Header: X-Admin-Token
    │
    ▼
Authentication Check
    │
    ├─ Verify admin token
    │
    ▼
Create Ingest Run Record
    │
    ├─ INSERT INTO ingest_runs (type, status)
    ├─ status = 'FAIL' (optimistic)
    │
    ▼
Scrape Directory Page
    │
    ├─ GET https://www.fliptop.com.ph/emcees
    ├─ Parse HTML with Cheerio
    ├─ Extract: [{slug, name, profileUrl}, ...]
    │
    ▼
For Each Emcee:
    │
    ├─ Random delay (500-1200ms)
    │
    ├─ GET https://www.fliptop.com.ph/emcees/{slug}
    ├─ Parse profile HTML
    ├─ Extract: name, division, hometown, etc.
    │
    ├─ Retry on failure (exponential backoff)
    │
    ├─ Upsert to database:
    │   INSERT ... ON CONFLICT (slug) DO UPDATE
    │
    └─ Log progress
    │
    ▼
Update Ingest Run Record
    │
    ├─ UPDATE ingest_runs SET
    ├─   status = 'SUCCESS'
    ├─   finished_at = now()
    ├─   found_count = X
    ├─   updated_count = Y
    ├─   failed_count = Z
    │
    ▼
Return Summary
    │
    └─ { success: true, found: X, updated: Y, ... }
```

**Duration**: ~5-15 minutes (depends on number of emcees)

---

## Component Architecture

### Separation of Concerns

```
┌─────────────────────────────────────────────────┐
│              PRESENTATION LAYER                 │
│                                                 │
│  - Fastify routes (src/routes/)                │
│  - Request validation (Zod)                     │
│  - Response formatting                          │
│  - Error handling                               │
│  - OpenAPI documentation                        │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              BUSINESS LOGIC LAYER               │
│                                                 │
│  - Ingestion orchestration (src/ingest/)       │
│  - Scraping logic (Cheerio)                    │
│  - Data transformation                          │
│  - Retry & backoff logic                        │
│  - Rate limiting (delays)                       │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│                DATA ACCESS LAYER                │
│                                                 │
│  - Database queries (src/db/queries/)          │
│  - Raw SQL (no ORM)                             │
│  - Connection pooling                           │
│  - Transaction management                       │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│               INFRASTRUCTURE LAYER              │
│                                                 │
│  - PostgreSQL database                          │
│  - Node.js runtime                              │
│  - Docker containers                            │
│  - Environment configuration                    │
└─────────────────────────────────────────────────┘
```

---

## Deployment Architecture

### Local Development

```
┌──────────────────────────────────────────┐
│         Developer Machine                │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Terminal 1: npm run dev           │ │
│  │  (TypeScript hot reload)           │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Docker: PostgreSQL Container      │ │
│  │  (Port 5432)                       │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Browser: Swagger UI               │ │
│  │  (http://localhost:3000/docs)      │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Docker Compose (Local Testing)

```
┌────────────────────────────────────────────────┐
│           Docker Compose Stack                 │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  flipstats-api (Container)               │ │
│  │  - Built from Dockerfile                 │ │
│  │  - Port: 3000                            │ │
│  │  - ENV: DATABASE_URL, ADMIN_TOKEN        │ │
│  └──────────────┬───────────────────────────┘ │
│                 │                              │
│                 │ postgres://                  │
│                 │                              │
│  ┌──────────────▼───────────────────────────┐ │
│  │  flipstats-postgres (Container)          │ │
│  │  - Image: postgres:16-alpine             │ │
│  │  - Port: 5432                            │ │
│  │  - Volume: postgres_data                 │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Network: flipstats-network (Bridge)          │
└────────────────────────────────────────────────┘
```

### Production Deployment

```
┌────────────────────────────────────────────────────┐
│                  Cloud Provider                    │
│              (AWS, GCP, Azure, etc.)               │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │         Load Balancer / Reverse Proxy        │ │
│  │              (HTTPS Termination)             │ │
│  └────────────────┬─────────────────────────────┘ │
│                   │                                │
│  ┌────────────────▼─────────────────────────────┐ │
│  │        API Container Instances (N)           │ │
│  │                                              │ │
│  │  - Horizontal scaling                        │ │
│  │  - Health checks: /health                    │ │
│  │  - Auto-restart on failure                   │ │
│  └────────────────┬─────────────────────────────┘ │
│                   │                                │
│  ┌────────────────▼─────────────────────────────┐ │
│  │     Managed PostgreSQL Service              │ │
│  │                                              │ │
│  │  - Automated backups                         │ │
│  │  - Point-in-time recovery                    │ │
│  │  - Read replicas (optional)                  │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│              External Triggers                     │
│                                                    │
│  - GitHub Actions (yearly cron)                   │
│  - Manual webhook                                  │
│  - Admin dashboard                                 │
│                                                    │
│  ──► POST /admin/refresh-emcees                   │
└────────────────────────────────────────────────────┘
```

---

## Security Architecture

```
┌─────────────────────────────────────────┐
│          Security Layers                │
└─────────────────────────────────────────┘

1. NETWORK LEVEL
   ├─ HTTPS/TLS encryption (production)
   ├─ Firewall rules
   └─ VPC isolation (database)

2. APPLICATION LEVEL
   ├─ Admin token authentication
   │  └─ Header: X-Admin-Token
   ├─ Input validation (Zod)
   ├─ SQL injection prevention (parameterized queries)
   ├─ Rate limiting (recommended: add in production)
   └─ CORS configuration

3. DATABASE LEVEL
   ├─ Connection string secrets
   ├─ Role-based access control
   ├─ Connection pooling limits
   └─ Encrypted connections

4. CONTAINER LEVEL
   ├─ Non-root user (nodejs:1001)
   ├─ Minimal base image (alpine)
   ├─ No sensitive data in images
   └─ Read-only root filesystem (optional)

5. OPERATIONAL LEVEL
   ├─ Environment variable secrets
   ├─ Structured logging (no secrets)
   ├─ Error messages (no stack traces in prod)
   └─ Dependency scanning
```

---

## Observability Stack

```
┌─────────────────────────────────────────┐
│            LOGGING (Pino)               │
│                                         │
│  - Structured JSON logs                 │
│  - Request/response logging             │
│  - Error tracking with context          │
│  - Performance metrics                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         HEALTH CHECKS                   │
│                                         │
│  - GET /health                          │
│  - Database connectivity check          │
│  - Docker healthcheck directive         │
│  - Load balancer probes                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│      AUDIT TRAIL (Database)             │
│                                         │
│  - ingest_runs table                    │
│  - Tracks all scraping operations       │
│  - Success/failure statistics           │
│  - Error summaries                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│    API DOCUMENTATION (Swagger)          │
│                                         │
│  - Interactive API explorer             │
│  - Auto-generated from schemas          │
│  - Try-it-out functionality             │
│  - Available at /docs                   │
└─────────────────────────────────────────┘
```

---

## CI/CD Pipeline

```
┌────────────────────────────────────────────────────┐
│              GitHub Repository                     │
│         (git push / pull request)                  │
└─────────────────┬──────────────────────────────────┘
                  │
                  │ Trigger
                  │
┌─────────────────▼──────────────────────────────────┐
│            GitHub Actions CI                       │
│                                                    │
│  1. Checkout code                                  │
│  2. Setup Node.js 20                               │
│  3. Install dependencies (npm ci)                  │
│  4. Run linter (npm run lint)                      │
│  5. Run type check (npm run typecheck)             │
│  6. Build application (npm run build)              │
│  7. Run database migrations                        │
│  8. Run tests (npm test)                           │
│  9. Build Docker image                             │
│                                                    │
│  ✓ All checks must pass                            │
└─────────────────┬──────────────────────────────────┘
                  │
                  │ On Success
                  │
┌─────────────────▼──────────────────────────────────┐
│            Ready for Deployment                    │
│                                                    │
│  - Docker image built and cached                   │
│  - All tests passed                                │
│  - Code quality verified                           │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│        Scheduled Data Refresh Workflow             │
│                                                    │
│  Trigger: Yearly (Jan 1) or Manual                 │
│                                                    │
│  1. Call POST /admin/refresh-emcees                │
│  2. Wait for completion                            │
│  3. Notify on success/failure                      │
└────────────────────────────────────────────────────┘
```

---

## Why This Architecture?

### ✅ Pros

1. **Performance**
   - Public APIs serve from database (fast)
   - Scraping doesn't block API requests
   - Connection pooling for efficiency

2. **Reliability**
   - Scraping failures don't affect API
   - Database as single source of truth
   - Graceful degradation

3. **Maintainability**
   - Clear separation of concerns
   - No ORM magic - SQL is visible
   - Easy to understand data flow

4. **Scalability**
   - Horizontal scaling of API instances
   - Database handles concurrent reads
   - Scraping is independent operation

5. **DevOps-Friendly**
   - Containerized for consistency
   - Environment-based config
   - Easy CI/CD integration
   - Observable and debuggable

6. **Learning-Focused**
   - Exposes fundamentals (SQL, HTTP, async)
   - No framework magic
   - Clear architecture patterns
   - Production-ready practices

### ⚠️ Trade-offs

1. **Data Freshness**
   - Data only as fresh as last ingestion
   - Not real-time (by design)
   - Acceptable for this use case

2. **Scraping Fragility**
   - Breaks if HTML structure changes
   - Requires selector updates
   - Mitigated with monitoring

3. **No ORM**
   - Manual SQL writing required
   - More verbose queries
   - But: SQL is visible and learnable

---

## Future Enhancements

```
┌────────────────────────────────────────┐
│         Potential Additions            │
└────────────────────────────────────────┘

1. CACHING LAYER
   - Redis for hot data
   - Reduce database load
   - Faster response times

2. AUTHENTICATION
   - API keys for public endpoints
   - Rate limiting per user
   - Usage tracking

3. ANALYTICS
   - Track popular emcees
   - Search patterns
   - API usage metrics

4. WEBHOOK NOTIFICATIONS
   - Notify on ingestion complete
   - Alert on failures
   - Slack/Discord integration

5. ADVANCED SEARCH
   - Full-text search (PostgreSQL FTS)
   - Fuzzy name matching
   - Multi-field search

6. DATA VERSIONING
   - Track historical changes
   - Compare emcee data over time
   - Audit trail for changes

7. GRAPHQL API
   - Alternative to REST
   - Client-specific queries
   - Real-time subscriptions
```

---

This architecture provides a solid foundation for learning backend development while following production-ready practices!
