const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const axios = require('axios');


const app = express();
const port = process.env.PORT || 3000;

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Store connected devices in a Map
const devices = new Map();

wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const deviceId = params.get('id');

    if (!deviceId) {
        ws.close();
        return;
    }

    console.log(`Device ${deviceId} connected`);

    // Ensure the `devices` map supports multiple connections per ID
    if (!devices.has(deviceId)) {
        devices.set(deviceId, []);
    }

    devices.get(deviceId).push(ws);

    ws.on('message', (message) => {
        let decodedMessage;

        try {
            if (Buffer.isBuffer(message)) {
                message = message.toString();
            }
            decodedMessage = JSON.parse(message);
        } catch (e) {
            console.error('Error parsing message:', e);
            return;
        }

        console.log(`Message from ${deviceId}:`, decodedMessage);

        const { type, targetIds, targetId, payload } = decodedMessage;

        if (type === 'getConnectedDevices') {
            const connectedDevices = Array.from(devices.keys());
            ws.send(JSON.stringify({ type: 'connectedDevices', devices: connectedDevices }));
            console.log(`Sent connected devices list to ${deviceId}`);
        } else if (type === 'broadcast') {
            const connections = devices.get(deviceId);
            connections.forEach((conn) => {
                if (conn.readyState === WebSocket.OPEN) {
                    conn.send(JSON.stringify({ from: deviceId, payload }));
                    console.log(`Broadcast message from ${deviceId}`);
                }
            });
        } else if (Array.isArray(targetIds)) {
            targetIds.forEach((id) => {
                if (devices.has(id)) {
                    const targets = devices.get(id);
                    targets.forEach((targetSocket) => {
                        if (targetSocket.readyState === WebSocket.OPEN) {
                            targetSocket.send(JSON.stringify({ from: deviceId, payload }));
                            console.log(`Message forwarded from ${deviceId} to ${id}`);
                        }
                    });
                } else {
                    console.error(`Target device ${id} is not found.`);
                }
            });
        } else if (targetId && devices.has(targetId)) {
            const targets = devices.get(targetId);
            targets.forEach((targetSocket) => {
                if (targetSocket.readyState === WebSocket.OPEN) {
                    targetSocket.send(JSON.stringify({ from: deviceId, payload }));
                    console.log(`Message forwarded from ${deviceId} to ${targetId}`);
                }
            });
        } else {
            const response = JSON.stringify({ message: "I got your message" });
            ws.send(response);
        }
    });

    ws.on('close', () => {
        console.log(`Device ${deviceId} disconnected`);

        const connections = devices.get(deviceId) || [];
        const index = connections.indexOf(ws);
        if (index !== -1) connections.splice(index, 1);

        if (connections.length === 0) {
            devices.delete(deviceId);
        } else {
            devices.set(deviceId, connections);
        }
    });
});

// Repeated API Call Function
function callApiRepeatedly() {
    setInterval(async () => {
        try {
            const response = await axios.get('https://nikolaindustry.wixstudio.com/librarymanagment/_functions/getassignedbooks?src=222031154'); // Replace with your API endpoint
            console.log('API Response:', response.data);

            // Example: Broadcast to all connected devices
            // devices.forEach((connections, deviceId) => {
            //     connections.forEach((conn) => {
            //         if (conn.readyState === WebSocket.OPEN) {
            //             conn.send(JSON.stringify({ type: 'apiUpdate', data: response.data }));
            //             console.log(`API data sent to device ${deviceId}`);
            //         }
            //     });
            // });
        } catch (error) {
            console.error('Error calling API:', error.message);
        }
    }, 3600000); 
}

// Start the repeated API calls
callApiRepeatedly();

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
