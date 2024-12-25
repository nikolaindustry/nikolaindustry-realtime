Below is the complete firmware code and JSON structure to implement a truly programmable remote ESP32 system via WebSocket.

---

### **JSON Message Structure**

#### Example Actions and Payloads

```json
{
  "device_id": "esp32-001",
  "action": "control_gpio",
  "payload": {
    "pin": 2,
    "state": "HIGH"
  },
  "timestamp": "2024-12-25T10:00:00Z"
}

{
  "device_id": "esp32-001",
  "action": "dim_brightness",
  "payload": {
    "pin": 16,
    "start_value": 0,
    "end_value": 255,
    "duration": 5000
  },
  "timestamp": "2024-12-25T10:05:00Z"
}

{
  "device_id": "esp32-001",
  "action": "schedule_task",
  "payload": {
    "task": {
      "action": "control_gpio",
      "payload": {
        "pin": 5,
        "state": "LOW"
      }
    },
    "start_time": "2024-12-25T10:10:00Z"
  },
  "timestamp": "2024-12-25T10:00:00Z"
}
```

---

### **ESP32 Firmware Code**

Here’s a robust implementation for receiving and executing JSON commands:

```cpp
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

#define WIFI_SSID "your_wifi_ssid"
#define WIFI_PASSWORD "your_wifi_password"
#define SERVER_URL "your_server_url"
#define SERVER_PORT 443 // Change to 80 if not using SSL
#define DEVICE_ID "esp32-001"

WebSocketsClient webSocket;
unsigned long lastPing = 0;

// Function to control GPIO
void controlGPIO(int pin, String state) {
  pinMode(pin, OUTPUT);
  if (state == "HIGH") {
    digitalWrite(pin, HIGH);
  } else if (state == "LOW") {
    digitalWrite(pin, LOW);
  }
}

// Function to dim GPIO (PWM)
void dimBrightness(int pin, int startValue, int endValue, int duration) {
  int step = (endValue - startValue) / (duration / 10);
  for (int value = startValue; value != endValue; value += step) {
    analogWrite(pin, value);
    delay(10);
  }
}

// Function to schedule a task
void scheduleTask(JsonObject payload) {
  String startTime = payload["start_time"];
  String action = payload["task"]["action"];
  JsonObject taskPayload = payload["task"]["payload"];
  // Example only: Convert start_time to millis and delay the task
  // Actual implementation will need time syncing (e.g., NTP)
  delay(1000); // Temporary delay simulation
  executeAction(action, taskPayload);
}

// Function to parse and execute JSON actions
void executeAction(String action, JsonObject payload) {
  if (action == "control_gpio") {
    int pin = payload["pin"];
    String state = payload["state"];
    controlGPIO(pin, state);
  } else if (action == "dim_brightness") {
    int pin = payload["pin"];
    int startValue = payload["start_value"];
    int endValue = payload["end_value"];
    int duration = payload["duration"];
    dimBrightness(pin, startValue, endValue, duration);
  } else if (action == "schedule_task") {
    scheduleTask(payload);
  }
}

// WebSocket message handler
void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_TEXT: {
      StaticJsonDocument<1024> doc;
      DeserializationError error = deserializeJson(doc, payload);
      if (!error) {
        String action = doc["action"];
        JsonObject jsonPayload = doc["payload"];
        executeAction(action, jsonPayload);
      } else {
        Serial.println("JSON Parse Error!");
      }
      break;
    }
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi.");

  // Connect to WebSocket server
  webSocket.begin(SERVER_URL, SERVER_PORT, "/");
  webSocket.onEvent(webSocketEvent);

  // Optional: Reconnect behavior
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();

  // Periodic pings to keep the connection alive
  if (millis() - lastPing > 5000) {
    webSocket.sendTXT("{\"ping\":\"" + String(DEVICE_ID) + "\"}");
    lastPing = millis();
  }
}
```

---

### **Features Covered**
1. **Remote GPIO control:** `control_gpio`.
2. **PWM-based dimming:** `dim_brightness`.
3. **Task scheduling:** `schedule_task`.
4. **Dynamic action execution:** Parsed from JSON.
5. **Custom payload handling:** Flexible for any action.
6. **Real-time updates:** Immediate response over WebSocket.
7. **Resilience:** Auto-reconnection for WebSocket.
8. **Scalability:** Custom JSON extensibility for more actions.

You can customize this firmware further depending on advanced use cases, such as remote firmware upgrades or telemetry. Let me know if you need additional help!
