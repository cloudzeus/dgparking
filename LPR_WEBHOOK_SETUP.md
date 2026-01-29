# LPR Camera Webhook Setup Guide

This guide explains how to configure your Milesight LPR cameras to send data to the webhook endpoint.

## Webhook URL

Configure this URL in your camera's HTTP Post settings:

```
http://YOUR_DOMAIN/api/webhooks/lpr
```

Or for HTTPS:

```
https://YOUR_DOMAIN/api/webhooks/lpr
```

**Example:**
```
https://parking.yourcompany.com/api/webhooks/lpr
```

## Environment Variables Required

Add these to your `.env` file:

```bash
# BunnyCDN Configuration
BUNNY_STORAGE_ZONE=your-storage-zone-name
BUNNY_ACCESS_KEY=your-bunny-access-key
BUNNY_STORAGE_HOSTNAME=storage.bunnycdn.com
BUNNY_CDN_HOSTNAME=your-zone.b-cdn.net  # Optional: Your CDN hostname for faster image delivery

# LPR Logging (Optional)
LPR_LOGS_DIR=./logs/lpr  # Default: ./logs/lpr - Directory where webhook logs are stored
```

### Getting BunnyCDN Credentials

1. Log in to your BunnyCDN account
2. Go to **Storage** → **FTP & HTTP API**
3. Copy your **Storage Zone Name** → `BUNNY_STORAGE_ZONE`
4. Copy your **Storage Password** → `BUNNY_ACCESS_KEY`
5. (Optional) Go to **CDN** → Copy your **CDN Hostname** → `BUNNY_CDN_HOSTNAME`

## Camera Configuration Steps

### 1. Register Camera in Database

Before cameras can send data, you need to register them in the database. Each camera needs:

- **Name**: Unique name for the camera (e.g., "Parking Entrance", "Parking Exit")
- **IP Address**: Camera's IP address
- **Port**: HTTP port (usually 80)
- **Connection Type**: HTTP (for webhook)
- **Device Name**: Must match the "device" field in camera settings (default: "Network Camera")
- **User ID**: The user who manages this camera

### 2. Configure Camera HTTP Post Settings

In your Milesight LPR camera web interface:

1. Navigate to **Settings** → **Network** → **HTTP Post** (or **Integration** → **HTTP Post**)
2. Enable **HTTP Post**
3. Set the **Post URL** to: `http://YOUR_DOMAIN/api/webhooks/lpr`
4. Set **Post Method** to: **POST**
5. Configure which events to send:
   - ✅ **LPR Recognition** (always enabled)
   - ✅ **Vehicle Counting** (if needed)
   - ✅ **List Event** (if using whitelist/blacklist)
   - ✅ **Attributes Event** (if needed)
   - ✅ **Violation Event** (if needed)
   - ❌ **Parking Detection** (not processed - will be ignored)

6. Configure image sending:
   - Select **License Plate** or **All** to send plate images
   - Select **Full Snapshot** or **All** to send full images
   - Evidence images will be sent if evidence cameras are linked

7. Set **Device Name** to match the camera name in your database (or use default "Network Camera")

### 3. Camera Identification

The webhook identifies cameras by:
1. **Device Name** (from the "device" field in the JSON payload)
2. **Device ID** (if configured)
3. **IP Address** (from request headers)

Make sure the camera's **Device Name** in the webhook payload matches the camera **Name** in your database.

## Supported Event Types

### ✅ Recognition Events (COMM_RECOG_POST)
- License plate recognition data
- Vehicle information (color, brand, type)
- Plate information (color, type, confidence)
- Movement data (direction, speed)
- Location data (region, ROI, coordinates)
- Images: plate_image, full_image, evidence_image0, evidence_image1

### ✅ Vehicle Counting Events (COMM_COUNTING_POST)
- Vehicle counts by type
- Region-based statistics
- Snapshot image

### ✅ List Events (COMM_LIST_EVENT_POST)
- Whitelist/blacklist matching
- License plate matching status

### ✅ Attributes Events (COMM_ATTRIBUTES_POST)
- Vehicle attributes
- Plate attributes

### ✅ Violation Events (COMM_VIOLATION_POST)
- Traffic/parking violations
- Violation details

### ❌ Parking Detection Events (COMM_PARKING_POST)
- **Not processed** - These events are ignored

## Image Storage

All images are automatically:
1. Uploaded to BunnyCDN Storage
2. Stored in organized folders:
   - `lpr/plate-images/` - License plate images
   - `lpr/full-images/` - Full scene images
   - `lpr/evidence-images/` - Evidence camera images
   - `lpr/snapshots/` - Counting event snapshots
3. URLs are stored in the database for easy retrieval

## Webhook Logging

All incoming webhook messages are automatically logged to files for evaluation and debugging:

- **Location**: `./logs/lpr/` (or custom path via `LPR_LOGS_DIR` env variable)
- **Format**: JSONL (JSON Lines) - one JSON object per line
- **File naming**: `lpr-webhook-YYYY-MM-DD.jsonl` (one file per day)
- **Rotation**: Files are rotated when they exceed 10MB
- **Retention**: Keeps last 10 log files automatically

### Log Entry Structure

