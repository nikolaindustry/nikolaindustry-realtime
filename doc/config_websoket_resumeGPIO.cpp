#include <WiFi.h>
#include <HTTPClient.h>
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
String ssid, password, userid, deviceid, productid, firstimecall, email, loaclip, macid;

// Preferences for saving credentials
Preferences preferences;
Preferences gpioPreferences;
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
void restoreAllGPIOStates();

// WebSocket server details
const char* websocket_server_host = "nikolaindustry-network.onrender.com";  // Replace with your server address
const uint16_t websocket_port = 443;

unsigned long lastPingTime = 0;
const unsigned long pingInterval = 50000;  // 50 seconds


void setup() {

  getcredentials();
  // Initialize GPIO Preferences
  gpioPreferences.begin("gpio-states", false);
  restoreAllGPIOStates();  // Restore previously saved GPIO states
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
        Serial.println(deviceid);
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
  Serial.begin(115200);
  preferences.begin("wifi-creds", false);
  ssid = preferences.getString("ssid", "");
  password = preferences.getString("password", "");
  userid = preferences.getString("userid", "");
  email = preferences.getString("email", "");
  deviceid = preferences.getString("deviceid", "");
  productid = preferences.getString("productid", "");
  firstimecall = preferences.getString("APICALL", "");
  Serial.println(ssid);
  Serial.println(password);
  Serial.println(deviceid);
  Serial.println(productid);
  Serial.println(firstimecall);
  Serial.println(userid);
  Serial.println(email);
  preferences.end();
}

void saveGPIOState(int pin, int state) {
  gpioPreferences.putInt(("pin_" + String(pin)).c_str(), state);
}

int loadGPIOState(int pin) {
  return gpioPreferences.getInt(("pin_" + String(pin)).c_str(), LOW);
}
void restoreAllGPIOStates() {
  for (int pin = 0; pin < 40; pin++) {  // Adjust for your pin range
    String key = "pin_" + String(pin);
    if (gpioPreferences.isKey(key.c_str())) {
      int state = gpioPreferences.getInt(key.c_str(), LOW);
      pinMode(pin, OUTPUT);
      digitalWrite(pin, state);
      Serial.printf("Restored pin %d to state %d\n", pin, state);
    }
  }
}


void initializeWebSocket() {

  if (!ssid.isEmpty() && !password.isEmpty() && !deviceid.isEmpty() && WiFi.status() == WL_CONNECTED) {
    String websocket_path = "/connect?id=" + deviceid;
    webSocket.beginSSL(websocket_server_host, websocket_port, websocket_path.c_str());
    webSocket.onEvent(webSocketEvent);
  } else {
    Serial.println("Skipping WebSocket initialization.");
  }
}


// Function to send messages
void sendMessage(const char* message) {
  if (WiFi.status() == WL_CONNECTED) {
    if (!webSocket.sendTXT(message)) {
      Serial.println("Failed to send WebSocket message.");
    } else {
      Serial.print("Sent: ");
      Serial.println(message);
    }
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
            int newState = !digitalRead(pin);
            digitalWrite(pin, newState);
            saveGPIOState(pin, newState);  // Save state
          } else if (strcmp(action, "HIGH") == 0) {
            pinMode(pin, OUTPUT);
            digitalWrite(pin, HIGH);
            saveGPIOState(pin, HIGH);  // Save state
          } else if (strcmp(action, "LOW") == 0) {
            pinMode(pin, OUTPUT);
            digitalWrite(pin, LOW);
            saveGPIOState(pin, LOW);  // Save state
          }
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
    if (firstimecall == "true") {
      String regiapi = "https://nikolaindustry.wixstudio.com/hyperwisor-v2/_functions/product_registration?ssid=" + ssid + "&password=" + password + "&deviceid=" + deviceid + "&email=" + email + "&userid=" + userid + "&productid=" + productid;
      Serial.println(regiapi);
      HTTPClient http;
      http.begin(regiapi);           // Initialize with the URL
      int httpGETCode = http.GET();  // Perform GET request without arguments
      if (httpGETCode > 0) {
        // HTTP response code > 0 means request was successful
        String payload = http.getString();
        Serial.println(httpGETCode);
        Serial.println(payload);  // Log response payload

        if (httpGETCode == 200) {
          preferences.begin("wifi-creds", false);
          preferences.putString("APICALL", "false");
          firstimecall = preferences.getString("APICALL", "");
          preferences.end();
        }

      } else {
        // Handle request failure
        Serial.printf("HTTP GET failed, error: %s\n", http.errorToString(httpGETCode).c_str());
      }
      http.end();  // Close the HTTP connection
    } else {
      Serial.println("product already registred");
    }
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
  preferences.putString("ssid", "");
  preferences.putString("password", "");
  preferences.putString("userid", "");
  preferences.putString("deviceid", "");
  preferences.end();
  server.send(200, "application/json", "{\"status\":\"cleared\",\"message\":\"WiFi credentials cleared. Restarting...\"}");
  delay(1000);
  ESP.restart();
}

void handleSetWiFi() {
  // if (WiFi.status() == WL_CONNECTED) {
  //   server.send(200, "application/json", "{\"status\":\"connected\",\"message\":\"Already connected to WiFi.\"}");
  //   return;
  // }
  if (server.hasArg("ssid") && server.hasArg("password") && server.hasArg("userid") && server.hasArg("deviceid") && server.hasArg("email") && server.hasArg("productid")) {

    ssid = server.arg("ssid");
    password = server.arg("password");
    userid = server.arg("userid");
    deviceid = server.arg("deviceid");
    productid = server.arg("productid");
    email = server.arg("email");

    if (ssid.length() > 0 && password.length() > 0 && userid.length() > 0 && deviceid.length() > 0 && productid.length() > 0 && email.length() > 0) {
      preferences.begin("wifi-creds", false);
      preferences.putString("ssid", ssid);
      preferences.putString("password", password);
      preferences.putString("userid", userid);
      preferences.putString("deviceid", deviceid);
      preferences.putString("email", email);
      preferences.putString("productid", productid);
      preferences.putString("APICALL", "true");
      preferences.end();
      Serial.println("200");
      server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"WiFi saved. Restarting...\"}");


      // WiFi.begin(ssid.c_str(), password.c_str());
      delay(500);
      ESP.restart();
    }else {
      server.send(404, "application/json", "{\"status\":\"missing\",\"message\":\"WiFi not saved.\"}");

    }

  } else {
    server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"Missing parameters.\"}");
    Serial.println("400");
    delay(5000);
  }
}
