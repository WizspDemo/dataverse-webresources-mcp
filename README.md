# Dataverse Web Resources MCP Server (Online)

MCP server για λίστα, upload, update, delete και publish web resources στο Dataverse. **HTTP/Streamable transport** – τρέχει ως web service και μπορεί να αναπτυχθεί online (π.χ. Coolify).

## Απαιτήσεις

- Node.js 18+
- Ρύθμιση credentials μέσω **environment variables**

## Ρύθμιση credentials (env)

- **DATAVERSE_URL** (υποχρεωτικό) – URL του org (π.χ. `https://yourorg.crm4.dynamics.com`)
- **DATAVERSE_ACCESS_TOKEN** – access token, **ή**
- **AZURE_CLIENT_ID**, **AZURE_TENANT_ID**, **AZURE_CLIENT_SECRET** – client credentials flow
- **DATAVERSE_API_VERSION** (προαιρετικό, default `v9.2`)

## Εγκατάσταση & τρέξιμο τοπικά

```bash
cd mcponline
npm install
npm start
```

Το server ακούει στο `http://0.0.0.0:3000` (ή `PORT` από env). MCP endpoint: `http://localhost:3000/mcp`

## Ανάπτυξη στο Coolify

### 1. Ανέβασε το project (GitHub / Git)

Βεβαιώσου ότι το repo περιέχει το `mcponline/` με `Dockerfile`.

### 2. Δημιουργία νέου resource στο Coolify

1. **Create new resource** → **Application**
2. Επίλεξε το Git repository
3. **Build Pack**: **Dockerfile**
4. **Dockerfile location**: `mcponline/Dockerfile` (ή root αν το Dockerfile είναι στο root)
5. **Base directory** (αν χρειάζεται): `mcponline`

### 3. Network / Port

- **Port**: `3000` (το app χρησιμοποιεί `PORT` env – το Coolify το περνάει αυτόματα)
- Όρισε **Domain** (π.χ. `mcp-dataverse.yourdomain.com`) και SSL

### 4. Environment variables

Πρόσθεσε στο Coolify:

```
DATAVERSE_URL=https://yourorg.crm4.dynamics.com
AZURE_CLIENT_ID=...
AZURE_TENANT_ID=...
AZURE_CLIENT_SECRET=...
ALLOWED_HOSTS=mcp-dataverse.yourdomain.com,localhost,127.0.0.1
```

Ή με access token:

```
DATAVERSE_URL=https://yourorg.crm4.dynamics.com
DATAVERSE_ACCESS_TOKEN=...
ALLOWED_HOSTS=mcp-dataverse.yourdomain.com,localhost,127.0.0.1
```

**ALLOWED_HOSTS** (προαιρετικό): Λίστα hosts με κόμμα – εξαλείφει το DNS rebinding warning. Βάλε το domain του Coolify και `localhost,127.0.0.1` για healthchecks.

### 5. Deploy

Κάνε Deploy. Το MCP endpoint θα είναι: `https://mcp-dataverse.yourdomain.com/mcp`

## Ρύθμιση στο Cursor (remote MCP)

Για να συνδέσεις το Cursor με τον online MCP:

1. Άνοιξε **Cursor Settings** → **MCP**
2. Πρόσθεσε remote MCP με **Streamable HTTP** transport και URL:

```json
{
  "mcpServers": {
    "dataverse-webresources": {
      "transport": "streamableHttp",
      "url": "https://mcp-dataverse.yourdomain.com/mcp"
    }
  }
}
```

Αν το Cursor ζητά **SSE** αντί για streamableHttp, χρησιμοποίησε:

```json
{
  "mcpServers": {
    "dataverse-webresources": {
      "transport": "sse",
      "url": "https://mcp-dataverse.yourdomain.com/mcp"
    }
  }
}
```

Το MCP server υποστηρίζει Streamable HTTP (POST-based). Το Cursor θα συνδεθεί αυτόματα.

## Health check

Το endpoint `/health` επιστρέφει `200 OK` και χρησιμοποιείται από Coolify/load balancers:

```
GET /health → { "status": "ok", "service": "dataverse-webresources-mcp" }
```

## Tools

| Tool | Περιγραφή |
|------|------------|
| **list_web_resources** | Λίστα web resources· προαιρετικό φίλτρο `solution` (unique name). |
| **upload_web_resource** | Upload νέου web resource· `file_path`, ή `content` (UTF-8 text, συνιστάται για ελληνικά/Unicode), ή `content_base64` + `name`. |
| **update_web_resource** | Ενημέρωση υπάρχοντος (by name ή id)· νέο περιεχόμενο με `file_path`, `content` (UTF-8), ή `content_base64`. |
| **delete_web_resource** | Διαγραφή by name ή id. |
| **publish_all** | Publish all customizations. |

Για **remote/client** χρήση προτιμήστε `content` (UTF-8 text) για ελληνικά/Unicode ή `content_base64`. Το `file_path` αναφέρεται στο filesystem του server.

## Δομή

```
mcponline/
├── package.json
├── index.js          # HTTP MCP server (Express + Streamable HTTP)
├── Dockerfile
├── .dockerignore
├── README.md
└── src/
    ├── config.js
    ├── auth.js
    ├── dataverse-client.js
    └── webresource-types.js
```
