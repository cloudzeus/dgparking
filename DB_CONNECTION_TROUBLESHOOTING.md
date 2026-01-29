# Database Connection Troubleshooting

If you're getting `P1001: Can't reach database server` error even though the database is live, try these solutions:

## 1. Check DATABASE_URL Format

Your `.env` file should have a properly formatted MySQL connection string:

```bash
# Basic format
DATABASE_URL="mysql://username:password@5.189.130.31:3333/kolleris_parking_app"

# With SSL (if required)
DATABASE_URL="mysql://username:password@5.189.130.31:3333/kolleris_parking_app?sslmode=require"

# With connection pool
DATABASE_URL="mysql://username:password@5.189.130.31:3333/kolleris_parking_app?connection_limit=10"

# With SSL and connection pool
DATABASE_URL="mysql://username:password@5.189.130.31:3333/kolleris_parking_app?sslmode=require&connection_limit=10"
```

## 2. Common Issues and Solutions

### Issue: Network/Firewall Blocking

**Symptoms:** `Can't reach database server`

**Solutions:**
- Check if port 3333 is open in your firewall
- Verify the IP address `5.189.130.31` is correct
- Test connection with MySQL client:
  ```bash
  mysql -h 5.189.130.31 -P 3333 -u username -p
  ```
- If MySQL client works but Prisma doesn't, it might be a SSL/TLS issue

### Issue: SSL/TLS Required

**Symptoms:** Connection works with MySQL client but not with Prisma

**Solution:** Add SSL parameters to DATABASE_URL:
```bash
DATABASE_URL="mysql://username:password@5.189.130.31:3333/kolleris_parking_app?sslmode=require"
```

Or if you need to accept self-signed certificates:
```bash
DATABASE_URL="mysql://username:password@5.189.130.31:3333/kolleris_parking_app?sslmode=require&sslcert=&sslkey=&sslrootcert="
```

### Issue: User Permissions

**Symptoms:** `Access denied for user`

**Solutions:**
- Verify username and password are correct
- Check if user has remote access permissions:
  ```sql
  -- On MySQL server
  GRANT ALL PRIVILEGES ON kolleris_parking_app.* TO 'username'@'%' IDENTIFIED BY 'password';
  FLUSH PRIVILEGES;
  ```
- Check if user is allowed to connect from your IP address

### Issue: Database Doesn't Exist

**Symptoms:** `Unknown database 'kolleris_parking_app'`

**Solution:** Verify database name is correct or create it:
```sql
CREATE DATABASE IF NOT EXISTS kolleris_parking_app;
```

## 3. Test Connection

Run the test script to diagnose the issue:

```bash
npx tsx scripts/test-db-connection.ts
```

Or install tsx if needed:
```bash
npm install -D tsx
npx tsx scripts/test-db-connection.ts
```

## 4. Alternative: Use Prisma Studio to Test

```bash
npx prisma studio
```

This will also test the connection and show any errors.

## 5. Check Prisma Connection String Format

Prisma requires the connection string in this exact format:

```
mysql://[username]:[password]@[host]:[port]/[database][?parameters]
```

**Important:**
- No spaces in the connection string
- Special characters in password must be URL-encoded
- Port must be included (3333 in your case)

## 6. URL Encoding for Special Characters

If your password contains special characters, encode them:

| Character | Encoded |
|-----------|---------|
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `%` | `%25` |
| `&` | `%26` |
| `+` | `%2B` |
| `=` | `%3D` |
| `?` | `%3F` |
| `/` | `%2F` |
| `:` | `%3A` |
| ` ` (space) | `%20` |

**Example:**
```bash
# Password: P@ssw0rd#123
DATABASE_URL="mysql://user:P%40ssw0rd%23123@5.189.130.31:3333/kolleris_parking_app"
```

## 7. Verify Environment Variables

Make sure your `.env` file is being loaded:

```bash
# Check if .env is in the project root
ls -la .env

# Verify DATABASE_URL is set
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL ? 'SET' : 'NOT SET')"
```

## 8. Try Direct MySQL Connection

Test if you can connect directly:

```bash
# Using mysql client
mysql -h 5.189.130.31 -P 3333 -u your_username -p kolleris_parking_app

# Or using connection string
mysql "mysql://username:password@5.189.130.31:3333/kolleris_parking_app"
```

If this works but Prisma doesn't, the issue is likely:
- SSL/TLS configuration
- Connection string format
- Prisma-specific parameters needed

## 9. Check Server-Side Configuration

On the MySQL server, verify:

```sql
-- Check if remote connections are allowed
SHOW VARIABLES LIKE 'bind_address';

-- Should be 0.0.0.0 or your server IP, not 127.0.0.1

-- Check max_connections
SHOW VARIABLES LIKE 'max_connections';

-- Check if user can connect from remote
SELECT user, host FROM mysql.user WHERE user = 'your_username';
```

## 10. Prisma-Specific Connection Parameters

Try adding these parameters to your DATABASE_URL:

```bash
# Connection timeout
DATABASE_URL="mysql://user:pass@host:port/db?connect_timeout=60"

# Connection limit
DATABASE_URL="mysql://user:pass@host:port/db?connection_limit=10"

# SSL mode
DATABASE_URL="mysql://user:pass@host:port/db?sslmode=require"

# Combined
DATABASE_URL="mysql://user:pass@host:port/db?sslmode=require&connection_limit=10&connect_timeout=60"
```

## Still Having Issues?

1. Check server logs on the MySQL server
2. Verify network connectivity: `ping 5.189.130.31`
3. Test port accessibility: `telnet 5.189.130.31 3333` or `nc -zv 5.189.130.31 3333`
4. Check if you're behind a VPN or proxy that might be blocking the connection
5. Verify the database server is actually listening on port 3333 (not 3306)
