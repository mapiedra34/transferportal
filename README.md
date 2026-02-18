# Transfer Portal (Bun)

This project now runs as a Bun server (no Azure Functions runtime required).

## Prerequisites

- [Bun](https://bun.sh/) installed

## Environment Variables

- `PORT` (optional, default: `3000`)

## Data Storage

Requests are currently stored in memory on the server process. This means data is cleared whenever the app restarts. A persistent server DB can be wired in later without changing the API routes.

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
