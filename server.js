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

        const { type, targetId, payload } = decodedMessage;

        // Handle API to get connected devices
    if (type === 'getConnectedDevices') {
    const connectedDevices = Array.from(devices.entries()).map(([id, data]) => ({
        id,
        ip: data.ip,
        connectedAt: data.connectedAt,
        lastActive: data.lastActive,
        metadata: data.metadata,
    }));

    ws.send(JSON.stringify({ type: 'connectedDevices', devices: connectedDevices }));
    console.log(`Sent detailed connected devices info to ${deviceId}`);
}
 else if (targetId && devices.has(targetId)) {
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

// Admin endpoint to send messages to a specific device
app.get('/send', (req, res) => {
    const { deviceid, message } = req.query;

    if (devices.has(deviceid)) {
        const targetSocket = devices.get(deviceid);
        if (targetSocket.readyState === WebSocket.OPEN) {
            targetSocket.send(JSON.stringify({ from: "admin", message }));
            res.send(`Message sent to device ${deviceid}`);
        } else {
            res.status(500).send(`Device ${deviceid} is not connected`);
        }
    } else {
        res.status(404).send(`Device ${deviceid} not found`);
    }
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
