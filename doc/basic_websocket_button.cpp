#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "SENSORFLOW";
const char* password = "12345678";

// WebSocket server details
const char* websocket_server_host = "nikolaindustry-network.onrender.com"; // Replace with your server address
const uint16_t websocket_port = 443;                                      // For wss (secure WebSocket)
const char* websocket_path = "/connect?id=5txey73xdf";                    // Unique ID for this ESP32

WebSocketsClient webSocket;

unsigned long lastPingTime = 0;
const unsigned long pingInterval = 50000; // 50 seconds

void setup() {
  Serial.begin(115200);

  // Connect to WiFi
  connectToWiFi();

  // Initialize WebSocket
  initializeWebSocket();
}

void loop() {
  // Maintain WebSocket connection
  webSocket.loop();

  // Send a ping periodically
  unsigned long currentMillis = millis();
  if (currentMillis - lastPingTime > pingInterval) {
    webSocket.sendPing();
    lastPingTime = currentMillis;
  }

  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected! Reconnecting...");
    connectToWiFi();
  }
}

void connectToWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");
}

void initializeWebSocket() {
  webSocket.beginSSL(websocket_server_host, websocket_port, websocket_path); // Use SSL for wss
  webSocket.onEvent(webSocketEvent);                                         // Define event handler
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("WebSocket connected!");
      break;

    case WStype_TEXT: {
      Serial.print("Message from server: ");
      Serial.println((char*)payload);

      // Parse the JSON payload
      StaticJsonDocument<1024> doc;
      DeserializationError error = deserializeJson(doc, payload);
      if (error) {
        Serial.print("Failed to parse JSON: ");
        Serial.println(error.f_str());
        return;
      }

      // Extract details
      const char* targetId = doc["from"];
      const char* controlid = doc["payload"]["controlid"];
      const char* deviceid = doc["payload"]["deviceid"];
      const char* commands = doc["payload"]["commands"];
      int pin = doc["payload"]["pin"];
      const char* action = doc["payload"]["actions"];
      Serial.println("Command received");
      Serial.println(commands);

      if (strcmp(commands, "control_gpio") == 0) {
        
        Serial.println("Performing GPIO control");
        if (strcmp(action, "toggle") == 0) {
          pinMode(pin, OUTPUT);
          digitalWrite(pin, !digitalRead(pin)); 
        } else if (strcmp(action, "HIGH") == 0) {
          pinMode(pin, OUTPUT);
          digitalWrite(pin, HIGH);
        } else if (strcmp(action, "LOW") == 0) {
          pinMode(pin, OUTPUT);
          digitalWrite(pin, LOW);
        }
        String feedback;
        StaticJsonDocument<256> feedbackDoc;
        feedbackDoc["targetId"] = targetId;
        JsonObject feedbackPayload = feedbackDoc.createNestedObject("payload");
        feedbackPayload["deviceid"] = deviceid;
        feedbackPayload["pin"] = pin;
        feedbackPayload["controlid"] = controlid;
        feedbackPayload["status"] = digitalRead(pin) == HIGH ? "HIGH" : "LOW"; // Current status of GPIO

        serializeJson(feedbackDoc, feedback);
        sendMessage(feedback.c_str());

      }
      break;
    }

    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected! Reconnecting...");
      initializeWebSocket(); // Reinitialize WebSocket
      break;

    default:
      break;
  }
}

// Function to send messages
void sendMessage(const char* message) {
  webSocket.sendTXT(message);
  Serial.print("Sent: ");
  Serial.println(message);
}
