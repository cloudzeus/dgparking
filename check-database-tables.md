# Database Safety Check

## Step 1: Introspect Your Database (SAFE - Read Only)

Before pushing schema changes, let's see what tables already exist:

```bash
npx prisma db pull
```

This will:
- ✅ **Read-only** - doesn't change anything
- ✅ Shows you what tables/columns exist in your database
- ✅ Creates a backup schema file showing current state

## Step 2: Review the Introspected Schema

After running `db pull`, check the generated schema to see:
- Which tables exist (`inst`, `instlines`, `items`)
- What columns they have
- What data types are used

## Step 3: Align Our Schema with Database

If tables already exist, our schema definitions should match them. The models I added should align with what's in your database.

## Step 4: Push Schema (Safe - Won't Delete Data)

```bash
npx prisma db push
```

This will:
- ✅ Create new tables if they don't exist
- ✅ Add missing columns to existing tables
- ✅ **NEVER delete existing tables or data**
- ⚠️ May show warnings if there are type mismatches (which we can fix)

## What If Tables Already Exist?

If `inst`, `instlines`, or `items` tables already exist:
- Prisma will detect them
- It will only add missing columns
- Your existing data will remain untouched
- The sync code will continue working as before

## Backup Recommendation

If you want extra safety, backup your database first:
```bash
# MySQL backup (adjust connection string)
mysqldump -h 5.189.130.31 -P 3333 -u [user] -p kolleris_parking_app > backup_$(date +%Y%m%d_%H%M%S).sql
```

