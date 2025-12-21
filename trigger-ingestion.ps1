# FlipStats API - Trigger Emcees Ingestion
# This script triggers the admin endpoint to scrape and ingest emcees data

$API_URL = "http://localhost:3000"
$ADMIN_TOKEN = "your-secret-admin-token-change-this-in-production"

Write-Host "🔄 Triggering Emcees Data Ingestion..." -ForegroundColor Cyan
Write-Host ""
Write-Host "This will:" -ForegroundColor Yellow
Write-Host "  1. Scrape https://www.fliptop.com.ph/emcees" -ForegroundColor White
Write-Host "  2. Visit each emcee's profile page" -ForegroundColor White
Write-Host "  3. Extract and save data to database" -ForegroundColor White
Write-Host ""
Write-Host "⏱️  This may take several minutes..." -ForegroundColor Yellow
Write-Host ""

try {
    $headers = @{
        "X-Admin-Token" = $ADMIN_TOKEN
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri "$API_URL/admin/refresh-emcees" -Method Post -Headers $headers
    
    Write-Host "✅ Ingestion completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Results:" -ForegroundColor Cyan
    Write-Host "  • Found: $($response.result.found) emcees" -ForegroundColor White
    Write-Host "  • Updated: $($response.result.updated) records" -ForegroundColor White
    Write-Host "  • Failed: $($response.result.failed) errors" -ForegroundColor White
    Write-Host "  • Run ID: $($response.result.runId)" -ForegroundColor White
    Write-Host ""
    Write-Host "Message: $($response.message)" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Now you can query the data:" -ForegroundColor Cyan
    Write-Host "  curl http://localhost:3000/v1/emcees" -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host "❌ Ingestion failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "💡 Tip: Make sure your ADMIN_TOKEN matches the one in .env" -ForegroundColor Yellow
    }
}
