# IoT Automation System - Communication Standards

This document provides a detailed reference for implementing a robust IoT automation system. It includes standard terminologies, message formats, error codes, and best practices.

---

## **1. Core Message Terminologies**

| Term         | Description                                                                 |
|--------------|-----------------------------------------------------------------------------|
| `device_id`  | Unique identifier for the target device (e.g., ESP32).                      |
| `action`     | Operation the system needs to perform (e.g., control_gpio, schedule_task).  |
| `timestamp`  | ISO 8601 format time for synchronization or logs.                           |
| `payload`    | Main content/parameters for the action.                                     |
| `status`     | Response status from the server/device (e.g., success, error).             |
| `message`    | Descriptive information about the status or errors.                        |
| `version`    | Protocol or API version used for backward compatibility.                   |

---

## **2. Actions**

| Action Term      | Description                                                       |
|------------------|-------------------------------------------------------------------|
| `control_gpio`   | Control a GPIO pin (e.g., ON/OFF, HIGH/LOW).                      |
| `schedule_task`  | Schedule a task for a future time or duration.                    |
| `blink_gpio`     | Toggle GPIO at a specified frequency.                             |
| `get_sensor_data`| Retrieve data from sensors (e.g., temperature, humidity).         |
| `ack`            | Acknowledge a received command.                                   |
| `error`          | Report an error for a failed operation.                           |
| `relay_message`  | Send a message to another client/device.                          |
| `update_firmware`| Initiate a firmware update for the device.                        |

---

## **3. Payload Parameters**

| Parameter    | Description                                                           |
|--------------|-----------------------------------------------------------------------|
| `pin`        | Target GPIO pin number.                                               |
| `state`      | Current or desired GPIO state (e.g., HIGH, LOW).                      |
| `frequency`  | Frequency for PWM or blinking in Hertz (Hz).                          |
| `duty_cycle` | Percentage of ON-time for PWM signals (0-100).                        |
| `duration`   | Time in seconds for an operation to run.                              |
| `schedule`   | Contains scheduling details (e.g., start_time, duration).             |
| `sensor_type`| Type of sensor to query (e.g., temperature, humidity).                |
| `value`      | Resulting value from a sensor read or operation.                      |

---

## **4. Error Codes**

| Error Code            | Description                                                              |
|-----------------------|--------------------------------------------------------------------------|
| `GPIO_NOT_AVAILABLE`  | Target GPIO pin is already in use or unavailable.                        |
| `INVALID_ACTION`      | Unrecognized action provided in the request.                             |
| `INVALID_PIN`         | Pin number provided is not valid for the device.                         |
| `INVALID_STATE`       | Invalid state for a GPIO operation (e.g., non-HIGH/LOW).                 |
| `DEVICE_NOT_CONNECTED`| Target device is offline or not reachable.                               |
| `ACTION_TIMEOUT`      | Action exceeded the allowed time to complete.                            |
| `PAYLOAD_MISSING`     | Required fields in the payload are not provided.                         |
| `PERMISSION_DENIED`   | User is unauthorized to perform the requested action.                    |
| `SENSOR_ERROR`        | Failed to read data from the requested sensor.                           |
| `FIRMWARE_UPDATE_FAILED`| Firmware update could not be completed.                                |

---

## **5. Response Status**

| Status       | Description                                                        |
|--------------|--------------------------------------------------------------------|
| `success`    | Indicates the operation was successful.                            |
| `failure`    | Indicates the operation failed.                                    |
| `processing` | Indicates the action is still in progress.                         |
| `queued`     | Indicates the action has been queued.                              |

---

## **6. Device-Specific Parameters**

| Parameter         | Description                                                   |
|-------------------|---------------------------------------------------------------|
| `device_type`     | Type of device (e.g., ESP32, RaspberryPi).                    |
| `device_status`   | Operational status (online, offline, error).                  |
| `battery_level`   | Device battery status as a percentage (if applicable).        |
| `firmware_version`| Version of the current firmware.                              |

---

## **7. Authentication and Security**

| Term             | Description                                                   |
|------------------|---------------------------------------------------------------|
| `access_token`   | Token for authenticating clients/devices.                     |
| `user_id`        | Identifier for the user initiating the action.                |
| `session_id`     | Identifier for the current client session.                    |
| `role`           | Role-based permission level (e.g., admin, user).              |

---

## **8. Logging and Monitoring**

| Term         | Description                                                      |
|--------------|------------------------------------------------------------------|
| `event_type` | Type of event being logged (e.g., command_received).             |
| `event_id`   | Unique identifier for tracking a specific event.                 |
| `log_level`  | Severity of the log (e.g., info, warning, error).                |
| `latency`    | Time taken for an operation to complete (in milliseconds).       |

