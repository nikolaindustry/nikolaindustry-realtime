#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
// AP Mode credentials
const char* apSSID = "NIKOLAINDUSTRY_Setup";
const char* apPassword = "0123456789";

// Web server and DNS server
WebServer server(80);
DNSServer dnsServer;

// Wi-Fi credentials
String ssid, password, userid, deviceid, loaclip, macid;

// Preferences for saving credentials
Preferences preferences;
WebSocketsClient webSocket;
// Function prototypes
void startAPMode();
void handleConfigPage();
void handleConfigSubmit();
void clearConfig();
void handleSetWiFi();
void connectToWiFi();
void getcredentials();
void initializeWebSocket();

// WebSocket server details
const char* websocket_server_host = "nikolaindustry-network.onrender.com";  // Replace with your server address
const uint16_t websocket_port = 443;

unsigned long lastPingTime = 0;
const unsigned long pingInterval = 50000;  // 50 seconds


void setup() {
  Serial.begin(115200);
  getcredentials();
  // Start in STA mode if credentials are available; otherwise, start in AP mode
  if (!ssid.isEmpty() && !password.isEmpty()) {
    connectToWiFi();
  } else {
    startAPMode();
  }

  // Configure web server routes
  server.on("/", handleConfigPage);
  server.on("/submit", HTTP_POST, handleConfigSubmit);
  server.on("/setwifi", HTTP_GET, handleSetWiFi);
  server.on("/clearwifi", HTTP_GET, clearConfig);
  server.begin();
  initializeWebSocket();
}

unsigned long lastReconnectAttempt = 0;
const unsigned long reconnectInterval = 10000;  // Attempt every 10 seconds if disconnected
int retryCount = 0;
const int maxRetries = 6;  // Switch to AP mode after 6 attempts

void loop() {
  dnsServer.processNextRequest();
  server.handleClient();
  webSocket.loop();

  if (!ssid.isEmpty() && !password.isEmpty() && !deviceid.isEmpty()) {
    if (WiFi.status() != WL_CONNECTED) {
      unsigned long now = millis();
      if (now - lastReconnectAttempt >= reconnectInterval) {

        lastReconnectAttempt = now;

        Serial.println("Attempting to reconnect to WiFi...");
        //WiFi.disconnect();
        WiFi.begin(ssid.c_str(), password.c_str());
        delay(100);
        Serial.println(ssid);
        Serial.println(password);
        retryCount++;

        if (retryCount >= maxRetries) {
          Serial.println("Failed to connect. Switching to AP mode.");
          startAPMode();
          retryCount = 0;  // Reset retry count
        }
      }
    } else {
      retryCount = 0;  // Reset retry count on successful connection
      lastReconnectAttempt = 0;
      //Serial.println("\nWiFi connected! IP Address: " + WiFi.localIP().toString());
      unsigned long currentMillis = millis();
      if (currentMillis - lastPingTime > pingInterval) {
        webSocket.sendPing();
        lastPingTime = currentMillis;
      }
    }
  }
}


void getcredentials() {
  // Load stored Wi-Fi credentials
  preferences.begin("wifi-creds", true);
  ssid = preferences.getString("ssid", "");
  password = preferences.getString("password", "");
  userid = preferences.getString("userid", "");
  deviceid = preferences.getString("deviceid", "5txey73xdf");
  preferences.end();
}


void initializeWebSocket() {

  if (!ssid.isEmpty() && !password.isEmpty() && !deviceid.isEmpty()) {
    if (WiFi.status() == WL_CONNECTED) {

      String websocket_path_str = "/connect?id=" + deviceid;
      webSocket.beginSSL(websocket_server_host, websocket_port, websocket_path_str.c_str());  // Use SSL for wss
      webSocket.onEvent(webSocketEvent);
    } else {
      Serial.println("WiFi not connected, skipping WebSocket initialization.");
    }
    // Define event handler

  } else {
    Serial.println("Device_id Not Found");
  }
}


