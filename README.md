# Transfer Portal (Bun)

This project now runs as a Bun server (no Azure Functions runtime required).

## Prerequisites

- [Bun](https://bun.sh/) installed
- Cosmos DB connection string in environment variables

## Environment Variables

- `COSMOS_CONNECTION_STRING` (required)
- `COSMOS_DB` (optional, default: `transferPortal`)
- `COSMOS_CONTAINER` (optional, default: `transferRequests`)
- `PORT` (optional, default: `3000`)

## Install

```bash
bun install
```

## Run (development)

```bash
bun run dev
```

## Run (production style)

```bash
bun run start
```

## Endpoints

- `GET /api/requests?status=<received|in-review|approved|denied>`
- `POST /api/requests`
- `PATCH /api/requests/:id/status`

Static UI is served from `public/`.
