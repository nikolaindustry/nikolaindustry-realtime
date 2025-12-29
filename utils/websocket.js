const WebSocket = require('ws');

const devices = new Map(); // Store connected devices
const adminConnections = new Set(); // Store admin dashboard connections

// Import MQTT forwarding functions (will be available after mqtt.js is loaded)
let forwardWebSocketToMqtt = null;
let broadcastToAllProtocols = null;

// Heartbeat configuration
const HEARTBEAT_INTERVAL = 30000; // Ping every 30 seconds
const CLIENT_TIMEOUT = 35000; // Consider dead if no pong in 35 seconds

// Set MQTT forwarding functions (called from server.js after mqtt is initialized)
function setMqttForwarders(forwardFn, broadcastFn) {
    forwardWebSocketToMqtt = forwardFn;
    broadcastToAllProtocols = broadcastFn;
}

// Handle admin dashboard connections
function handleAdminConnection(ws) {
    adminConnections.add(ws);
    ws.isAlive = true;
    
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    ws.on('close', () => {
        adminConnections.delete(ws);
    });
    
    ws.on('error', () => {
        adminConnections.delete(ws);
    });
}

// Function to broadcast device status updates to admin dashboards
function broadcastDeviceUpdates(updateData) {
    const updateMessage = JSON.stringify({
        type: 'deviceUpdate',
        data: updateData
    });
    
    adminConnections.forEach((adminWs) => {
        if (adminWs.readyState === WebSocket.OPEN) {
            adminWs.send(updateMessage);
        }
    });
}

// Cleanup helper function
function cleanupConnection(ws, deviceId) {
    if (!deviceId) return;
    
    const connections = devices.get(deviceId) || [];
    const index = connections.indexOf(ws);
    if (index !== -1) connections.splice(index, 1);
    if (connections.length === 0) {
        devices.delete(deviceId);
    }
    
    broadcastDeviceUpdates({
        event: 'deviceDisconnected',
        deviceId: deviceId,
        timestamp: new Date().toISOString()
    });
}

function handleConnection(ws, req) {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const deviceId = params.get('id');

    if (!deviceId) {
        console.error("❌ Missing device ID, closing connection.");
        ws.close();
        return;
    }

    console.log(`✅ Device ${deviceId} connected`);

    // Mark connection as alive and store deviceId for heartbeat cleanup
    ws.isAlive = true;
    ws.deviceId = deviceId;

    // Handle pong responses from client
    ws.on('pong', () => {
        ws.isAlive = true;
        // Uncomment for debug: console.log(`📡 Pong received from ${deviceId}`);
    });

    if (!devices.has(deviceId)) {
        devices.set(deviceId, []);
    }
    devices.get(deviceId).push(ws);
    
    // Notify admin dashboards of new connection
    broadcastDeviceUpdates({
        event: 'deviceConnected',
        deviceId: deviceId,
        timestamp: new Date().toISOString()
    });

    ws.on('message', (message) => {
        // Reset alive status on any message received
        ws.isAlive = true;
        
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
                } else if (targetId && forwardWebSocketToMqtt) {
                    // Try to forward to MQTT device if not found in WebSocket
                    const forwarded = forwardWebSocketToMqtt(deviceId, targetId, payload);
                    if (!forwarded) {
                        console.error(`⚠️ Target device ${targetId} not found in WebSocket or MQTT.`);
                    }
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
                if (broadcastToAllProtocols) {
                    // Use the unified broadcast function that handles both WebSocket and MQTT
                    broadcastToAllProtocols(payload, deviceId);
                } else {
                    // Fallback to WebSocket only broadcast
                    devices.get(deviceId)?.forEach((conn) => {
                        if (conn.readyState === WebSocket.OPEN) {
                            conn.send(JSON.stringify({ from: deviceId, payload }));
                            console.log(`📢 Broadcast message from ${deviceId}`);
                        }
                    });
                }
            } else if (Array.isArray(targetIds)) {
                targetIds.forEach((id) => {
                    if (devices.has(id)) {
                        devices.get(id)?.forEach((targetSocket) => {
                            if (targetSocket.readyState === WebSocket.OPEN) {
                                targetSocket.send(JSON.stringify({ from: deviceId, payload }));
                                console.log(`📨 Message forwarded from ${deviceId} to ${id}`);
                            }
                        });
                    } else if (forwardWebSocketToMqtt) {
                        // Try to forward to MQTT device if not found in WebSocket
                        const forwarded = forwardWebSocketToMqtt(deviceId, id, payload);
                        if (!forwarded) {
                            console.error(`⚠️ Target device ${id} is not found in WebSocket or MQTT.`);
                        }
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
            } else if (targetId && forwardWebSocketToMqtt) {
                // Try to forward to MQTT device if not found in WebSocket
                const forwarded = forwardWebSocketToMqtt(deviceId, targetId, payload);
                if (!forwarded) {
                    console.error(`⚠️ Target device ${targetId} is not found in WebSocket or MQTT.`);
                }
            } else {
                // const response = JSON.stringify({ message: "✅ Message received but no action taken" });
                // ws.send(response);
            }
        });
    });

    ws.on('close', () => {
        console.log(`❌ Device ${deviceId} disconnected`);
        cleanupConnection(ws, deviceId);
    });

    ws.on('error', (err) => {
        console.error(`❌ WebSocket error for ${deviceId}:`, err.message);
        cleanupConnection(ws, deviceId);
    });
}

// Heartbeat function - call this with your WebSocket server instance
// Usage: startHeartbeat(wss) after creating WebSocket.Server
function startHeartbeat(wss) {
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                console.log(`💀 Terminating zombie connection: ${ws.deviceId || 'unknown'}`);
                cleanupConnection(ws, ws.deviceId);
                return ws.terminate();
            }

            ws.isAlive = false;
            ws.ping(); // Send ping, expect pong response
        });
    }, HEARTBEAT_INTERVAL);

    // Clean up interval when server closes
    wss.on('close', () => {
        clearInterval(interval);
    });

    console.log(`💓 Heartbeat started (interval: ${HEARTBEAT_INTERVAL}ms)`);
}

// Get connected device count
function getConnectedDeviceCount() {
    return devices.size;
}

// Get all connected device IDs
function getConnectedDeviceIds() {
    return Array.from(devices.keys());
}

module.exports = { 
    handleConnection, 
    devices, 
    setMqttForwarders,
    handleAdminConnection,
    broadcastDeviceUpdates,
    startHeartbeat,
    getConnectedDeviceCount,
    getConnectedDeviceIds
};
