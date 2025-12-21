# FlipStats API - Usage Examples

## 🚀 Quick Start

Your API is running at: **http://localhost:3000**

Interactive docs: **http://localhost:3000/docs**

---

## 📖 Common Use Cases

### 1. Get All Emcees

**PowerShell:**
```powershell
$emcees = Invoke-RestMethod http://localhost:3000/v1/emcees
$emcees.data | ForEach-Object { Write-Host "$($_.name) - $($_.slug)" }
```

**JavaScript/Node.js:**
```javascript
const response = await fetch('http://localhost:3000/v1/emcees');
const data = await response.json();
console.log(data.data); // Array of emcees
```

**Python:**
```python
import requests
response = requests.get('http://localhost:3000/v1/emcees')
emcees = response.json()
for emcee in emcees['data']:
    print(f"{emcee['name']} - {emcee['slug']}")
```

**curl:**
```bash
curl http://localhost:3000/v1/emcees
```

---

### 2. Get Single Emcee by Slug

**PowerShell:**
```powershell
$emcee = Invoke-RestMethod http://localhost:3000/v1/emcees/abra
Write-Host "Name: $($emcee.name)"
Write-Host "Bio: $($emcee.bio)"
```

**JavaScript:**
```javascript
const response = await fetch('http://localhost:3000/v1/emcees/abra');
const emcee = await response.json();
console.log(emcee.name, emcee.bio);
```

**curl:**
```bash
curl http://localhost:3000/v1/emcees/abra
```

---

### 3. Search Emcees by Name

**PowerShell:**
```powershell
$results = Invoke-RestMethod "http://localhost:3000/v1/emcees?search=ak"
Write-Host "Found: $($results.pagination.total) emcees"
$results.data | ForEach-Object { Write-Host "- $($_.name)" }
```

**JavaScript:**
```javascript
const response = await fetch('http://localhost:3000/v1/emcees?search=ak');
const results = await response.json();
console.log(`Found ${results.pagination.total} emcees`);
```

---

### 4. Filter by Division

**PowerShell:**
```powershell
# First, get available divisions
$divisions = Invoke-RestMethod http://localhost:3000/v1/divisions
$divisions.divisions

# Then filter by one
$metro = Invoke-RestMethod "http://localhost:3000/v1/emcees?division=Metro Manila"
```

**curl:**
```bash
curl "http://localhost:3000/v1/emcees?division=Metro%20Manila"
```

---

### 5. Pagination

**PowerShell:**
```powershell
# Get page 2 with 10 results per page
$page2 = Invoke-RestMethod "http://localhost:3000/v1/emcees?page=2&limit=10"

# Loop through all pages
$page = 1
do {
    $data = Invoke-RestMethod "http://localhost:3000/v1/emcees?page=$page&limit=20"
    $data.data | ForEach-Object { Write-Host $_.name }
    $page++
} while ($page -le $data.pagination.totalPages)
```

**JavaScript:**
```javascript
// Get all emcees by pagination
async function getAllEmcees() {
    let allEmcees = [];
    let page = 1;
    let totalPages = 1;
    
    do {
        const response = await fetch(`http://localhost:3000/v1/emcees?page=${page}&limit=20`);
        const data = await response.json();
        allEmcees.push(...data.data);
        totalPages = data.pagination.totalPages;
        page++;
    } while (page <= totalPages);
    
    return allEmcees;
}
```

---

### 6. Combined Filters

**PowerShell:**
```powershell
# Search + pagination + sorting
$results = Invoke-RestMethod "http://localhost:3000/v1/emcees?search=a&page=1&limit=5&sort=name"
```

**Query Parameters:**
- `search` - Search by name (case-insensitive)
- `division` - Filter by division
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 100)
- `sort` - Sort by: `name`, `year_joined`, or `created_at`

---

### 7. Health Check

**PowerShell:**
```powershell
$health = Invoke-RestMethod http://localhost:3000/health
if ($health.status -eq "healthy") {
    Write-Host "API is healthy!"
    Write-Host "Database: $($health.database)"
    Write-Host "Total emcees: $($health.emcees_count)"
}
```

---

## 🔐 Admin Operations

### Trigger Data Refresh (Requires Admin Token)

**PowerShell:**
```powershell
$headers = @{
    "X-Admin-Token" = "your-secret-admin-token-change-this-in-production"
    "Content-Type" = "application/json"
}

$result = Invoke-RestMethod `
    -Uri "http://localhost:3000/admin/refresh-emcees" `
    -Method Post `
    -Headers $headers `
    -Body "{}"

