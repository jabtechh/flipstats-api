@echo off
cd /d D:\Coding\flipstats-api
set DATABASE_URL=postgresql://flipstats:flipstats_password@localhost:5432/flipstats_db
set ADMIN_TOKEN=your-secret-admin-token-change-this-in-production
set YOUTUBE_API_KEY=AIzaSyAP24ch8vT3JaDinFdw3IeJzL4Dz9EtDI4
set PORT=3001
npm run dev
