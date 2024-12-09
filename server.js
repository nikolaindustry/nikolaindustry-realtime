const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

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
    devices.set(deviceId, ws); // Store the connection

    ws.on('message', (message) => {
        let decodedMessage;

        try {
            // Convert buffer to string if necessary
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

        // Handle API to get connected devices
        if (type === 'getConnectedDevices') {
            const connectedDevices = Array.from(devices.keys());
            ws.send(JSON.stringify({ type: 'connectedDevices', devices: connectedDevices }));
            console.log(`Sent connected devices list to ${deviceId}`);
        } else if (Array.isArray(targetIds)) {
            // Handle multiple target IDs
            targetIds.forEach((id) => {
                if (devices.has(id)) {
                    const targetSocket = devices.get(id);
                    if (targetSocket.readyState === WebSocket.OPEN) {
                        targetSocket.send(JSON.stringify({ from: deviceId, payload }));
                        console.log(`Message forwarded from ${deviceId} to ${id}`);
                    } else {
                        console.error(`Target device ${id} is not connected.`);
                    }
                } else {
                    console.error(`Target device ${id} is not found.`);
                }
            });
        } else if (targetId && devices.has(targetId)) {
            const targetSocket = devices.get(targetId);
            if (targetSocket.readyState === WebSocket.OPEN) {
                targetSocket.send(JSON.stringify({ from: deviceId, payload }));
                console.log(`Message forwarded from ${deviceId} to ${targetId}`);
            } else {
                console.error(`Target device ${targetId} is not connected.`);
            }
        } else {
            // Respond to the same device if no targetId is specified
            const response = JSON.stringify({ message: "I got your message" });
            ws.send(response);
        }
    });

    ws.on('close', () => {
        console.log(`Device ${deviceId} disconnected`);
        devices.delete(deviceId); // Remove the connection
    });
});

// Admin endpoint to send messages to multiple devices
app.get('/send', (req, res) => {
    const { deviceIds, message } = req.query;

    if (!deviceIds) {
        res.status(400).send('Device IDs are required');
        return;
    }

    const ids = deviceIds.split(',');
    ids.forEach((id) => {
        if (devices.has(id)) {
            const targetSocket = devices.get(id);
            if (targetSocket.readyState === WebSocket.OPEN) {
                targetSocket.send(JSON.stringify({ from: "admin", message }));
                console.log(`Message sent to device ${id}`);
            } else {
                console.error(`Device ${id} is not connected.`);
            }
        } else {
            console.error(`Device ${id} not found.`);
        }
    });

    res.send(`Message sent to devices: ${ids.join(', ')}`);
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