---

## **9. Scheduling Parameters**

| Term       | Description                                                        |
|------------|--------------------------------------------------------------------|
| `start_time`| Start time for scheduled operations (ISO 8601).                    |
| `repeat`    | Repeat frequency for recurring tasks.                              |
| `end_time`  | Optional parameter to define task expiration.                      |

---

## **10. Quality of Service**

| Term       | Description                                                        |
|------------|--------------------------------------------------------------------|
| `priority` | Priority level of the action (high, low).                           |
| `retries`  | Number of times to retry the action on failure.                     |
| `timeout`  | Time in seconds after which an action times out.                    |



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

---
### **8. JSON** 
```json
{
  "CoreMessageTerminologies": {
    "device_id": "Unique identifier for the target device (e.g., ESP32).",
    "action": "Operation the system needs to perform (e.g., control_gpio, schedule_task).",
    "timestamp": "ISO 8601 format time for synchronization or logs.",
    "payload": "Main content/parameters for the action.",
    "status": "Response status from the server/device (e.g., success, error).",
    "message": "Descriptive information about the status or errors.",
    "version": "Protocol or API version used for backward compatibility."
  },
  "Actions": {
    "control_gpio": "Control a GPIO pin (e.g., ON/OFF, HIGH/LOW).",
    "schedule_task": "Schedule a task for a future time or duration.",
    "blink_gpio": "Toggle GPIO at a specified frequency.",
    "get_sensor_data": "Retrieve data from sensors (e.g., temperature, humidity).",
    "ack": "Acknowledge a received command.",
    "error": "Report an error for a failed operation.",
    "relay_message": "Send a message to another client/device.",
    "update_firmware": "Initiate a firmware update for the device."
  },
  "PayloadParameters": {
    "pin": "Target GPIO pin number.",
    "state": "Current or desired GPIO state (e.g., HIGH, LOW).",
    "frequency": "Frequency for PWM or blinking in Hertz (Hz).",
    "duty_cycle": "Percentage of ON-time for PWM signals (0-100).",
    "duration": "Time in seconds for an operation to run.",
    "schedule": "Contains scheduling details (e.g., start_time, duration).",
    "sensor_type": "Type of sensor to query (e.g., temperature, humidity).",
    "value": "Resulting value from a sensor read or operation."
  },
  "ErrorCodes": {
    "GPIO_NOT_AVAILABLE": "Target GPIO pin is already in use or unavailable.",
    "INVALID_ACTION": "Unrecognized action provided in the request.",
    "INVALID_PIN": "Pin number provided is not valid for the device.",
    "INVALID_STATE": "Invalid state for a GPIO operation (e.g., non-HIGH/LOW).",
    "DEVICE_NOT_CONNECTED": "Target device is offline or not reachable.",
    "ACTION_TIMEOUT": "Action exceeded the allowed time to complete.",
    "PAYLOAD_MISSING": "Required fields in the payload are not provided.",
    "PERMISSION_DENIED": "User is unauthorized to perform the requested action.",
    "SENSOR_ERROR": "Failed to read data from the requested sensor.",
    "FIRMWARE_UPDATE_FAILED": "Firmware update could not be completed."
  },
  "ResponseStatus": {
    "success": "Indicates the operation was successful.",
    "failure": "Indicates the operation failed.",
    "processing": "Indicates the action is still in progress.",
    "queued": "Indicates the action has been queued."
  },
  "DeviceSpecificParameters": {
    "device_type": "Type of device (e.g., ESP32, RaspberryPi).",
    "device_status": "Operational status (online, offline, error).",
    "battery_level": "Device battery status as a percentage (if applicable).",
    "firmware_version": "Version of the current firmware."
  },
  "AuthenticationAndSecurity": {
    "access_token": "Token for authenticating clients/devices.",
    "user_id": "Identifier for the user initiating the action.",
    "session_id": "Identifier for the current client session.",
    "role": "Role-based permission level (e.g., admin, user)."
  },
  "LoggingAndMonitoring": {
    "event_type": "Type of event being logged (e.g., command_received).",
    "event_id": "Unique identifier for tracking a specific event.",
    "log_level": "Severity of the log (e.g., info, warning, error).",
    "latency": "Time taken for an operation to complete (in milliseconds)."
  },
  "SchedulingParameters": {
    "start_time": "Start time for scheduled operations (ISO 8601).",
    "repeat": "Repeat frequency for recurring tasks.",
    "end_time": "Optional parameter to define task expiration."
  },
  "QualityOfService": {
    "priority": "Priority level of the action (high, low).",
    "retries": "Number of times to retry the action on failure.",
    "timeout": "Time in seconds after which an action times out."
  }
}


```
---




