#!/bin/bash
# Script to apply INST schema changes (NUM01 and REMARKS) manually
# Use this if prisma db push is too slow

echo "🔧 Applying INST schema changes manually..."
echo ""

# Extract database credentials from .env
if [ ! -f .env ]; then
  echo "❌ .env file not found!"
  exit 1
fi

# Parse DATABASE_URL
DB_URL=$(grep "DATABASE_URL" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")

# Extract components from mysql://user:pass@host:port/db
if [[ $DB_URL =~ mysql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
  DB_USER="${BASH_REMATCH[1]}"
  DB_PASS="${BASH_REMATCH[2]}"
  DB_HOST="${BASH_REMATCH[3]}"
  DB_PORT="${BASH_REMATCH[4]}"
  DB_NAME="${BASH_REMATCH[5]}"
  
  echo "📋 Database Info:"
  echo "   Host: $DB_HOST:$DB_PORT"
  echo "   Database: $DB_NAME"
  echo "   User: $DB_USER"
  echo ""
  
  # Check if MySQL client is available
  if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL client not found. Please install it or run the SQL manually:"
    echo ""
    echo "   mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p $DB_NAME < scripts/add-inst-fields-manual.sql"
    echo ""
    exit 1
  fi
  
  echo "🔍 Testing connection..."
  if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1" "$DB_NAME" &> /dev/null; then
    echo "✅ Connection successful!"
    echo ""
    echo "📝 Applying schema changes..."
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < scripts/add-inst-fields-manual.sql
    
    if [ $? -eq 0 ]; then
      echo ""
      echo "✅ Schema changes applied successfully!"
      echo ""
      echo "📋 Next steps:"
      echo "   1. Run: npx prisma generate"
      echo "   2. Restart your Next.js dev server"
    else
      echo ""
      echo "❌ Failed to apply schema changes"
      exit 1
    fi
  else
    echo "❌ Connection failed!"
    echo ""
    echo "Troubleshooting:"
    echo "1. Verify database server is running"
    echo "2. Check network connectivity"
    echo "3. Verify credentials in .env"
    exit 1
  fi
else
  echo "❌ Could not parse DATABASE_URL"
  echo "   Expected format: mysql://user:password@host:port/database"
  exit 1
fi
