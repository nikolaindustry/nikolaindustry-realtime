#include <Arduino.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>

// Constants for GPIO pins and settings
#define MAX_GPIO_PINS 16
#define PWM_CHANNELS 8

// WebSocket server on port 8080
WebSocketsServer webSocket(8080);

// Current GPIO states and tasks
struct GPIOControl {
    int pin;
    String mode;
    bool state;
    int frequency;
    int dutyCycle;
    int duration;
    unsigned long taskStart;
    bool taskActive;
    int incrementalDelay;
    int brightnessStep;
    int maxBrightness;
};

GPIOControl gpioControls[MAX_GPIO_PINS];

// Helper function to parse incoming messages
void parseMessage(const String &message) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, message);

    if (error) {
        Serial.println("Failed to parse JSON message");
        return;
    }

    String action = doc["action"];
    JsonObject payload = doc["payload"].as<JsonObject>();

    if (action == "control_gpio") {
        int pin = payload["pin"];
        String mode = payload["mode"];
        bool state = payload["state"];

        pinMode(pin, mode == "OUTPUT" ? OUTPUT : INPUT);

        if (mode == "OUTPUT") {
            digitalWrite(pin, state ? HIGH : LOW);
        }

        gpioControls[pin].pin = pin;
        gpioControls[pin].mode = mode;
        gpioControls[pin].state = state;
    }

    else if (action == "blink_gpio") {
        int pin = payload["pin"];
        int frequency = payload["frequency"];
        int duration = payload["duration"];

        gpioControls[pin] = {pin, "OUTPUT", false, frequency, 50, duration, millis(), true, 0, 0, 0};
        pinMode(pin, OUTPUT);
    }

    else if (action == "dim_gpio") {
        int pin = payload["pin"];
        int dutyCycle = payload["duty_cycle"];
        int duration = payload["duration"];

        gpioControls[pin] = {pin, "PWM", false, 0, dutyCycle, duration, millis(), true, 0, 0, 0};
        ledcAttachPin(pin, pin);
        ledcSetup(pin, 5000, 8);
        ledcWrite(pin, (dutyCycle * 255) / 100);
    }

    else if (action == "toggle_gpio") {
        int pin = payload["pin"];

        gpioControls[pin].pin = pin;
        gpioControls[pin].state = !gpioControls[pin].state;
        pinMode(pin, OUTPUT);
        digitalWrite(pin, gpioControls[pin].state ? HIGH : LOW);
    }

    else if (action == "incremental_blink") {
        int pin = payload["pin"];
        int initialDelay = payload["initial_delay"];
        int delayStep = payload["delay_step"];
        int maxDuration = payload["max_duration"];

        gpioControls[pin] = {pin, "OUTPUT", false, 0, 0, maxDuration, millis(), true, initialDelay, delayStep, 0};
        pinMode(pin, OUTPUT);
    }

    else if (action == "increase_brightness") {
        int pin = payload["pin"];
        int maxBrightness = payload["max_brightness"];
        int step = payload["step"];
        int duration = payload["duration"];

        gpioControls[pin] = {pin, "PWM", false, 0, 0, duration, millis(), true, 0, step, maxBrightness};
        ledcAttachPin(pin, pin);
        ledcSetup(pin, 5000, 8);
        ledcWrite(pin, 0);
    }

    else if (action == "dim_after_delay") {
        int pin = payload["pin"];
        int delayTime = payload["delay"];
        int dutyCycle = payload["duty_cycle"];

        gpioControls[pin] = {pin, "PWM", false, 0, dutyCycle, delayTime, millis(), true, 0, 0, 0};
        ledcAttachPin(pin, pin);
        ledcSetup(pin, 5000, 8);
        ledcWrite(pin, 255);
    }

    else if (action == "conditional_toggle") {
        int pin = payload["pin"];
        bool condition = payload["condition"];

        gpioControls[pin].pin = pin;
        if (condition) {
            gpioControls[pin].state = !gpioControls[pin].state;
            pinMode(pin, OUTPUT);
            digitalWrite(pin, gpioControls[pin].state ? HIGH : LOW);
        }
    }

    else if (action == "schedule_sequence") {
        int pin1 = payload["sequence"][0]["pin"];
        int pin2 = payload["sequence"][1]["pin"];
        int delay1 = payload["sequence"][0]["delay"];
        int delay2 = payload["sequence"][1]["delay"];

        delay(delay1);
        digitalWrite(pin1, HIGH);

        delay(delay2);
        digitalWrite(pin2, HIGH);
    }
}

void handleWebSocketMessage(uint8_t num, uint8_t *payload, size_t length) {
    String message = String((char *)payload).substring(0, length);
    parseMessage(message);
}

void setup() {
    Serial.begin(115200);

    for (int i = 0; i < MAX_GPIO_PINS; i++) {
        gpioControls[i] = {0, "", false, 0, 0, 0, 0, false, 0, 0, 0};
    }

    webSocket.begin();
    webSocket.onEvent([](uint8_t num, WStype_t type, uint8_t *payload, size_t length) {
        if (type == WStype_TEXT) {
            handleWebSocketMessage(num, payload, length);
        }
    });

    Serial.println("WebSocket server started on ws://<device-ip>:8080");
}

void loop() {
    webSocket.loop();

    unsigned long currentMillis = millis();

    for (int i = 0; i < MAX_GPIO_PINS; i++) {
        if (gpioControls[i].taskActive) {
            if (gpioControls[i].mode == "PWM") {
                if (gpioControls[i].brightnessStep > 0) {
                    int brightness = (currentMillis - gpioControls[i].taskStart) / gpioControls[i].brightnessStep;
                    brightness = min(brightness, gpioControls[i].maxBrightness);
                    ledcWrite(gpioControls[i].pin, (brightness * 255) / 100);
                }

                if (currentMillis - gpioControls[i].taskStart >= gpioControls[i].duration * 1000) {
                    gpioControls[i].taskActive = false;
                    ledcWrite(gpioControls[i].pin, 0);
                }
            } 
            else if (gpioControls[i].mode == "OUTPUT") {
                if (gpioControls[i].incrementalDelay > 0) {
                    int interval = gpioControls[i].incrementalDelay;

                    if (currentMillis - gpioControls[i].taskStart >= gpioControls[i].duration * 1000) {
                        gpioControls[i].taskActive = false;
                        digitalWrite(gpioControls[i].pin, LOW);
                    } else if ((currentMillis - gpioControls[i].taskStart) % interval == 0) {
                        digitalWrite(gpioControls[i].pin, !gpioControls[i].state);
                        gpioControls[i].state = !gpioControls[i].state;
                        gpioControls[i].incrementalDelay += gpioControls[i].frequency;
                    }
                } else {
                    int interval = 1000 / gpioControls[i].frequency / 2;
                    if (currentMillis - gpioControls[i].taskStart >= gpioControls[i].duration * 1000) {
                        gpioControls[i].taskActive = false;
                        digitalWrite(gpioControls[i].pin, LOW);
                    } else if ((currentMillis - gpioControls[i].taskStart) % interval == 0) {
                        digitalWrite(gpioControls[i].pin, !gpioControls[i].state);
                        gpioControls[i].state = !gpioControls[i].state;
                    }
                }
            }
        }
    }
}