// Function to send messages
void sendMessage(const char* message) {
  if (!webSocket.sendTXT(message)) {
    Serial.println("Failed to send WebSocket message.");
}else{
  Serial.print("Sent: ");
  Serial.println(message);
}

}


void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {

  switch (type) {
    case WStype_CONNECTED:
      Serial.println("WebSocket connected!");
      break;

    case WStype_TEXT:
      {
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
        const char* action = doc["payload"]["actions"];
        int pin = doc["payload"]["pin"];

        Serial.println("Command Received");
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
          feedbackPayload["status"] = digitalRead(pin) == HIGH ? "HIGH" : "LOW";  // Current status of GPIO

          serializeJson(feedbackDoc, feedback);
          sendMessage(feedback.c_str());
        }
        break;
      }

    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected! Reconnecting...");
      initializeWebSocket();  // Reinitialize WebSocket
      break;

    default:
      break;
  }
}






void connectToWiFi() {
  const char* customHostname = "NIKOLAINDUSTRY_Device";
  WiFi.setHostname(customHostname);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  delay(100);
  Serial.println("Connecting to WiFi...");

  unsigned long startAttemptTime = millis();
  const unsigned long timeout = 30000;  // 30 seconds timeout
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < timeout) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected! IP Address: " + WiFi.localIP().toString());
    initializeWebSocket();
  } else {
    Serial.println("\nConnection timed out. Switching to AP mode.");
    startAPMode();
  }
}

void startAPMode() {
  const char* customHostname = "NIKOLAINDUSTRY_AP_Config";
  WiFi.setHostname(customHostname);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apSSID, apPassword);
  WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));

  dnsServer.start(53, "*", WiFi.softAPIP());
  Serial.println("AP Mode started. Connect to: " + String(apSSID));
  Serial.println("Open the browser and access: http://192.168.4.1");
}

void handleConfigPage() {
  String htmlPage =
    "<!DOCTYPE html>"
    "<html><head><title>NIKOLAINDUSTRY_Config</title></head><body>"
    "<h1>WiFi Configuration</h1>"
    "<form action=\"/submit\" method=\"POST\">"
    "SSID: <input type=\"text\" name=\"ssid\"><br>"
    "Password: <input type=\"password\" name=\"password\"><br>"
    "<input type=\"submit\" value=\"Save\">"
    "</form></body></html>";
  server.send(200, "text/html", htmlPage);
}

void handleConfigSubmit() {
  ssid = server.arg("ssid");
  password = server.arg("password");
  if (!ssid.isEmpty() && !password.isEmpty()) {
    preferences.begin("wifi-creds", false);
    preferences.putString("ssid", ssid);
    preferences.putString("password", password);
    preferences.end();
    server.send(200, "application/json", "{\"status\":\"saved\",\"message\":\"WiFi credentials saved. Restarting...\"}");
    delay(1000);
    ESP.restart();
  } else {
    server.send(400, "application/json", "{\"status\":\"failed\",\"message\":\"Invalid input. Try again.\"}");
  }
}

void clearConfig() {
  preferences.begin("wifi-creds", false);
  preferences.clear();
  preferences.end();
  server.send(200, "application/json", "{\"status\":\"cleared\",\"message\":\"WiFi credentials cleared. Restarting...\"}");
  delay(1000);
  ESP.restart();
}

void handleSetWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    server.send(200, "application/json", "{\"status\":\"connected\",\"message\":\"Already connected to WiFi.\"}");
    return;
  }
  if (server.hasArg("ssid") && server.hasArg("password")) {
    ssid = server.arg("ssid");
    password = server.arg("password");
    preferences.begin("wifi-creds", false);
    preferences.putString("ssid", ssid);
    preferences.putString("password", password);
    preferences.end();
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"WiFi saved. Restarting...\"}");
    delay(1000);
    ESP.restart();
  } else {
    server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"Missing parameters.\"}");
  }
}
