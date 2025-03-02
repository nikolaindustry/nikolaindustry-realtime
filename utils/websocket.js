const WebSocket = require('ws');

const devices = new Map(); // Store connected devices

function handleConnection(ws, req) {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const deviceId = params.get('id');

    if (!deviceId) {
        ws.close();
        return;
    }

    console.log(`Device ${deviceId} connected`);

    if (!devices.has(deviceId)) {
        devices.set(deviceId, []);
    }
    devices.get(deviceId).push(ws);

    ws.on('message', (message) => {
        try {
            const decodedMessages = JSON.parse(message);
            console.log(`Received message from ${deviceId}:`, decodedMessages);
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        console.log(`Device ${deviceId} disconnected`);
        const connections = devices.get(deviceId) || [];
        const index = connections.indexOf(ws);
        if (index !== -1) connections.splice(index, 1);
        if (connections.length === 0) {
            devices.delete(deviceId);
        }
    });
}

module.exports = { handleConnection, devices };
