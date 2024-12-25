# Advanced GPIO Control Examples for ESP32 via WebSocket

This document demonstrates advanced GPIO control use cases for ESP32 using WebSocket communication. Each example shows different scenarios and actions you can execute with JSON payloads. These examples can serve as practical templates for real-world automation.

---

## 1. Dimming and Glowing Effect
**Description:** Gradually increase and decrease the brightness of an LED over a given duration.

```json
{
  "device_id": "esp32_01",
  "action": "pwm_control",
  "timestamp": "2024-12-25T12:30:45Z",
  "payload": {
    "pin": 18,
    "frequency": 500,
    "duty_cycle": 0,
    "duration": 5,
    "schedule": [
      {"duty_cycle": 0, "duration": 1},
      {"duty_cycle": 25, "duration": 1},
      {"duty_cycle": 50, "duration": 1},
      {"duty_cycle": 75, "duration": 1},
      {"duty_cycle": 100, "duration": 1},
      {"duty_cycle": 75, "duration": 1},
      {"duty_cycle": 50, "duration": 1},
      {"duty_cycle": 25, "duration": 1},
      {"duty_cycle": 0, "duration": 1}
    ]
  }
}
```

---

## 2. Blink GPIO with Increasing Frequency
**Description:** Make an LED blink, increasing its blinking speed incrementally.

```json
{
  "device_id": "esp32_01",
  "action": "toggle",
  "timestamp": "2024-12-25T12:30:45Z",
  "payload": {
    "pin": 5,
    "schedule": [
      {"duration": 1000, "repeat": 5},
      {"duration": 500, "repeat": 5},
      {"duration": 200, "repeat": 5}
    ]
  }
}
```

---

## 3. Dim, Delay, Turn Off
**Description:** Control an LED to glow dimly for a while, stay on, and then turn off after a delay.

```json
{
  "device_id": "esp32_01",
  "action": "pwm_control",
  "timestamp": "2024-12-25T12:30:45Z",
  "payload": {
    "pin": 23,
    "frequency": 1000,
    "duty_cycle": 30,
    "duration": 10
  }
},
{
  "device_id": "esp32_01",
  "action": "set_state",
  "timestamp": "2024-12-25T12:30:55Z",
  "payload": {
    "pin": 23,
    "state": "HIGH",
    "duration": 5
  }
},
{
  "device_id": "esp32_01",
  "action": "set_state",
  "timestamp": "2024-12-25T13:00:00Z",
  "payload": {
    "pin": 23,
    "state": "LOW"
  }
}
```

---

## 4. Button Press: Double Blink and Stay OFF
**Description:** If a button is pressed, the LED blinks twice and then stays off.

```json
{
  "device_id": "esp32_01",
  "action": "schedule_task",
  "timestamp": "2024-12-25T12:30:45Z",
  "payload": {
    "pin": 16,
    "task": "toggle",
    "schedule": {
      "repeat": 2,
      "duration": 500,
      "end_time": "2024-12-25T12:31:00Z"
    }
  }
},
{
  "device_id": "esp32_01",
  "action": "set_state",
  "timestamp": "2024-12-25T12:31:05Z",
  "payload": {
    "pin": 16,
    "state": "LOW"
  }
}
```

---

## 5. Relay Control Sequence
**Description:** Activate multiple relays in sequence with delay between each.

```json
{
  "device_id": "esp32_01",
  "action": "sequence_relay",
  "timestamp": "2024-12-25T12:30:45Z",
  "payload": [
    {"pin": 17, "state": "HIGH", "duration": 2},
    {"pin": 18, "state": "HIGH", "duration": 2},
    {"pin": 19, "state": "HIGH", "duration": 2},
    {"pin": 17, "state": "LOW", "duration": 2},
    {"pin": 18, "state": "LOW", "duration": 2},
    {"pin": 19, "state": "LOW", "duration": 2}
  ]
}
```

---

## 6. Fan Speed Control
**Description:** Change a fan's speed over time based on a duty cycle schedule.

```json
{
  "device_id": "esp32_01",
  "action": "pwm_control",
  "timestamp": "2024-12-25T12:30:45Z",
  "payload": {
    "pin": 22,
    "frequency": 1500,
    "schedule": [
      {"duty_cycle": 25, "duration": 10},
      {"duty_cycle": 50, "duration": 10},
      {"duty_cycle": 75, "duration": 10},
      {"duty_cycle": 100, "duration": 10}
    ]
  }
}
```

---

## 7. Multiple Sensor Query
**Description:** Trigger different sensor readings sequentially.

```json
{
  "device_id": "esp32_01",
  "action": "read_sensors",
  "timestamp": "2024-12-25T12:30:45Z",
  "payload": {
    "schedule": [
      {"sensor_type": "temperature", "pin": 36, "timestamp": "2024-12-25T12:31:00Z"},
      {"sensor_type": "humidity", "pin": 35, "timestamp": "2024-12-25T12:32:00Z"},
      {"sensor_type": "light", "pin": 34, "timestamp": "2024-12-25T12:33:00Z"}
    ]
  }
}
```

---

## 8. Delay-Based Action Stop
**Description:** Start a GPIO toggle and automatically stop after 20 seconds.

```json
{
  "device_id": "esp32_01",
  "action": "toggle",
  "timestamp": "2024-12-25T12:30:45Z",
  "payload": {
    "pin": 10,
    "duration": 200,
    "repeat": 100
  }
},
{
  "device_id": "esp32_01",
  "action": "stop_task",
  "timestamp": "2024-12-25T12:30:50Z",
  "payload": {
    "pin": 10
  }
}
```

---

## 9. Controlled Sequential Blinking
**Description:** Blink two LEDs in a chasing pattern.

```json
{
  "device_id": "esp32_01",
  "action": "sequence_toggle",
  "timestamp": "2024-12-25T12:30:45Z",
  "payload": [
    {"pin": 6, "state": "HIGH", "duration": 300},
    {"pin": 6, "state": "LOW", "duration": 300},
    {"pin": 7, "state": "HIGH", "duration": 300},
    {"pin": 7, "state": "LOW", "duration": 300}
  ]
}
```

---

## 10. Notification Blink Upon Error
**Description:** LED blinks red 3 times if an error occurs.

```json
{
  "device_id": "esp32_01",
  "action": "toggle",
  "timestamp": "2024-12-25T12:30:45Z",
  "payload": {
    "pin": 13,
    "repeat": 3,
    "duration": 500,
    "state": "blink_on_error"
  }
}
```

