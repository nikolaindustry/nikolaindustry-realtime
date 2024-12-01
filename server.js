const express = require('express');
const http = require('http');
const WebSocket = require('ws');

// Setup Express
const app = express();
const port = process.env.PORT || 3000;  // Use Render's assigned port or default to 3000

// Create HTTP server and WebSocket instance
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected devices with unique IDs
const devices = new Map();

// Handle HTTP connection before upgrade
app.get('/connect', (req, res) => {
    res.send('WebSocket endpoint available'); // Basic endpoint message
});

// Handle WebSocket connection upgrades
wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const deviceId = params.get('id');

    if (!deviceId) {
        ws.close();  // Close connection if no ID is provided
        return;
    }

    devices.set(deviceId, ws);
    console.log(`Device ${deviceId} connected`);

    ws.on('message', (message) => {
        console.log(`Message from ${deviceId}: ${message}`);
        ws.send(`Server received: ${message}`);
    });

    ws.on('close', () => {
        devices.delete(deviceId);
        console.log(`Device ${deviceId} disconnected`);
    });
});

// Start server
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
