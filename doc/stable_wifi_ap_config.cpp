#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>

// AP Mode credentials
const char* apSSID = "NIKOLAINDUSTRY_Setup";
const char* apPassword = "0123456789";

// Web server and DNS server
WebServer server(80);
DNSServer dnsServer;

// Wi-Fi credentials
String ssid, password;

// Preferences for saving credentials
Preferences preferences;

// Function prototypes
void startAPMode();
void handleConfigPage();
void handleConfigSubmit();
void clearConfig();
void handleSetWiFi();
void connectToWiFi();

void setup() {
  Serial.begin(115200);

  // Load stored Wi-Fi credentials
  preferences.begin("wifi-creds", true);
  ssid = preferences.getString("ssid", "");
  password = preferences.getString("password", "");
  preferences.end();

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
}

unsigned long lastReconnectAttempt = 0;
const unsigned long reconnectInterval = 10000;  // Attempt every 10 seconds if disconnected
int retryCount = 0;
const int maxRetries = 6;  // Switch to AP mode after 6 attempts

void loop() {
  dnsServer.processNextRequest();
  server.handleClient();
  if (!ssid.isEmpty() && !password.isEmpty()) {
    if (WiFi.status() != WL_CONNECTED) {
      unsigned long now = millis();
      if (now - lastReconnectAttempt >= reconnectInterval) {

        lastReconnectAttempt = now;

        Serial.println("Attempting to reconnect to WiFi...");
        WiFi.disconnect();
        WiFi.begin(ssid.c_str(), password.c_str());
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
      Serial.println("\nWiFi connected! IP Address: " + WiFi.localIP().toString());
    }
  }
}

void connectToWiFi() {
  const char* customHostname = "NIKOLAINDUSTRY_Device";
  WiFi.setHostname(customHostname);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  Serial.println("Connecting to WiFi...");

  unsigned long startAttemptTime = millis();
  const unsigned long timeout = 30000;  // 30 seconds timeout
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < timeout) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected! IP Address: " + WiFi.localIP().toString());
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
