# Server-Side Cron Jobs Setup

This application uses server-side cron jobs to automatically sync SoftOne ERP integrations. The cron jobs run entirely on the server and do not require users to be online or have their browsers open.

## Architecture

1. **Cron Manager** (`src/lib/cron-manager.ts`): Manages all scheduled cron jobs
2. **Sync API** (`src/app/api/cron/sync-integration/route.ts`): Executes the actual sync for an integration
3. **Database**: Integrations are stored with their cron schedules in `configJson`

## How It Works

1. When an integration is created/updated, a cron job is automatically scheduled
2. The cron job runs according to the schedule defined in the integration (e.g., hourly, daily)
3. On each run, the sync API:
   - Authenticates with SoftOne ERP
   - Fetches data from the ERP table
   - Compares with local database using unique identifiers
   - Updates existing records or creates new ones (one-way sync)
   - For two-way sync: Also sends updates from app to ERP

## Setup Instructions

### 1. Environment Variables

Add to your `.env` file:

```bash
# Cron secret for authenticating cron API calls
CRON_SECRET=your-secure-random-secret-here

# App URL (used by cron jobs to call API routes)
NEXT_PUBLIC_APP_URL=https://your-domain.com
# or
AUTH_URL=https://your-domain.com
```

### 2. Initialize Cron Jobs on Server Start

#### Option A: Using Next.js API Route (Recommended for Serverless)

Call the initialization endpoint when your server starts:

```bash
# On server startup
curl -X GET https://your-domain.com/api/cron/startup
```

#### Option B: Using node-cron Directly (For Persistent Servers)

If you're running a persistent server (Docker, VPS, etc.), you can initialize cron jobs directly:

```typescript
// In your server startup file (e.g., server.ts or app startup)
import { initializeCronJobs } from "@/lib/cron-manager";

// Initialize on server start
initializeCronJobs();
```

#### Option C: External Cron Service (Recommended for Production)

For production deployments (especially serverless), use an external cron service:

**Vercel Cron Jobs:**
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/init",
    "schedule": "*/5 * * * *"
  }]
}
```

**GitHub Actions:**
Create `.github/workflows/cron.yml`:
```yaml
name: Sync Cron Jobs
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Initialize Cron Jobs
        run: |
          curl -X GET ${{ secrets.APP_URL }}/api/cron/init \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}"
```

**Other Services:**
- EasyCron
- Cron-job.org
- AWS EventBridge
- Google Cloud Scheduler

### 3. Database Migration

After adding the new fields to the schema, run:

```bash
npx prisma db push
```

This adds:
- `isActive` field to enable/disable integrations
- `lastSyncAt` field to track last successful sync

## API Endpoints

### Initialize Cron Jobs
```
GET /api/cron/init
Headers: X-Cron-Secret: your-secret (optional)
```

### Execute Sync for Integration
```
POST /api/cron/sync-integration
Headers: 
  X-Cron-Secret: your-secret (required)
Body: { "integrationId": "..." }
```

### Startup Initialization
```
GET /api/cron/startup
```

## Monitoring

- Check integration `lastSyncAt` field to see when last sync occurred
- Check server logs for `[CRON]` and `[SYNC]` messages
- Monitor API route responses for sync statistics

## Troubleshooting

### Cron Jobs Not Running

1. **Check if cron jobs are initialized:**
   ```bash
   curl https://your-domain.com/api/cron/init
   ```

2. **Check server logs** for `[CRON]` messages

3. **Verify integration is active:**
   ```sql
   SELECT id, name, isActive, configJson FROM softone_integrations;
   ```

4. **Check cron expression:**
   - Verify `configJson.schedule.cronExpression` is valid
   - Test with: https://crontab.guru/

### Sync Failures

1. **Check authentication:**
   - Verify SoftOne connection credentials are correct
   - Check if connection is still valid

2. **Check field mappings:**
   - Verify unique identifier fields are correctly mapped
   - Ensure all required fields are mapped

3. **Check model exists:**
   - Verify the target model exists in Prisma schema
   - Check model name matches exactly (case-sensitive)

## Security

- Always use a strong `CRON_SECRET` in production
- Never expose the cron secret in client-side code
- Use HTTPS for all API calls
- Consider IP whitelisting for cron endpoints in production







