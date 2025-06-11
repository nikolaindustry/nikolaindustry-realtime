
# NikolaIndustry Realtime WebSocket Server

This is a lightweight Node.js-based WebSocket server designed to manage real-time, device-to-device communication over the Web. Each device connects with a unique `deviceId` and can send or receive messages based on defined routing rules.

## 🔧 Features

- 📡 **Device Registration**: Devices connect using a URL with a query parameter `id`, e.g., `wss://nikolaindustry-realtime.onrender.com/?id=device-123`.
- 🧠 **Smart Routing**: Messages can be sent to specific devices (`targetId` or `targetIds`) or broadcast to all connections from the sender.
- 💬 **Batch Messaging Support**: Send multiple commands using a single `controlData` array.
- 📃 **Connected Devices Listing**: Send `{ "type": "getConnectedDevices" }` to get a list of all currently connected devices.
- 🛑 **Graceful Disconnect**: Automatically removes devices from memory when they disconnect.

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install ws
```

### 2. Create WebSocket server

```js
const WebSocket = require('ws');
const http = require('http');
const { handleConnection } = require('./websocket-handler'); // This file

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', handleConnection);

server.listen(8080, () => {
  console.log('WebSocket server is running on port 8080');
});
```

### 3. Client Connection

```js
const ws = new WebSocket('wss://nikolaindustry-realtime.onrender.com/?id=device-123'); 
```

## 🧪 Example Messages

### ✅ Single Device Message

```json
{
  "targetId": "device-456",
  "payload": { "command": "TURN_ON" }
}
```

### ✅ Broadcast Message

```json
{
  "type": "broadcast",
  "payload": { "message": "System Maintenance in 5 mins" }
}
```

### ✅ Multiple Targets

```json
{
  "targetIds": ["device-456", "device-789"],
  "payload": { "command": "REBOOT" }
}
```

### ✅ Batch Control Messages

```json
{
  "controlData": [
    {
      "targetId": "device-111",
      "payload": { "command": "OPEN_VALVE" }
    },
    {
      "targetId": "device-222",
      "payload": { "command": "CLOSE_VALVE" }
    }
  ]
}
```

### ✅ Request Connected Devices

```json
{
  "type": "getConnectedDevices"
}
```

### ✅ Response

```json
{
  "type": "connectedDevices",
  "devices": ["device-123", "device-456"]
}
```

## 🛡️ Notes

- Ensure each device has a **unique ID** when connecting.
- The server supports **multiple connections per device ID**.
- Malformed JSON messages are ignored and logged.
- This code assumes **trusted device communication** (add authentication in production).

## 📃 License

MIT License © [Your Name / Company]
