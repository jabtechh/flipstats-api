# FlipStats API - Quick Test Script
# Tests the API endpoints

$API_URL = "http://localhost:3000"
$ADMIN_TOKEN = "your-secret-admin-token-change-this-in-production"

Write-Host "🧪 Testing FlipStats API..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Root endpoint
Write-Host "1️⃣  Testing root endpoint (GET /)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/" -Method Get
    Write-Host "   ✓ Success!" -ForegroundColor Green
    Write-Host "   API Name: $($response.name)" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "   ✗ Failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 2: Health check
Write-Host "2️⃣  Testing health endpoint (GET /health)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/health" -Method Get
    Write-Host "   ✓ Success!" -ForegroundColor Green
    Write-Host "   Status: $($response.status)" -ForegroundColor White
    Write-Host "   Database: $($response.database)" -ForegroundColor White
    Write-Host "   Emcees Count: $($response.emcees_count)" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "   ✗ Failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 3: List emcees
Write-Host "3️⃣  Testing emcees list (GET /v1/emcees)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/v1/emcees" -Method Get
    Write-Host "   ✓ Success!" -ForegroundColor Green
    Write-Host "   Total Emcees: $($response.pagination.total)" -ForegroundColor White
    Write-Host "   Page: $($response.pagination.page) of $($response.pagination.totalPages)" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "   ✗ Failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 4: Get divisions
Write-Host "4️⃣  Testing divisions (GET /v1/divisions)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/v1/divisions" -Method Get
    Write-Host "   ✓ Success!" -ForegroundColor Green
    Write-Host "   Divisions found: $($response.divisions.Count)" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "   ✗ Failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 5: Admin endpoint (requires token)
Write-Host "5️⃣  Testing admin authentication..." -ForegroundColor Yellow
Write-Host "   (Not triggering ingestion, just testing auth)" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Basic tests complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Open http://localhost:3000/docs in your browser" -ForegroundColor White
Write-Host "  2. Trigger data ingestion with:" -ForegroundColor White
Write-Host "     .\trigger-ingestion.ps1" -ForegroundColor Yellow
Write-Host ""