Each log entry contains:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "receivedAt": 1705315800000,
  "event": "recognition",
  "device": "Network Camera",
  "data": { /* Original JSON from camera */ },
  "metadata": {
    "ipAddress": "192.168.1.100",
    "userAgent": "...",
    "processingTime": 125,
    "success": true,
    "error": null
  }
}
```

### Viewing Logs

Logs are stored in JSONL format, making them easy to:
- View with any text editor
- Parse with command-line tools (jq, grep, etc.)
- Import into analysis tools
- Search and filter by timestamp, device, event type, etc.

**Example: View last 100 entries**
```bash
tail -n 100 logs/lpr/lpr-webhook-2024-01-15.jsonl | jq
```

**Example: Search for specific license plate**
```bash
grep "ABC1234" logs/lpr/lpr-webhook-*.jsonl | jq
```

**Example: Count events by type**
```bash
cat logs/lpr/lpr-webhook-*.jsonl | jq -r '.event' | sort | uniq -c
```

## Testing the Webhook

### Test with cURL

```bash
curl -X POST https://YOUR_DOMAIN/api/webhooks/lpr \
  -H "Content-Type: application/json" \
  -d '{
    "device": "Network Camera",
    "time": "2024-01-15 10:30:00",
    "plate": "ABC1234",
    "plate_color": "White",
    "vehicle_type": "Car",
    "vehicle_color": "Blue",
    "direction": "In",
    "plate_image": "base64_encoded_image_here"
  }'
```

### Expected Response

```json
{
  "success": true,
  "eventId": "clx1234567890",
  "eventType": "recognition",
  "message": "Event processed successfully"
}
```

## Testing Webhook Accessibility

### Test if Webhook is Accessible

Use GET request to test:

```bash
curl https://YOUR_DOMAIN/api/webhooks/lpr?test=ping
```

Or visit in browser:
```
https://YOUR_DOMAIN/api/webhooks/lpr?test=ping
```

Expected response:
```json
{
  "success": true,
  "message": "Webhook is accessible",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "endpoint": "/api/webhooks/lpr",
  "method": "POST"
}
```

## Troubleshooting

### No Messages Received from Cameras

**Symptoms:** Cameras are configured but no messages are being received

**Checklist:**
1. **Verify webhook is accessible:**
   ```bash
   curl https://YOUR_DOMAIN/api/webhooks/lpr?test=ping
   ```
   Should return success message

2. **Check camera HTTP Post settings:**
   - URL is correct: `http://YOUR_DOMAIN/api/webhooks/lpr` or `https://YOUR_DOMAIN/api/webhooks/lpr`
   - HTTP Post is **enabled**
   - Post Method is set to **POST** (not GET)
   - Events are registered (LPR Recognition, etc.)

3. **Check network connectivity:**
   - Camera can reach your server (test with ping or curl from camera network)
   - Firewall allows HTTP/HTTPS traffic
   - Port 80/443 is open

4. **Check logs:**
   ```bash
   # View latest log entries
   tail -n 50 logs/lpr/lpr-webhook-*.jsonl | jq
   
   # Check if any requests are being received
   ls -lh logs/lpr/
   ```

5. **Test webhook manually:**
   ```bash
   curl -X POST https://YOUR_DOMAIN/api/webhooks/lpr \
     -H "Content-Type: application/json" \
     -d '{
       "device": "Network Camera",
       "time": "2024-01-15 10:30:00",
       "plate": "TEST123",
       "plate_color": "White",
       "vehicle_type": "Car"
     }'
   ```

6. **Check camera logs:**
   - Some cameras have logs showing HTTP Post attempts
   - Check camera's web interface for error messages
   - Verify camera's network settings (DNS, gateway, etc.)

7. **Verify camera device name:**
   - Camera's "device" field in webhook must match camera name in database
   - Or register camera with matching IP address

### Camera Not Found Warning

**Warning:** `"Camera not found. Request logged but not stored."`

**This is OK for testing!** The webhook will:
- ✅ Log all incoming messages to log files
- ✅ Return success (so cameras don't stop sending)
- ❌ Not store in database (until camera is registered)

**To fix:**
1. Register camera in database with:
   - **Name** matching the "device" field from camera
   - **IP Address** matching camera's IP
   - **isActive** = true

2. After registration, future requests will be stored in database

### Camera Not Found Error (Old Behavior)

**Error:** `"Camera not found. Please register the camera first."`

**Solution:**
1. Check that the camera is registered in the database
2. Verify the camera's **Name** matches the **device** field in the webhook payload
3. Ensure the camera's **isActive** status is `true`
4. Check the camera's IP address matches if using IP-based identification

### Image Upload Fails

**Error:** `"BunnyCDN upload failed"`

**Solution:**
1. Verify `BUNNY_STORAGE_ZONE` and `BUNNY_ACCESS_KEY` are set correctly
2. Check BunnyCDN account has sufficient storage/quota
3. Verify network connectivity to BunnyCDN
4. Check image base64 encoding is valid

### Events Not Being Processed

**Check:**
1. Camera HTTP Post is enabled
2. Correct webhook URL is configured
3. Events are registered in camera settings
4. Check server logs for error messages
5. Verify database connection is working

## Database Schema

After running `npx prisma db push`, the following tables will be created:

- `lpr_cameras` - Camera configurations
- `lpr_recognition_events` - License plate recognition events
- `lpr_vehicle_counting_events` - Vehicle counting statistics
- `lpr_list_events` - Whitelist/blacklist events
- `lpr_attributes_events` - Vehicle attribute events
- `lpr_violation_events` - Violation events
- `lpr_images` - Image metadata and URLs

## Next Steps

1. Run `npx prisma db push` to create the database tables
2. Register your cameras in the database (via admin interface or API)
3. Configure cameras with the webhook URL
4. Test with a recognition event
5. Monitor events in your application
