const WebSocket = require('ws');

const devices = new Map(); // Store connected devices

function handleConnection(ws, req) {
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

    ws.on('message', (message) => {
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
                if (targetId && devices.has(targetId)) {
                    devices.get(targetId)?.forEach((targetSocket) => {
                        if (targetSocket.readyState === WebSocket.OPEN) {
                            targetSocket.send(JSON.stringify({ from: "server", payload }));
                            console.log(`🚀 Sent command to ${targetId}:`, JSON.stringify(payload));
                        }
                    });
                } else {
                    console.error(`⚠️ Target device ${targetId} not found.`);
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
                devices.get(deviceId)?.forEach((conn) => {
                    if (conn.readyState === WebSocket.OPEN) {
                        conn.send(JSON.stringify({ from: deviceId, payload }));
                        console.log(`📢 Broadcast message from ${deviceId}`);
                    }
                });
            } else if (Array.isArray(targetIds)) {
                targetIds.forEach((id) => {
                    if (devices.has(id)) {
                        devices.get(id)?.forEach((targetSocket) => {
                            if (targetSocket.readyState === WebSocket.OPEN) {
                                targetSocket.send(JSON.stringify({ from: deviceId, payload }));
                                console.log(`📨 Message forwarded from ${deviceId} to ${id}`);
                            }
                        });
                    } else {
                        console.error(`⚠️ Target device ${id} is not found.`);
                    }
                });
            } else if (targetId && devices.has(targetId)) {
                devices.get(targetId)?.forEach((targetSocket) => {
                    if (targetSocket.readyState === WebSocket.OPEN) {
                        targetSocket.send(JSON.stringify({ from: deviceId, payload }));
                        console.log(`📨 Message forwarded from ${deviceId} to ${targetId}`);
                    }
                });
            } else {
                // const response = JSON.stringify({ message: "✅ Message received but no action taken" });
                // ws.send(response);
            }
        });
    });

    ws.on('close', () => {
        console.log(`❌ Device ${deviceId} disconnected`);
        const connections = devices.get(deviceId) || [];
        const index = connections.indexOf(ws);
        if (index !== -1) connections.splice(index, 1);
        if (connections.length === 0) {
            devices.delete(deviceId);
        }
    });
}

module.exports = { handleConnection, devices };
