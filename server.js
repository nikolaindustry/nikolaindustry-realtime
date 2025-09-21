const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const { handleConnection, setMqttForwarders, handleAdminConnection } = require('./utils/websocket');
const { setupMQTT, forwardWebSocketToMqtt, broadcastToAll } = require('./utils/mqtt');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware for parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRoutes);

wss.on('connection', (ws, req) => {
    // Check if this is an admin dashboard connection
    if (req.url.startsWith('/admin')) {
        handleAdminConnection(ws);
    } else {
        handleConnection(ws, req);
    }
});

// Setup MQTT
setupMQTT(server);

// Connect WebSocket and MQTT forwarding
setMqttForwarders(forwardWebSocketToMqtt, broadcastToAll);

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`🔌 WebSocket available at ws://localhost:${port}`);
    console.log(`🌐 HTTP API available at http://localhost:${port}/api`);
    console.log(`🦟 MQTT available at mqtt://localhost:${process.env.MQTT_PORT || 1883}`);
});
