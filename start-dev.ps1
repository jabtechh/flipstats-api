# FlipStats API - Start Development Server
# This script sets all required environment variables and starts the server

Write-Host "🚀 Starting FlipStats API..." -ForegroundColor Green
Write-Host ""

# Set environment variables
$env:DATABASE_URL = "postgresql://flipstats_user:flipstats_pass@localhost:5432/flipstats_db"
$env:ADMIN_TOKEN = "your-secret-admin-token-change-this-in-production"
$env:PORT = "3000"
$env:NODE_ENV = "development"

Write-Host "✓ Environment variables set" -ForegroundColor Green
Write-Host ""
Write-Host "Server will be available at:" -ForegroundColor Cyan
Write-Host "  • API: http://localhost:3000" -ForegroundColor White
Write-Host "  • Docs: http://localhost:3000/docs" -ForegroundColor White
Write-Host "  • Health: http://localhost:3000/health" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start the server
npm run dev
