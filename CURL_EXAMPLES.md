# FlipStats API - cURL Examples

Quick reference for testing the API endpoints.

## Prerequisites

```bash
export API_URL="http://localhost:3000"
export ADMIN_TOKEN="your-secret-admin-token-change-this-in-production"
```

---

## Health & Info

### Health Check
```bash
curl -s $API_URL/health | jq
```

### API Info
```bash
curl -s $API_URL/ | jq
```

### API Documentation (Browser)
```bash
# Open in browser
open $API_URL/docs
# Or on Linux
xdg-open $API_URL/docs
```

---

## Emcees Endpoints

### List All Emcees (Default: 20 per page)
```bash
curl -s $API_URL/v1/emcees | jq
```

### List Emcees with Pagination
```bash
# First page, 10 items
curl -s "$API_URL/v1/emcees?page=1&limit=10" | jq

# Second page
curl -s "$API_URL/v1/emcees?page=2&limit=10" | jq
```

### Filter by Division
```bash
curl -s "$API_URL/v1/emcees?division=Metro%20Manila" | jq
```

### Search by Name
```bash
# Search for emcees with "anygma" in name
curl -s "$API_URL/v1/emcees?search=anygma" | jq
```

### Sort Emcees
```bash
# By name (default)
curl -s "$API_URL/v1/emcees?sort=name" | jq

# By year joined (newest first)
curl -s "$API_URL/v1/emcees?sort=year_joined" | jq

# By created date (most recent first)
curl -s "$API_URL/v1/emcees?sort=created_at" | jq
```

### Combined Filters
```bash
# Division + Search + Pagination + Sort
curl -s "$API_URL/v1/emcees?division=Metro%20Manila&search=a&page=1&limit=5&sort=name" | jq
```

### Get Single Emcee by Slug
```bash
# Replace 'anygma' with actual slug
curl -s $API_URL/v1/emcees/anygma | jq
```

### Get Emcee (Handle 404)
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" \
  $API_URL/v1/emcees/non-existent-slug | jq
```

---

## Divisions Endpoint

### Get All Divisions
```bash
curl -s $API_URL/v1/divisions | jq
```

### Get Divisions (Pretty Print)
```bash
curl -s $API_URL/v1/divisions | jq -r '.divisions[]'
```

---

## Admin Endpoints (Protected)

### Trigger Emcees Ingestion
```bash
curl -X POST $API_URL/admin/refresh-emcees \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" | jq
```

### Trigger Ingestion with Verbose Output
```bash
curl -X POST $API_URL/admin/refresh-emcees \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -v | jq
```

### Test Unauthorized Access (Should Return 401)
```bash
curl -X POST $API_URL/admin/refresh-emcees \
  -H "X-Admin-Token: wrong-token" \
  -w "\nHTTP Status: %{http_code}\n" | jq
```

---

## Advanced Examples

### Count Total Emcees
```bash
curl -s $API_URL/v1/emcees?limit=1 | jq '.pagination.total'
```

### Get Only Emcee Names
```bash
curl -s $API_URL/v1/emcees?limit=100 | jq -r '.data[].name'
```

### Get Emcees from Specific Year
```bash
curl -s $API_URL/v1/emcees?limit=100 | \
  jq '.data[] | select(.year_joined == 2010)'
```

### Export Emcees to CSV
```bash
curl -s "$API_URL/v1/emcees?limit=1000" | \
  jq -r '.data[] | [.slug, .name, .division, .year_joined] | @csv' > emcees.csv
```

### Get Emcees Count by Division
```bash
# First get all divisions
DIVISIONS=$(curl -s $API_URL/v1/divisions | jq -r '.divisions[]')

# Count emcees per division
for division in $DIVISIONS; do
  encoded=$(echo $division | jq -sRr @uri)
  count=$(curl -s "$API_URL/v1/emcees?division=$encoded&limit=1" | jq '.pagination.total')
  echo "$division: $count"
done
```

### Monitor Ingestion Progress
```bash
# Run in one terminal
curl -X POST $API_URL/admin/refresh-emcees \
  -H "X-Admin-Token: $ADMIN_TOKEN" | jq

