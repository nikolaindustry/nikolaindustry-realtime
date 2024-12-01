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

        // Example response to the same device
        const response = JSON.stringify({ message: "I got your message" });
        ws.send(response);
    });

    ws.on('close', () => {
        console.log(`Device ${deviceId} disconnected`);
        devices.delete(deviceId); // Remove the connection
    });
});

// Admin endpoint to send messages to a specific device
app.get('/send', (req, res) => {
    const { targetId, message } = req.query;

    if (devices.has(targetId)) {
        const targetSocket = devices.get(targetId);
        if (targetSocket.readyState === WebSocket.OPEN) {
            targetSocket.send(JSON.stringify({ from: "admin", message }));
            res.send(`Message sent to device ${targetId}`);
        } else {
            res.status(500).send(`Device ${targetId} is not connected`);
        }
    } else {
        res.status(404).send(`Device ${targetId} not found`);
    }
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
