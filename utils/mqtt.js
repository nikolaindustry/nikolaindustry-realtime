const aedes = require('aedes')();
const WebSocket = require('ws');

// Import the devices map from websocket handler
const { devices: wsDevices } = require('./websocket');

// MQTT devices storage (similar to WebSocket devices)
const mqttDevices = new Map();

// MQTT topics storage
const mqttTopics = new Map(); // topic -> { subscribers: Set(), lastMessage: timestamp, messageCount: number }

// Combined devices function to get all devices (WebSocket + MQTT)
function getAllDevices() {
    const allDevices = new Map();
    
    // Add WebSocket devices
    wsDevices.forEach((connections, deviceId) => {
        allDevices.set(deviceId, {
            type: 'websocket',
            connections: connections.length,
            activeConnections: connections.filter(ws => ws.readyState === WebSocket.OPEN).length
        });
    });
    
    // Add MQTT devices
    mqttDevices.forEach((client, deviceId) => {
        if (allDevices.has(deviceId)) {
            // Device has both WebSocket and MQTT connections
            allDevices.get(deviceId).mqttClient = client;
            allDevices.get(deviceId).type = 'hybrid';
        } else {
            allDevices.set(deviceId, {
                type: 'mqtt',
                mqttClient: client,
                connections: 1,
                activeConnections: 1
            });
        }
    });
    
    return allDevices;
}

// Send message to device (WebSocket or MQTT)
function sendToDevice(deviceId, payload, source = 'api') {
    const results = { sent: false, connections: 0, protocols: [] };
    
    // Try WebSocket first
    if (wsDevices.has(deviceId)) {
        const wsConnections = wsDevices.get(deviceId);
        wsConnections.forEach((socket) => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ from: source, payload }));
                results.connections++;
                results.sent = true;
                if (!results.protocols.includes('websocket')) {
                    results.protocols.push('websocket');
                }
            }
        });
    }
    
    // Try MQTT
    if (mqttDevices.has(deviceId)) {
        const mqttClient = mqttDevices.get(deviceId);
        const topic = `device/${deviceId}/commands`;
        const message = JSON.stringify({ from: source, payload });
        
        // Publish to device's command topic
        aedes.publish({
            topic,
            payload: Buffer.from(message),
            qos: 1,
            retain: false
        });
        
        results.connections++;
        results.sent = true;
        if (!results.protocols.includes('mqtt')) {
            results.protocols.push('mqtt');
        }
    }
    
    return results;
}

// Broadcast to all devices (WebSocket + MQTT)
function broadcastToAll(payload, source = 'api_broadcast') {
    let totalSent = 0;
    const deviceResults = [];
    
    const allDevices = getAllDevices();
    
    allDevices.forEach((deviceInfo, deviceId) => {
        const result = sendToDevice(deviceId, payload, source);
        if (result.sent) {
            totalSent += result.connections;
            deviceResults.push({
                deviceId,
                connections: result.connections,
                protocols: result.protocols,
                type: deviceInfo.type
            });
        }
    });
    
    return { totalSent, deviceResults };
}

// Forward MQTT message to WebSocket devices
function forwardMqttToWebSocket(fromDeviceId, targetId, payload) {
    console.log(`🔄 Forwarding MQTT message from ${fromDeviceId} to WebSocket device ${targetId}`);
    
    if (wsDevices.has(targetId)) {
        const wsConnections = wsDevices.get(targetId);
        wsConnections.forEach((socket) => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ 
                    from: fromDeviceId, 
                    payload,
                    via: 'mqtt-to-websocket'
                }));
                console.log(`📨 MQTT->WebSocket: Message forwarded from ${fromDeviceId} to ${targetId}`);
            }
        });
        return true;
    }
    return false;
}

// Forward WebSocket message to MQTT devices
function forwardWebSocketToMqtt(fromDeviceId, targetId, payload) {
    console.log(`🔄 Forwarding WebSocket message from ${fromDeviceId} to MQTT device ${targetId}`);
    
    if (mqttDevices.has(targetId)) {
        const topic = `device/${targetId}/commands`;
        const message = JSON.stringify({ 
            from: fromDeviceId, 
            payload,
            via: 'websocket-to-mqtt'
        });
        
        aedes.publish({
            topic,
            payload: Buffer.from(message),
            qos: 1,
            retain: false
        });
        
        console.log(`📨 WebSocket->MQTT: Message forwarded from ${fromDeviceId} to ${targetId}`);
        return true;
    }
    return false;
}

// Get MQTT topic information
function getMqttTopics() {
    const topics = [];
    
    mqttTopics.forEach((info, topic) => {
        topics.push({
            topic: topic,
            subscriberCount: info.subscribers.size,
            lastMessage: info.lastMessage || null,
            messageCount: info.messageCount || 0
        });
    });
    
    // Sort by subscriber count (descending) then by topic name
    topics.sort((a, b) => {
        if (b.subscriberCount !== a.subscriberCount) {
            return b.subscriberCount - a.subscriberCount;
        }
        return a.topic.localeCompare(b.topic);
    });
    
    return topics;
}

// MQTT Event Handlers
aedes.on('client', (client) => {
    console.log(`🔗 MQTT Client ${client.id} connected`);
    
    // Register all connected clients as MQTT devices
    // This ensures that even clients that don't subscribe to command topics are tracked
    mqttDevices.set(client.id, client);
    console.log(`✅ MQTT Device ${client.id} registered (connected)`);
});

aedes.on('clientDisconnect', (client) => {
    console.log(`❌ MQTT Client ${client.id} disconnected`);
    
    // Remove from devices map
    mqttDevices.delete(client.id);
    
    // Remove client from all topic subscriptions
    mqttTopics.forEach((info, topic) => {
        if (info.subscribers.has(client.id)) {
            info.subscribers.delete(client.id);
            // Clean up empty topics
            if (info.subscribers.size === 0) {
                mqttTopics.delete(topic);
            }
        }
    });
});