# Watch logs in another terminal
docker-compose logs -f api
```

---

## Testing Scenarios

### 1. Complete API Test Flow
```bash
echo "=== Testing FlipStats API ==="

echo -e "\n1. Health Check"
curl -s $API_URL/health | jq -r '.status'

echo -e "\n2. List Emcees (should be empty initially)"
curl -s $API_URL/v1/emcees | jq '.pagination.total'

echo -e "\n3. Trigger Ingestion (may take several minutes)"
curl -X POST $API_URL/admin/refresh-emcees \
  -H "X-Admin-Token: $ADMIN_TOKEN" | jq '.message'

echo -e "\n4. List Emcees Again (should have data)"
curl -s $API_URL/v1/emcees | jq '.pagination.total'

echo -e "\n5. Get Divisions"
curl -s $API_URL/v1/divisions | jq -r '.divisions[]'

echo -e "\n=== Test Complete ==="
```

### 2. Load Testing (Simple)
```bash
# Test API performance with 100 requests
for i in {1..100}; do
  curl -s $API_URL/v1/emcees?limit=10 > /dev/null &
done
wait
echo "Load test complete"
```

### 3. Validation Test
```bash
# Test invalid parameters
echo "Testing invalid page number:"
curl -s "$API_URL/v1/emcees?page=0" | jq '.error'

echo "Testing invalid limit:"
curl -s "$API_URL/v1/emcees?limit=1000" | jq '.error'

echo "Testing invalid sort:"
curl -s "$API_URL/v1/emcees?sort=invalid" | jq '.error'
```

---

## PowerShell Equivalents (for Windows)

### Set Environment Variables
```powershell
$API_URL = "http://localhost:3000"
$ADMIN_TOKEN = "your-secret-admin-token-change-this-in-production"
```

### Health Check
```powershell
Invoke-RestMethod -Uri "$API_URL/health"
```

### List Emcees
```powershell
Invoke-RestMethod -Uri "$API_URL/v1/emcees"
```

### Get Single Emcee
```powershell
Invoke-RestMethod -Uri "$API_URL/v1/emcees/anygma"
```

### Trigger Ingestion
```powershell
$headers = @{
    "X-Admin-Token" = $ADMIN_TOKEN
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Uri "$API_URL/admin/refresh-emcees" -Method Post -Headers $headers
```

### Get Divisions
```powershell
(Invoke-RestMethod -Uri "$API_URL/v1/divisions").divisions
```

---

## Using HTTPie (Alternative to cURL)

Install: `brew install httpie` or `pip install httpie`

### Examples
```bash
# Health check
http GET $API_URL/health

# List emcees
http GET $API_URL/v1/emcees

# Filter and search
http GET $API_URL/v1/emcees division=="Metro Manila" search==anygma

# Get single emcee
http GET $API_URL/v1/emcees/anygma

# Trigger ingestion
http POST $API_URL/admin/refresh-emcees X-Admin-Token:$ADMIN_TOKEN
```

---

## Debugging Tips

### View Response Headers
```bash
curl -i $API_URL/health
```

### Measure Response Time
```bash
curl -w "\nTime: %{time_total}s\n" -s -o /dev/null $API_URL/v1/emcees
```

### Save Response to File
```bash
curl -s $API_URL/v1/emcees > emcees.json
```

### Follow Redirects
```bash
curl -L $API_URL/v1/emcees
```

### Verbose Output (Debug)
```bash
curl -v $API_URL/health
```

---

## Quick Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/` | GET | No | API info |
| `/docs` | GET | No | Swagger UI |
| `/v1/emcees` | GET | No | List emcees |
| `/v1/emcees/:slug` | GET | No | Get single emcee |
| `/v1/divisions` | GET | No | List divisions |
| `/admin/refresh-emcees` | POST | Yes | Trigger ingestion |

---

**Pro Tip**: Install `jq` for JSON formatting:
- macOS: `brew install jq`
- Ubuntu: `apt-get install jq`
- Windows: `choco install jq`

Or use online tools: https://jqplay.org/
