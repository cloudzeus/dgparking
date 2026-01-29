# Prisma DB Push Troubleshooting Guide

If `npx prisma db push` is taking too long or not completing, try these solutions:

## Quick Fix: Apply Schema Changes Manually

If `prisma db push` is too slow, you can apply the INST schema changes (NUM01 and REMARKS) manually:

### Option 1: Use the Automated Script

```bash
./scripts/apply-inst-schema-changes.sh
```

This script will:
- Parse your DATABASE_URL from .env
- Connect to the database
- Add NUM01 and REMARKS columns to the INST table
- Verify the changes

### Option 2: Use SQL Directly

```bash
mysql -h 5.189.130.31 -P 3333 -u root -p kolleris_parking_app < scripts/add-inst-fields-manual.sql
```

Or run the SQL manually:

```sql
-- Add NUM01 column (if not exists)
ALTER TABLE inst ADD COLUMN num01 FLOAT NULL AFTER upddate;

-- Add REMARKS column (if not exists)
ALTER TABLE inst ADD COLUMN remarks TEXT NULL AFTER num01;
```

After applying manually, run:
```bash
npx prisma generate
```

## Improve Prisma DB Push Performance

### 1. Add Connection Timeout to DATABASE_URL

Update your `.env` file to include connection timeout parameters:

```bash
# Current (may timeout on slow connections)
DATABASE_URL=mysql://root:Prof%4015%401f1femsk@5.189.130.31:3333/kolleris_parking_app

# With timeout settings (recommended)
DATABASE_URL=mysql://root:Prof%4015%401f1femsk@5.189.130.31:3333/kolleris_parking_app?connect_timeout=60&pool_timeout=60
```

### 2. Use Prisma DB Push Flags

Try these flags to speed up or skip unnecessary steps:

```bash
# Skip Prisma Client generation (faster)
npx prisma db push --skip-generate

# Force push (may be faster but less safe)
npx prisma db push --force-reset

# Accept data loss warnings (if you're okay with it)
npx prisma db push --accept-data-loss
```

### 3. Test Connection First

Before running `prisma db push`, test the connection:

```bash
npx tsx scripts/test-db-connection-quick.ts
```

If this fails or times out, the issue is network connectivity, not Prisma.

## Common Issues

### Issue: "Can't reach database server"

**Causes:**
- Database server is down
- Network/firewall blocking port 3333
- Wrong IP address or port

**Solutions:**
1. Verify database server is running
2. Test connection: `telnet 5.189.130.31 3333` (or `nc -zv 5.189.130.31 3333`)
3. Check firewall rules
4. Verify DATABASE_URL in .env

### Issue: "Connection timeout"

**Causes:**
- Slow network connection
- Database server is overloaded
- Connection pool exhausted

**Solutions:**
1. Add timeout parameters to DATABASE_URL (see above)
2. Try during off-peak hours
3. Check database server load
4. Use manual SQL script instead

### Issue: "Operation timed out"

**Causes:**
- Large schema changes
- Many existing records to migrate
- Database locks

**Solutions:**
1. Apply changes manually using SQL script
2. Run during maintenance window
3. Check for blocking queries on the database

## Manual Schema Update Steps

If `prisma db push` continues to fail, follow these steps:

1. **Apply SQL changes manually:**
   ```bash
   ./scripts/apply-inst-schema-changes.sh
   ```

2. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

3. **Verify changes:**
   ```bash
   npx prisma studio
   ```
   Check that INST table has NUM01 and REMARKS columns

4. **Restart your dev server:**
   ```bash
   npm run dev
   ```

## Verify Schema Changes

After applying changes, verify they exist:

```sql
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'kolleris_parking_app'
  AND TABLE_NAME = 'inst'
  AND COLUMN_NAME IN ('num01', 'remarks');
```

You should see:
- `num01` - FLOAT, NULL
- `remarks` - TEXT, NULL

## Next Steps

Once the schema is updated:
1. ✅ NUM01 and REMARKS fields are available in Prisma
2. ✅ TypeScript types are updated
3. ✅ Contracts page can use these fields
4. ✅ Edit modals include these fields

The application will work correctly once the database schema matches the Prisma schema.
