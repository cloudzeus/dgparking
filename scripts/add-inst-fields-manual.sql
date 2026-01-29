-- Manual SQL script to add NUM01 and REMARKS fields to INST table
-- Use this if `prisma db push` is too slow or fails
-- Run with: mysql -h 5.189.130.31 -P 3333 -u root -p kolleris_parking_app < scripts/add-inst-fields-manual.sql

-- Check if columns already exist before adding
SET @dbname = DATABASE();
SET @tablename = "inst";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = "num01")
  ) > 0,
  "SELECT 'Column num01 already exists' AS result;",
  "ALTER TABLE inst ADD COLUMN num01 FLOAT NULL AFTER upddate;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = "remarks")
  ) > 0,
  "SELECT 'Column remarks already exists' AS result;",
  "ALTER TABLE inst ADD COLUMN remarks TEXT NULL AFTER num01;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Verify columns were added
SELECT 
  COLUMN_NAME, 
  DATA_TYPE, 
  IS_NULLABLE,
  COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname
  AND TABLE_NAME = @tablename
  AND COLUMN_NAME IN ('num01', 'remarks');