Write-Host "Found: $($result.result.found) emcees"
Write-Host "Updated: $($result.result.updated) records"
```

**curl:**
```bash
curl -X POST http://localhost:3000/admin/refresh-emcees \
  -H "X-Admin-Token: your-secret-admin-token-change-this-in-production" \
  -H "Content-Type: application/json" \
  -d "{}"
```

---

## 💻 Building a Simple Frontend

### HTML + JavaScript Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>FlipTop Emcees</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .emcee-card { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .search-box { width: 100%; padding: 10px; margin-bottom: 20px; font-size: 16px; }
    </style>
</head>
<body>
    <h1>FlipTop Emcees Directory</h1>
    
    <input type="text" class="search-box" id="search" placeholder="Search emcees...">
    
    <div id="results"></div>
    
    <script>
        const API_URL = 'http://localhost:3000';
        
        async function searchEmcees(query) {
            const url = query 
                ? `${API_URL}/v1/emcees?search=${encodeURIComponent(query)}`
                : `${API_URL}/v1/emcees`;
            
            const response = await fetch(url);
            const data = await response.json();
            displayResults(data.data);
        }
        
        function displayResults(emcees) {
            const resultsDiv = document.getElementById('results');
            resultsDiv.innerHTML = emcees.map(emcee => `
                <div class="emcee-card">
                    <h3>${emcee.name}</h3>
                    <p><strong>Slug:</strong> ${emcee.slug}</p>
                    ${emcee.division ? `<p><strong>Division:</strong> ${emcee.division}</p>` : ''}
                    ${emcee.hometown ? `<p><strong>Hometown:</strong> ${emcee.hometown}</p>` : ''}
                    ${emcee.bio ? `<p>${emcee.bio}</p>` : ''}
                    <p><small><a href="${emcee.source_url}" target="_blank">Source</a></small></p>
                </div>
            `).join('');
        }
        
        // Search on input
        document.getElementById('search').addEventListener('input', (e) => {
            searchEmcees(e.target.value);
        });
        
        // Initial load
        searchEmcees('');
    </script>
</body>
</html>
```

Save this as `index.html` and open it in a browser!

---

## 📱 React Example

```jsx
import React, { useState, useEffect } from 'react';

function EmceesApp() {
    const [emcees, setEmcees] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchEmcees = async () => {
            setLoading(true);
            const url = search 
                ? `http://localhost:3000/v1/emcees?search=${search}`
                : 'http://localhost:3000/v1/emcees';
            
            const response = await fetch(url);
            const data = await response.json();
            setEmcees(data.data);
            setLoading(false);
        };

        const debounce = setTimeout(fetchEmcees, 300);
        return () => clearTimeout(debounce);
    }, [search]);

    return (
        <div>
            <h1>FlipTop Emcees</h1>
            <input 
                type="text" 
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            
            {loading ? <p>Loading...</p> : (
                <div>
                    {emcees.map(emcee => (
                        <div key={emcee.id}>
                            <h3>{emcee.name}</h3>
                            <p>{emcee.bio}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default EmceesApp;
```

---

## 🎯 API Response Format

### List Emcees Response:
```json
{
  "data": [
    {
      "id": 1,
      "slug": "abra",
      "name": "Abra",
      "division": "Metro Manila",
      "hometown": "Quezon City",
      "reppin": "FlipTop",
      "year_joined": 2010,
      "bio": "...",
      "source_url": "https://www.fliptop.com.ph/emcees/abra",
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

### Single Emcee Response:
```json
{
  "id": 1,
  "slug": "abra",
  "name": "Abra",
  "division": "Metro Manila",
  "hometown": "Quezon City",
  "reppin": "FlipTop",
  "year_joined": 2010,
  "bio": "...",
  "source_url": "https://www.fliptop.com.ph/emcees/abra",
  "created_at": "2024-12-21T10:00:00Z",
  "updated_at": "2024-12-21T10:00:00Z"
}
```

---

## 🔗 Integration Tips

1. **CORS is enabled** - You can call this API from any frontend
2. **No auth required** for public endpoints
3. **Admin endpoints** require `X-Admin-Token` header
4. **Rate limiting** - Not implemented yet (add in production)
5. **Cache responses** - Data doesn't change often (only on ingestion)

---

## 📚 More Resources

- **Interactive Docs**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health
- **Source Code**: Check the `src/` directory for implementation details

---

Happy coding! 🚀
