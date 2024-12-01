const express = require('express');
const http = require('http');
const WebSocket = require('ws');

// Setup Express
const app = express();
const port = 3000;  // HTTP server port

// Create HTTP server and pass it to WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// Store connected devices using their unique IDs
const devices = new Map();

// Route to handle HTTP request before upgrading
app.get('/connect', (req, res) => {
    // Extract device ID from query parameters
    const deviceId = req.query.id;

    if (!deviceId) {
        return res.status(400).send('Device ID is required');
    }

    // Upgrade to WebSocket connection
    server.on('upgrade', (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (ws) => {
            ws.deviceId = deviceId;  // Attach ID to WebSocket instance
            devices.set(deviceId, ws);
            console.log(`Device ${deviceId} connected`);

            ws.on('message', (message) => {
                console.log(`Message from ${deviceId}: ${message}`);

                // Echo back message or handle routing logic here
                ws.send(`Server received: ${message}`);
            });

            ws.on('close', () => {
                devices.delete(deviceId);
                console.log(`Device ${deviceId} disconnected`);
            });
        });
    });

    // Respond to HTTP request before upgrading
    res.status(101).send('Switching protocols');
});

// Start server
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
