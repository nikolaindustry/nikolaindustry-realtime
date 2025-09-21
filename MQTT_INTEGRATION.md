# MQTT Integration Documentation

This server now supports both **WebSocket** and **MQTT** protocols for device communication. Devices can connect via either protocol and communicate seamlessly with each other.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   HTTP APIs     │    │  WebSocket      │    │     MQTT        │
│                 │    │   Devices       │    │    Devices      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │    Unified Message        │
                    │    Routing System         │
                    └───────────────────────────┘
```

## Connection Methods

### WebSocket Devices
Connect via WebSocket with device ID in query parameter:
```
ws://localhost:3000/?id=device-123
```

### MQTT Devices
Connect to MQTT broker and subscribe to command topic:
```
MQTT Broker: mqtt://localhost:1883
Subscribe to: device/{deviceId}/commands
```

## MQTT Topic Structure

### For Device Registration
- **Subscribe to**: `device/{deviceId}/commands` - Device will receive commands on this topic

### For Device Communication
- **Publish to**: `device/{fromDeviceId}/send/{targetDeviceId}` - Send message to specific device
- **Publish to**: `device/{deviceId}/broadcast` - Broadcast to all devices  
- **Publish to**: `device/{deviceId}/batch` - Send batch commands
- **Publish to**: `device/{deviceId}/status` - Send status updates
- **Publish to**: `device/{deviceId}/data` - Send sensor/data readings

## Cross-Protocol Communication

### MQTT ↔ WebSocket
- MQTT devices can send messages to WebSocket devices
- WebSocket devices can send messages to MQTT devices
- HTTP APIs can send to both protocol types
- Broadcasts reach devices on both protocols

### Message Flow Examples

#### 1. MQTT Device → WebSocket Device
```
MQTT Device publishes to: device/esp32-mqtt-001/send/esp32-ws-002
↓
Server forwards to WebSocket device: esp32-ws-002
```

#### 2. WebSocket Device → MQTT Device  
```
WebSocket Device sends: {"targetId": "esp32-mqtt-001", "payload": {...}}
↓
Server forwards to MQTT topic: device/esp32-mqtt-001/commands
```

#### 3. HTTP API → Both Protocols
```
POST /api/broadcast {"payload": {"command": "EMERGENCY_STOP"}}
↓
Sent to all WebSocket devices + Published to all MQTT device command topics
```

## MQTT Message Formats

### Commands Received by MQTT Devices
```json
{
  "from": "api|device-id|server",
  "payload": {
    "command": "TURN_ON",
    "pin": 2
  },
  "via": "websocket-to-mqtt" // Optional routing info
}
```

### Device-to-Device Communication
```json
// Publish to: device/esp32-001/send/esp32-002
{
  "command": "READ_SENSOR", 
  "pin": 36,
  "responseChannel": "device/esp32-001/data"
}
```

### Broadcast Messages
```json
// Publish to: device/esp32-001/broadcast
{
  "type": "notification",
  "message": "System maintenance starting",
  "priority": "high"
}
```

### Batch Commands
```json
// Publish to: device/esp32-001/batch
{
  "controlData": [
    {
      "targetId": "esp32-002",
      "payload": {"command": "TURN_ON", "pin": 2}
    },
    {
      "targetId": "esp32-003", 
      "payload": {"command": "SET_BRIGHTNESS", "pin": 16, "value": 128}
    }
  ]
}
```

## HTTP API Updates

All existing HTTP endpoints now support both WebSocket and MQTT devices:

### Response Format (Updated)
```json
{
  "success": true,
  "message": "Message sent to device esp32-001",
  "connections": 1,
  "protocols": ["mqtt"] // Shows which protocols were used
}
```

### Device List (Updated)
```json
{
  "success": true,
  "totalDevices": 3,
  "devices": [
    {
      "deviceId": "esp32-ws-001",
      "type": "websocket",
      "connections": 1,
      "status": "online",
      "protocols": ["websocket"]
    },
    {
      "deviceId": "esp32-mqtt-002", 
      "type": "mqtt",
      "connections": 1,
      "status": "online",
      "protocols": ["mqtt"]
    },
    {
      "deviceId": "esp32-hybrid-003",
      "type": "hybrid", 
      "connections": 2,
      "status": "online",
      "protocols": ["websocket", "mqtt"]
    }
  ]
}
```

## New MQTT-Specific Endpoints

### Get MQTT Broker Statistics
```http
GET /api/mqtt/stats
```
**Response:**
```json
{
  "success": true,
  "stats": {
    "clients": 5,
    "subscriptions": 12
  }
}
```

### Publish to MQTT Topic Directly
```http
POST /api/mqtt/publish
Content-Type: application/json

