# Transfer Portal

Transfer Portal API server with Node.js/Express and Azure PostgreSQL.

## Prerequisites

- Node.js 18+
- PostgreSQL database (Azure Database for PostgreSQL Flexible Server)

## Environment Variables

Create a `.env` file:

```
PGHOST=<your-postgres-host>
PGPORT=5432
PGUSER=<your-username>
PGPASSWORD=<your-password>
PGDATABASE=transfer_portal
PORT=3000
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Server watches for file changes and auto-reloads.

## Production

```bash
npm start
```

## Database

The app automatically creates the `requests` table on startup. Connection uses SSL for Azure PostgreSQL.

## API Endpoints

- `GET /api/requests?status=<received|in-review|approved|denied>` - List requests
- `POST /api/requests` - Create new request
- `PATCH /api/requests/:id/status` - Update request status
- `DELETE /api/requests/denied` - Delete all denied requests
- `DELETE /api/requests/approved/old` - Delete approved requests older than 7 days

## Frontend

Static UI is served from `public/` folder. The app proxies API calls to backend endpoints.
