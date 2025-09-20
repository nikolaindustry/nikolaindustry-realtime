# HTTP API Documentation

This server now provides HTTP REST APIs that forward data to connected WebSocket devices. All APIs accept JSON data and forward it over WebSocket connections.

## Base URL
```
http://localhost:3000/api
```

## Endpoints

### 1. Send Message to Specific Device
**POST** `/api/send/:deviceId`

Send a message to a specific device by its ID.

**Parameters:**
- `deviceId` (URL parameter): The target device ID

**Request Body:**
```json
{
  "payload": {
    "command": "TURN_ON",
    "pin": 2,
    "value": "HIGH"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent to device esp32-001",
  "connections": 1
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/send/esp32-001 \
  -H "Content-Type: application/json" \
  -d '{"payload": {"command": "TURN_ON", "pin": 2}}'
```

---

### 2. Send Message to Multiple Devices
**POST** `/api/send-multiple`

Send the same message to multiple devices.

**Request Body:**
```json
{
  "deviceIds": ["esp32-001", "esp32-002", "esp32-003"],
  "payload": {
    "command": "REBOOT"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Messages processed for 3 devices",
  "totalSent": 3,
  "results": [
    {"deviceId": "esp32-001", "status": "sent", "connections": 1},
    {"deviceId": "esp32-002", "status": "sent", "connections": 1},
    {"deviceId": "esp32-003", "status": "not_found", "connections": 0}
  ]
}
```

---

### 3. Broadcast to All Devices
**POST** `/api/broadcast`

Send a message to all connected devices.

**Request Body:**
```json
{
  "payload": {
    "message": "System maintenance in 5 minutes",
    "type": "notification"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Broadcast sent to all connected devices",
  "totalSent": 5,
  "devices": [
    {"deviceId": "esp32-001", "connections": 1},
    {"deviceId": "esp32-002", "connections": 1}
  ]
}
```

---

### 4. Batch Commands
**POST** `/api/batch`

Send different commands to different devices in a single request.

**Request Body:**
```json
{
  "commands": [
    {
      "deviceId": "esp32-001",
      "payload": {"command": "TURN_ON", "pin": 2}
    },
    {
      "deviceId": "esp32-002", 
      "payload": {"command": "SET_BRIGHTNESS", "pin": 16, "value": 128}
    },
    {
      "deviceId": "esp32-003",
      "payload": {"command": "READ_SENSOR", "pin": 36}
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Batch commands processed for 3 commands",
  "totalSent": 3,
  "results": [
    {"deviceId": "esp32-001", "status": "sent", "connections": 1},
    {"deviceId": "esp32-002", "status": "sent", "connections": 1},
    {"deviceId": "esp32-003", "status": "not_found", "connections": 0}
  ]
}
```

---

### 5. Get Connected Devices
**GET** `/api/devices`

Get a list of all connected devices and their status.

**Response:**
```json
{
  "success": true,
  "totalDevices": 2,
  "devices": [
    {
      "deviceId": "esp32-001",
      "connections": 1,
      "status": "online"
    },
    {
      "deviceId": "esp32-002", 
      "connections": 0,
      "status": "offline"
    }
  ]
}
```

---

### 6. Get Specific Device Status
**GET** `/api/devices/:deviceId`

Get the status of a specific device.

**Response:**
```json
{
  "success": true,
  "deviceId": "esp32-001",
  "connections": 1,
  "status": "online"
}
```

---

### 7. Health Check
**GET** `/api/health`

Check if the API is running.

**Response:**
```json
{
  "status": "up",
  "timestamp": "2024-12-25T10:30:45.123Z"
}
```

## Error Responses

### Device Not Found (404):
```json
{
  "error": "Device esp32-001 not found or not connected"
}
```

### Invalid Request (400):
```json
{
  "error": "Payload is required"
}
```

### Server Error (500):
```json
{
  "error": "Failed to send message"
}
```

## Message Format Received by Devices

When devices receive messages through these APIs, they will receive them in this format:

```json
{
  "from": "api",
  "payload": {
    // Your original payload data
  }
}
```

The `from` field indicates the source:
- `"api"` - Single device message
- `"api_broadcast"` - Broadcast message  
- `"api_batch"` - Batch command

## Example Use Cases

### 1. GPIO Control
```bash
curl -X POST http://localhost:3000/api/send/esp32-001 \
  -H "Content-Type: application/json" \
  -d '{"payload": {"action": "control_gpio", "pin": 2, "state": "HIGH"}}'
```

### 2. PWM Control
```bash
curl -X POST http://localhost:3000/api/send/esp32-001 \
  -H "Content-Type: application/json" \
  -d '{"payload": {"action": "dim_brightness", "pin": 16, "start_value": 0, "end_value": 255, "duration": 5000}}'
```

### 3. Emergency Stop All Devices
```bash
curl -X POST http://localhost:3000/api/broadcast \
  -H "Content-Type: application/json" \
  -d '{"payload": {"command": "EMERGENCY_STOP"}}'
```
