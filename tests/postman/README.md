# Review Ingestion API - Postman Collection

This directory contains Postman collections and environments for testing the Review Ingestion API.

## Files

| File | Description |
|------|-------------|
| `review-ingestion.postman_collection.json` | API collection with all endpoints |
| `local.postman_environment.json` | Environment for local development |
| `production.postman_environment.json` | Environment template for production |

## Quick Start

### 1. Import into Postman

1. Open Postman
2. Click **Import** button
3. Select the collection file: `review-ingestion.postman_collection.json`
4. Import an environment file (e.g., `local.postman_environment.json`)

### 2. Configure Environment Variables

Set these variables in your Postman environment:

| Variable | Description | Example |
|----------|-------------|---------|
| `baseUrl` | API base URL | `http://localhost:3000` |
| `cronSecret` | CRON_SECRET from your `.env` | `your-secret-here` |
| `appId` | App ID for testing (optional) | `clx123...` |
| `sessionCookie` | Auth cookie for server actions | `next-auth.session-token=...` |

### 3. Run the Server

```bash
# Start the development server
pnpm dev
```

## Endpoints

### Cron Jobs (Public API)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/jobs/review-ingestion` | None | Health check, eligible apps |
| POST | `/api/jobs/review-ingestion` | Bearer/Query | Run scheduled ingestion |

### Authentication Methods

The POST endpoint supports two auth methods:

**Bearer Token:**
```
Authorization: Bearer your-cron-secret
```

**Query Parameter (Vercel Cron compatible):**
```
POST /api/jobs/review-ingestion?secret=your-cron-secret
```

### Server Actions (Internal)

These endpoints represent the server actions called by the UI. They require session authentication:

| Action | Description |
|--------|-------------|
| Fetch App Reviews | Manual trigger for a specific app |
| Get Quota Status | Check daily quota usage |
| Get Ingestion History | View past ingestion runs |
| Cancel Ingestion | Cancel an in-progress run |

## Example Requests

### Health Check
```bash
curl http://localhost:3000/api/jobs/review-ingestion
```

### Run Ingestion (with Bearer token)
```bash
curl -X POST http://localhost:3000/api/jobs/review-ingestion \
  -H "Authorization: Bearer your-cron-secret"
```

### Run Ingestion (with query param)
```bash
curl -X POST "http://localhost:3000/api/jobs/review-ingestion?secret=your-cron-secret"
```

## Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 401 | Unauthorized (missing/invalid secret in production) |
| 500 | Internal server error |

## Quota Limits by Plan

| Plan | Manual Runs/Day |
|------|-----------------|
| STARTER | 1 |
| PRO | 5 |
| BUSINESS | 20 |

## Tips

1. **Development Mode**: Auth is optional when `CRON_SECRET` is not set
2. **Testing Locally**: Use the "Local" environment
3. **Debugging**: Check the `details` array in POST responses for per-app results
4. **Eligibility**: Apps must be ACTIVE and not synced in the last 20 hours
