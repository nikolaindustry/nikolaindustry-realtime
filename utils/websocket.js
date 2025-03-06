const WebSocket = require('ws');
const redis = require('redis');

const devices = new Map(); // Store connected devices

// Create Redis clients for publishing and subscribing
const pub = redis.createClient({ url: process.env.REDIS_URL });
const sub = redis.createClient({ url: process.env.REDIS_URL });

// Subscribe to Redis messages for forwarding to connected clients
sub.subscribe('ws-messages');

sub.on('message', (channel, message) => {
    const parsedMessage = JSON.parse(message);
    const { targetIds, targetId, payload, from } = parsedMessage;

    if (Array.isArray(targetIds)) {
        targetIds.forEach((id) => {
            if (devices.has(id)) {
                devices.get(id)?.forEach((targetSocket) => {
                    if (targetSocket.readyState === WebSocket.OPEN) {
                        targetSocket.send(JSON.stringify({ from, payload }));
                        console.log(`📨 Redis: Message forwarded from ${from} to ${id}`);
                    }
                });
            }
        });
    } else if (targetId && devices.has(targetId)) {
        devices.get(targetId)?.forEach((targetSocket) => {
            if (targetSocket.readyState === WebSocket.OPEN) {
                targetSocket.send(JSON.stringify({ from, payload }));
                console.log(`📨 Redis: Message forwarded from ${from} to ${targetId}`);
            }
        });
    }
});

async function handleConnection(ws, req) {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const deviceId = params.get('id');

    if (!deviceId) {
        console.error("❌ Missing device ID, closing connection.");
        ws.close();
        return;
    }

    console.log(`✅ Device ${deviceId} connected`);

    if (!devices.has(deviceId)) {
        devices.set(deviceId, []);
    }
    devices.get(deviceId).push(ws);

    // Store device status in Redis
    await pub.set(`device:${deviceId}`, 'online');

    ws.on('message', async (message) => {
        let decodedMessages;

        try {
            if (Buffer.isBuffer(message)) {
                message = message.toString();
            }
            decodedMessages = JSON.parse(message);
        } catch (e) {
            console.error('❌ Error parsing message:', e);
            return;
        }

        console.log("📩 Message received:", JSON.stringify(decodedMessages, null, 2));

        if (decodedMessages.controlData && Array.isArray(decodedMessages.controlData)) {
            console.log(`🔄 Processing batch control messages: ${decodedMessages.controlData.length} items`);

            decodedMessages.controlData.forEach(({ targetId, payload }) => {
                if (targetId) {
                    pub.publish('ws-messages', JSON.stringify({ from: deviceId, targetId, payload }));
                }
            });
            return;
        }

        if (!Array.isArray(decodedMessages)) {
            decodedMessages = [decodedMessages];
        }

        decodedMessages.forEach((decodedMessage) => {
            const { type, targetIds, targetId, payload } = decodedMessage;

            if (type === 'getConnectedDevices') {
                const connectedDevices = Array.from(devices.keys());
                ws.send(JSON.stringify({ type: 'connectedDevices', devices: connectedDevices }));
                console.log("📡 Sent connected devices list");
            } else if (type === 'broadcast') {
                pub.publish('ws-messages', JSON.stringify({ from: deviceId, payload }));
                console.log(`📢 Broadcast message from ${deviceId}`);
            } else if (Array.isArray(targetIds)) {
                pub.publish('ws-messages', JSON.stringify({ from: deviceId, targetIds, payload }));
            } else if (targetId) {
                pub.publish('ws-messages', JSON.stringify({ from: deviceId, targetId, payload }));
            }
        });
    });

    ws.on('close', async () => {
        console.log(`❌ Device ${deviceId} disconnected`);
        const connections = devices.get(deviceId) || [];
        const index = connections.indexOf(ws);
        if (index !== -1) connections.splice(index, 1);
        if (connections.length === 0) {
            devices.delete(deviceId);
            await pub.del(`device:${deviceId}`);
        }
    });
}

module.exports = { handleConnection, devices };