{
  "topic": "device/esp32-001/commands",
  "payload": {"command": "RESTART"},
  "qos": 1,
  "retain": false
}
```

## ESP32 MQTT Implementation Example

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

#define MQTT_SERVER "your-server-ip"
#define MQTT_PORT 1883
#define DEVICE_ID "esp32-001"

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
    Serial.begin(115200);
    
    // Connect to WiFi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }
    
    // Setup MQTT
    client.setServer(MQTT_SERVER, MQTT_PORT);
    client.setCallback(mqttCallback);
    
    // Connect and subscribe
    connectMQTT();
}

void connectMQTT() {
    while (!client.connected()) {
        if (client.connect(DEVICE_ID)) {
            Serial.println("MQTT Connected");
            
            // Subscribe to command topic
            String commandTopic = "device/" + String(DEVICE_ID) + "/commands";
            client.subscribe(commandTopic.c_str());
            
        } else {
            delay(5000);
        }
    }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
    String message = "";
    for (int i = 0; i < length; i++) {
        message += (char)payload[i];
    }
    
    // Parse JSON command
    StaticJsonDocument<1024> doc;
    deserializeJson(doc, message);
    
    String command = doc["payload"]["command"];
    int pin = doc["payload"]["pin"];
    
    // Execute command
    if (command == "TURN_ON") {
        digitalWrite(pin, HIGH);
    } else if (command == "TURN_OFF") {
        digitalWrite(pin, LOW);
    }
    
    // Send response
    sendStatus("Command executed: " + command);
}

void sendToDevice(String targetId, JsonObject payload) {
    String topic = "device/" + String(DEVICE_ID) + "/send/" + targetId;
    String message;
    serializeJson(payload, message);
    client.publish(topic.c_str(), message.c_str());
}

void broadcastMessage(JsonObject payload) {
    String topic = "device/" + String(DEVICE_ID) + "/broadcast";
    String message;
    serializeJson(payload, message);
    client.publish(topic.c_str(), message.c_str());
}

void sendStatus(String status) {
    String topic = "device/" + String(DEVICE_ID) + "/status";
    client.publish(topic.c_str(), status.c_str());
}

void loop() {
    if (!client.connected()) {
        connectMQTT();
    }
    client.loop();
}
```

## Port Configuration

- **HTTP Server**: Port 3000 (or PORT environment variable)
- **WebSocket**: Same as HTTP server (ws://localhost:3000)
- **MQTT TCP**: Port 1883 (or MQTT_PORT environment variable)
- **MQTT over WebSocket**: Port 8883 (or MQTT_WS_PORT environment variable)

## Running the Server

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. The server will start all protocols:
```
🚀 Server running on port 3000
🔌 WebSocket available at ws://localhost:3000
🌐 HTTP API available at http://localhost:3000/api
🦟 MQTT Server running on port 1883
🦟 MQTT over WebSocket running on port 8883
```

## Benefits of Dual Protocol Support

1. **Flexibility**: Devices can choose the most suitable protocol
2. **Reliability**: Fallback options if one protocol fails
3. **Performance**: MQTT for low-bandwidth scenarios, WebSocket for real-time
4. **Compatibility**: Support for different device capabilities
5. **Unified Management**: Single API to control all devices regardless of protocol