aedes.on('subscribe', (subscriptions, client) => {
    console.log(`📡 MQTT Client ${client.id} subscribed to:`, subscriptions.map(s => s.topic));
    
    // Register device when it subscribes to its command topic
    const commandSubscription = subscriptions.find(s => s.topic.startsWith(`device/${client.id}/commands`));
    if (commandSubscription) {
        mqttDevices.set(client.id, client);
        console.log(`✅ MQTT Device ${client.id} registered (subscribed to command topic)`);
    }
    
    // Track topic subscriptions
    subscriptions.forEach(sub => {
        const topic = sub.topic;
        if (!mqttTopics.has(topic)) {
            mqttTopics.set(topic, {
                subscribers: new Set(),
                messageCount: 0
            });
        }
        mqttTopics.get(topic).subscribers.add(client.id);
    });
});

aedes.on('unsubscribe', (unsubscriptions, client) => {
    console.log(`🔇 MQTT Client ${client.id} unsubscribed from:`, unsubscriptions);
    
    // Remove client from topic subscriptions
    unsubscriptions.forEach(topic => {
        if (mqttTopics.has(topic)) {
            const info = mqttTopics.get(topic);
            info.subscribers.delete(client.id);
            // Clean up empty topics
            if (info.subscribers.size === 0) {
                mqttTopics.delete(topic);
            }
        }
    });
});

aedes.on('publish', (packet, client) => {
    if (!client) return; // System message
    
    const topic = packet.topic;
    const payload = packet.payload.toString();
    
    // Skip logging for system topics
    if (topic.startsWith('$SYS/')) return;
    
    console.log(`📩 MQTT Message from ${client.id} on topic ${topic}:`, payload);
    
    // Update topic information
    if (!mqttTopics.has(topic)) {
        mqttTopics.set(topic, {
            subscribers: new Set(),
            messageCount: 0
        });
    }
    
    const topicInfo = mqttTopics.get(topic);
    topicInfo.lastMessage = new Date().toISOString();
    topicInfo.messageCount = (topicInfo.messageCount || 0) + 1;
    
    try {
        // Handle different topic patterns
        if (topic.startsWith('device/') && topic.endsWith('/status')) {
            // Device status updates
            console.log(`📊 Device ${client.id} status:`, payload);
            
        } else if (topic.startsWith('device/') && topic.endsWith('/data')) {
            // Device data/sensor readings
            console.log(`📈 Device ${client.id} data:`, payload);
            
        } else if (topic.startsWith('device/') && topic.includes('/send/')) {
            // Device-to-device communication via MQTT
            // Topic format: device/{fromDeviceId}/send/{targetDeviceId}
            const pathParts = topic.split('/');
            const fromDeviceId = pathParts[1];
            const targetDeviceId = pathParts[3];
            
            if (targetDeviceId && fromDeviceId === client.id) {
                const messageData = JSON.parse(payload);
                
                // Try to forward to WebSocket device first
                const wsForwarded = forwardWebSocketToMqtt(fromDeviceId, targetDeviceId, messageData);
                
                // If not found in WebSocket, try MQTT
                if (!wsForwarded) {
                    const mqttForwarded = sendToDevice(targetDeviceId, messageData, fromDeviceId);
                    if (!mqttForwarded.sent) {
                        console.error(`⚠️ Target device ${targetDeviceId} not found in either WebSocket or MQTT`);
                    }
                }
            }
            
        } else if (topic.startsWith('device/') && topic.includes('/broadcast')) {
            // Broadcast from MQTT device to all devices (WebSocket + MQTT)
            const fromDeviceId = client.id;
            const messageData = JSON.parse(payload);
            
            console.log(`📢 MQTT Broadcast from ${fromDeviceId}`);
            broadcastToAll(messageData, fromDeviceId);
            
        } else if (topic.startsWith('device/') && topic.includes('/batch')) {
            // Batch commands from MQTT device
            const fromDeviceId = client.id;
            const batchData = JSON.parse(payload);
            
            if (batchData.controlData && Array.isArray(batchData.controlData)) {
                console.log(`🔄 MQTT Batch from ${fromDeviceId}: ${batchData.controlData.length} items`);
                
                batchData.controlData.forEach(({ targetId, payload: itemPayload }) => {
                    if (targetId) {
                        sendToDevice(targetId, itemPayload, fromDeviceId);
                    }
                });
            }
        }
    } catch (e) {
        console.error('❌ Error processing MQTT message:', e);
    }
});

// Setup function to be called from server.js
function setupMQTT(httpServer) {
    const mqttServer = require('net').createServer(aedes.handle);
    
    // MQTT over TCP (port 1883)
    const mqttPort = process.env.MQTT_PORT || 1883;
    mqttServer.listen(mqttPort, () => {
        console.log(`🦟 MQTT Server running on port ${mqttPort}`);
    });
    
    // MQTT over WebSocket (optional - for web-based MQTT clients)
    const ws = require('ws');
    const wsServer = new ws.Server({
        port: process.env.MQTT_WS_PORT || 8883,
    });
    
    wsServer.on('connection', (ws) => {
        const stream = ws.createStream();
        aedes.handle(stream);
    });
    
    console.log(`🦟 MQTT over WebSocket running on port ${process.env.MQTT_WS_PORT || 8883}`);
    
    return { aedes, mqttServer, wsServer };
}

module.exports = {
    setupMQTT,
    getAllDevices,
    sendToDevice,
    broadcastToAll,
    forwardMqttToWebSocket,
    forwardWebSocketToMqtt,
    mqttDevices,
    aedes,
    getMqttTopics
};
