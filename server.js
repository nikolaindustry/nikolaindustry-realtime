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

wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const deviceId = params.get('id');

    if (!deviceId) {
        ws.close();
        return;
    }

    console.log(`Device ${deviceId} connected`);
    
 ws.on('message', (message) => {
    let decodedMessage;

    try {
        // Convert buffer to string if necessary
        if (Buffer.isBuffer(message)) {
            message = message.toString();
        }

        // Parse JSON message
        decodedMessage = JSON.parse(message);
        
        // Handle nested JSON if needed
        if (typeof decodedMessage === 'object' && decodedMessage.type === 'Buffer' && decodedMessage.data) {
            decodedMessage = Buffer.from(decodedMessage.data).toString();
        }
    } catch (e) {
        console.error('Error parsing message:', e);
        return;
    }

    console.log(`Message from ${deviceId}:`, decodedMessage);

    // Broadcast message to all connected clients
    const broadcastData = JSON.stringify({ deviceId, message: "I got your message " });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(broadcastData);
        }
    });
});



    ws.on('close', () => {
        console.log(`Device ${deviceId} disconnected`);
    });
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
