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

    // Ensure `devices` Map supports multiple connections per ID
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

        const { type, targets } = decodedMessage;

        if (type === 'getConnectedDevices') {
            // Return all connected device IDs
            const connectedDevices = Array.from(devices.keys());
            ws.send(JSON.stringify({ type: 'connectedDevices', devices: connectedDevices }));
            console.log(`Sent connected devices list to ${deviceId}`);
        } else if (type === 'multiMessage') {
            if (Array.isArray(targets)) {
                targets.forEach(({ id, payload }) => {
                    if (devices.has(id)) {
                        devices.get(id).forEach((targetSocket) => {
                            if (targetSocket.readyState === WebSocket.OPEN) {
                                targetSocket.send(
                                    JSON.stringify({ from: deviceId, ...payload })
                                );
                                console.log(`Message sent from ${deviceId} to ${id}`);
                            }
                        });
                    } else {
                        console.error(`Target device ${id} not found.`);
                    }
                });
            } else {
                console.error('Invalid `targets` format. Must be an array.');
            }
        } else {
            console.error('Unsupported message type:', type);
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
            //const response = await axios.get('https://nikolaindustry.wixstudio.com/librarymanagment/_functions/getassignedbooks?src=222031154'); // Replace with your API endpoint
            //console.log('API Response:', response.data);

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
