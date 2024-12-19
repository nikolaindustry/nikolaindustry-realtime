# IoT Automation System - Communication Standards

This document provides a detailed reference for implementing a robust IoT automation system. It includes standard terminologies, message formats, error codes, and best practices.

---

## **1. Core Message Terminologies**

### **1.1. `device_id`**
- **Use**: Uniquely identifies the target device.
- **JSON Example**:
  ```json
  {
    "device_id": "esp32_001"
  }
  ```
- **Purpose**: Ensures messages are routed and actions executed on the correct device.

### **1.2. `action`**
- **Use**: Specifies the operation requested (e.g., controlling a GPIO, fetching data).
- **JSON Example**:
  ```json
  {
    "action": "control_gpio"
  }
  ```
- **Purpose**: Differentiates between task types.

### **1.3. `timestamp`**
- **Use**: Tracks the timing of messages for synchronization and logging.
- **JSON Example**:
  ```json
  {
    "timestamp": "2024-12-19T12:00:00Z"
  }
  ```
- **Purpose**: Useful for audits, scheduling, and debugging.

### **1.4. `payload`**
- **Use**: Contains action-specific data (e.g., GPIO details, schedules, or sensor parameters).
- **JSON Example**:
  ```json
  {
    "payload": {
      "pin": 5,
      "state": "HIGH"
    }
  }
  ```
- **Purpose**: Adds flexibility for various action parameters.

---

## **2. Supported Actions**

### **2.1. `control_gpio`**
- **Use**: Controls the state of a GPIO pin.
- **JSON Example**:
  ```json
  {
    "action": "control_gpio",
    "payload": {
      "pin": 5,
      "state": "HIGH"
    }
  }
  ```

### **2.2. `schedule_task`**
- **Use**: Schedules a future action.
- **JSON Example**:
  ```json
  {
    "action": "schedule_task",
    "payload": {
      "start_time": "2024-12-19T13:00:00Z",
      "pin": 5,
      "state": "HIGH",
      "duration": 600
    }
  }
  ```

### **2.3. `get_sensor_data`**
- **Use**: Requests sensor readings.
- **JSON Example**:
  ```json
  {
    "action": "get_sensor_data",
    "payload": {
      "sensor_type": "temperature"
    }
  }
  ```

### **2.4. `ack`**
- **Use**: Acknowledges receipt of a message.
- **JSON Example**:
  ```json
  {
    "action": "ack",
    "timestamp": "2024-12-19T12:05:00Z",
    "device_id": "esp32_001"
  }
  ```

---

## **3. Payload Parameters**

### **3.1. `pin`**
- **Use**: Specifies the GPIO pin.
- **JSON Example**:
  ```json
  {
    "pin": 5
  }
  ```

### **3.2. `state`**
- **Use**: Defines the desired GPIO state (e.g., `HIGH` or `LOW`).
- **JSON Example**:
  ```json
  {
    "state": "HIGH"
  }
  ```

### **3.3. `duration`**
- **Use**: Specifies action duration in seconds.
- **JSON Example**:
  ```json
  {
    "duration": 30
  }
  ```

### **3.4. `sensor_type`**
- **Use**: Identifies the target sensor type.
- **JSON Example**:
  ```json
  {
    "sensor_type": "temperature"
  }
  ```

---

## **4. Error Codes**

### **4.1. `INVALID_PIN`**
- **Use**: Indicates an invalid GPIO pin.
- **JSON Example**:
  ```json
  {
    "status": "failure",
    "error_code": "INVALID_PIN",
    "message": "Pin 50 does not exist"
  }
  ```

### **4.2. `GPIO_NOT_AVAILABLE`**
- **Use**: Indicates the requested pin is in use.
- **JSON Example**:
  ```json
  {
    "status": "failure",
    "error_code": "GPIO_NOT_AVAILABLE",
    "message": "Pin 5 is currently locked for another process"
  }
  ```

### **4.3. `INVALID_ACTION`**
- **Use**: Indicates an unsupported action was requested.
- **JSON Example**:
  ```json
  {
    "status": "failure",
    "error_code": "INVALID_ACTION",
    "message": "Action 'light_blink' is not supported"
  }
  ```

---

## **5. Logging and Monitoring**

### **5.1. `event_type`**
- **Use**: Logs an event occurrence.
- **JSON Example**:
  ```json
  {
    "event_type": "command_received",
    "timestamp": "2024-12-19T12:10:00Z",
    "device_id": "esp32_001",
    "action": "control_gpio"
  }
  ```

### **5.2. `log_level`**
- **Use**: Indicates log severity (e.g., `info`, `warning`, `error`).
- **JSON Example**:
  ```json
  {
    "log_level": "error",
    "message": "Failed to execute GPIO action"
  }
  ```

---

## **6. Response Examples**

### **6.1. Success Response**
- **JSON Example**:
  ```json
  {
    "device_id": "esp32_001",
    "status": "success",
    "timestamp": "2024-12-19T12:20:00Z"
  }
  ```

### **6.2. Failure Response**
- **JSON Example**:
  ```json
  {
    "device_id": "esp32_001",
    "status": "failure",
    "error_code": "INVALID_ACTION",
    "message": "The requested action is not valid"
  }
  ```

---

## **7. Best Practices**
1. Ensure `device_id` is unique across all devices.
2. Validate all inputs (e.g., pin numbers, action types).
3. Use timestamps to maintain synchronization.
4. Log events with proper `log_level` for effective debugging.
5. Clearly document all supported `actions` and `error_code` types.
6. Modularize actions to add new commands easily.

