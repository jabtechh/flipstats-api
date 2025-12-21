# ========================================
# FlipStats API - Complete Test Suite
# ========================================
# 
# HOW TO USE:
# 1. Open TWO PowerShell terminals
# 2. In Terminal 1, run: npm run dev
# 3. In Terminal 2, run: .\run-tests.ps1
#
# ========================================

$API_URL = "http://localhost:3000"
$ADMIN_TOKEN = "your-secret-admin-token-change-this-in-production"

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   FlipStats API - Complete Test Suite  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if server is running
Write-Host "🔍 Checking if server is running..." -ForegroundColor Yellow
try {
    $null = Invoke-WebRequest -Uri $API_URL -UseBasicParsing -TimeoutSec 2 2>$null
    Write-Host "✓ Server is running!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "✗ Server is not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start the server first:" -ForegroundColor Yellow
    Write-Host "  1. Open a new PowerShell terminal" -ForegroundColor White
    Write-Host "  2. Run these commands:" -ForegroundColor White
    Write-Host "     `$env:DATABASE_URL='postgresql://flipstats:flipstats_password@localhost:5432/flipstats_db'" -ForegroundColor Gray
    Write-Host "     `$env:ADMIN_TOKEN='your-secret-admin-token-change-this-in-production'" -ForegroundColor Gray
    Write-Host "     npm run dev" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# Test 1: Root Endpoint
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Test 1: Root Endpoint (GET /)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$API_URL/"
    Write-Host "✓ Success!" -ForegroundColor Green
    Write-Host "  Name: $($response.name)" -ForegroundColor White
    Write-Host "  Version: $($response.version)" -ForegroundColor White
    Write-Host "  Description: $($response.description)" -ForegroundColor White
} catch {
    Write-Host "✗ Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Health Check
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Test 2: Health Check (GET /health)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$API_URL/health"
    Write-Host "✓ Success!" -ForegroundColor Green
    Write-Host "  Status: $($response.status)" -ForegroundColor White
    Write-Host "  Database: $($response.database)" -ForegroundColor White
    Write-Host "  Emcees Count: $($response.emcees_count)" -ForegroundColor White
    Write-Host "  Timestamp: $($response.timestamp)" -ForegroundColor White
} catch {
    Write-Host "✗ Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: List Emcees
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Test 3: List Emcees (GET /v1/emcees)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$API_URL/v1/emcees"
    Write-Host "✓ Success!" -ForegroundColor Green
    Write-Host "  Total Emcees: $($response.pagination.total)" -ForegroundColor White
    Write-Host "  Current Page: $($response.pagination.page)" -ForegroundColor White
    Write-Host "  Per Page: $($response.pagination.limit)" -ForegroundColor White
    Write-Host "  Total Pages: $($response.pagination.totalPages)" -ForegroundColor White
    Write-Host "  Results in this page: $($response.data.Count)" -ForegroundColor White
    
    if ($response.data.Count -gt 0) {
        Write-Host ""
        Write-Host "  First emcee:" -ForegroundColor Yellow
        $first = $response.data[0]
        Write-Host "    - Slug: $($first.slug)" -ForegroundColor White
        Write-Host "    - Name: $($first.name)" -ForegroundColor White
        if ($first.division) { Write-Host "    - Division: $($first.division)" -ForegroundColor White }
    }
} catch {
    Write-Host "✗ Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: Get Divisions
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Test 4: Get Divisions (GET /v1/divisions)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$API_URL/v1/divisions"
    Write-Host "✓ Success!" -ForegroundColor Green
    Write-Host "  Total Divisions: $($response.divisions.Count)" -ForegroundColor White
    if ($response.divisions.Count -gt 0) {
        Write-Host "  Divisions:" -ForegroundColor Yellow
        foreach ($div in $response.divisions) {
            Write-Host "    - $div" -ForegroundColor White
        }
    }
} catch {
    Write-Host "✗ Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: Pagination Test
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Test 5: Pagination (GET /v1/emcees?limit=5)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$API_URL/v1/emcees?limit=5"
    Write-Host "✓ Success!" -ForegroundColor Green
    Write-Host "  Requested limit: 5" -ForegroundColor White
    Write-Host "  Results returned: $($response.data.Count)" -ForegroundColor White
} catch {
    Write-Host "✗ Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 6: 404 Test (Non-existent emcee)
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Test 6: 404 Handling (GET /v1/emcees/nonexistent)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$API_URL/v1/emcees/nonexistent-slug-12345"
    Write-Host "✗ Should have returned 404!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "✓ Correctly returned 404!" -ForegroundColor Green
    } else {
        Write-Host "✗ Unexpected error: $_" -ForegroundColor Red
    }
}
Write-Host ""

# Test 7: Admin Auth Test (Unauthorized)
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Test 7: Admin Auth (No Token - Should Fail)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$API_URL/admin/refresh-emcees" -Method Post
    Write-Host "✗ Should have been rejected!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✓ Correctly rejected unauthorized request!" -ForegroundColor Green
    } else {
        Write-Host "✗ Unexpected error: $_" -ForegroundColor Red
    }
}
Write-Host ""

# Summary
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         All Tests Complete!            ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  - View API docs: http://localhost:3000/docs" -ForegroundColor White
Write-Host "  - Trigger ingestion: .\trigger-ingestion.ps1" -ForegroundColor White
Write-Host ""
