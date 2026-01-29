#!/bin/bash
# Script to check Prisma db push status and provide troubleshooting tips

echo "🔍 Prisma DB Push Troubleshooting"
echo "===================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ .env file not found!"
  exit 1
fi

# Check DATABASE_URL
if grep -q "DATABASE_URL" .env; then
  echo "✅ DATABASE_URL found in .env"
  DB_URL=$(grep "DATABASE_URL" .env | cut -d '=' -f2-)
  # Mask password
  MASKED_URL=$(echo "$DB_URL" | sed 's/:[^:@]*@/:****@/')
  echo "   Connection: $MASKED_URL"
else
  echo "❌ DATABASE_URL not found in .env"
  exit 1
fi

echo ""
echo "📋 Troubleshooting Steps:"
echo ""
echo "1. Test database connection first:"
echo "   npx tsx scripts/test-db-connection-quick.ts"
echo ""
echo "2. If connection works, try prisma db push with flags:"
echo "   npx prisma db push --skip-generate --accept-data-loss"
echo ""
echo "3. Or try with force reset (WARNING: deletes all data):"
echo "   npx prisma db push --force-reset"
echo ""
echo "4. Check if database server is reachable:"
echo "   telnet 5.189.130.31 3333"
echo "   (or: nc -zv 5.189.130.31 3333)"
echo ""
echo "5. If connection is slow, try increasing timeout in schema.prisma:"
echo "   Add to datasource: url = env(\"DATABASE_URL\") + \"?connect_timeout=60\""
echo ""
