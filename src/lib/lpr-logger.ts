/**
 * LPR Webhook Logger
 * 
 * Logs all incoming JSON messages from LPR cameras with timestamps.
 * Used for evaluation and debugging purposes.
 * 
 * SERVER-SIDE ONLY
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const LOGS_DIR = process.env.LPR_LOGS_DIR || join(process.cwd(), "logs", "lpr");
const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_FILES = 10; // Keep last 10 log files

/**
 * Ensure logs directory exists
 */
async function ensureLogsDir(): Promise<void> {
  if (!existsSync(LOGS_DIR)) {
    await mkdir(LOGS_DIR, { recursive: true });
  }
}

/**
 * Get current log file path based on date
 */
function getLogFilePath(): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
  return join(LOGS_DIR, `lpr-webhook-${dateStr}.jsonl`);
}

/**
 * Rotate log files if they get too large
 */
async function rotateLogFileIfNeeded(filePath: string): Promise<string> {
  try {
    const fs = await import("fs/promises");
    const stats = await fs.stat(filePath);
    
    if (stats.size > MAX_LOG_FILE_SIZE) {
      // File is too large, create a new one with timestamp
      const timestamp = Date.now();
      const newPath = filePath.replace(".jsonl", `-${timestamp}.jsonl`);
      return newPath;
    }
  } catch (error) {
    // File doesn't exist yet, that's fine
  }
  
  return filePath;
}

/**
 * Clean up old log files (keep only last MAX_FILES)
 */
async function cleanupOldLogs(): Promise<void> {
  try {
    const fs = await import("fs/promises");
    const files = await fs.readdir(LOGS_DIR);
    
    const logFiles = files
      .filter((f) => f.startsWith("lpr-webhook-") && f.endsWith(".jsonl"))
      .map((f) => ({
        name: f,
        path: join(LOGS_DIR, f),
      }));

    // Sort by modification time (newest first)
    const filesWithStats = await Promise.all(
      logFiles.map(async (f) => {
        const stats = await fs.stat(f.path);
        return {
          ...f,
          mtime: stats.mtime,
        };
      })
    );

    filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Delete files beyond MAX_FILES
    if (filesWithStats.length > MAX_FILES) {
      const filesToDelete = filesWithStats.slice(MAX_FILES);
      for (const file of filesToDelete) {
        try {
          await fs.unlink(file.path);
          console.log(`Deleted old log file: ${file.name}`);
        } catch (error) {
          console.error(`Failed to delete log file ${file.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Failed to cleanup old logs:", error);
  }
}

/**
 * Log an incoming webhook message
 * 
 * @param data - The JSON data received from the camera
 * @param metadata - Additional metadata (IP address, headers, etc.)
 */
export async function logWebhookMessage(
  data: any,
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    headers?: Record<string, string>;
    processingTime?: number;
    success?: boolean;
    error?: string;
  }
): Promise<void> {
  try {
    await ensureLogsDir();
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      receivedAt: Date.now(),
      event: data.event || (data.plate ? "recognition" : "unknown"),
      device: data.device,
      data: data,
      metadata: {
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        processingTime: metadata?.processingTime,
        success: metadata?.success ?? true,
        error: metadata?.error,
        ...(metadata?.headers && { headers: metadata?.headers }),
      },
    };

    const filePath = await rotateLogFileIfNeeded(getLogFilePath());
    
    // Append to log file (JSONL format - one JSON object per line)
    const logLine = JSON.stringify(logEntry) + "\n";
    await writeFile(filePath, logLine, { flag: "a" });

    // Cleanup old logs periodically (every 100th log entry)
    if (Math.random() < 0.01) {
      await cleanupOldLogs();
    }
  } catch (error) {
    console.error("Failed to log webhook message:", error);
    // Don't throw - logging failures shouldn't break the webhook
  }
}

/**
 * Get log file paths for a date range
 * 
 * @param startDate - Start date (optional, defaults to today)
 * @param endDate - End date (optional, defaults to today)
 */
export async function getLogFiles(
  startDate?: Date,
  endDate?: Date
): Promise<string[]> {
  try {
    await ensureLogsDir();
    const fs = await import("fs/promises");
    const files = await fs.readdir(LOGS_DIR);
    
    const logFiles = files
      .filter((f) => f.startsWith("lpr-webhook-") && f.endsWith(".jsonl"))
      .map((f) => join(LOGS_DIR, f));

    // Filter by date range if provided
    if (startDate || endDate) {
      const filtered: string[] = [];
      for (const file of logFiles) {
        const fileName = file.split("/").pop() || "";
        const dateMatch = fileName.match(/lpr-webhook-(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          const fileDate = new Date(dateMatch[1]);
          if (
            (!startDate || fileDate >= startDate) &&
            (!endDate || fileDate <= endDate)
          ) {
            filtered.push(file);
          }
        }
      }
      return filtered.sort().reverse(); // Newest first
    }

    return logFiles.sort().reverse();
  } catch (error) {
    console.error("Failed to get log files:", error);
    return [];
  }
}

/**
 * Read log entries from a file
 * 
 * @param filePath - Path to the log file
 * @param limit - Maximum number of entries to return (default: 100)
 */
export async function readLogEntries(
  filePath: string,
  limit: number = 100
): Promise<any[]> {
  try {
    const fs = await import("fs/promises");
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n").filter((line) => line.trim());
    
    // Parse JSONL format (one JSON object per line)
    const entries = lines
      .slice(-limit) // Get last N entries
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((entry) => entry !== null);

    return entries;
  } catch (error) {
    console.error(`Failed to read log file ${filePath}:`, error);
    return [];
  }
}
