const express = require('express');
const WebSocket = require('ws');
const { devices } = require('../utils/websocket');
const { getAllDevices, sendToDevice, broadcastToAll } = require('../utils/mqtt');

const router = express.Router();

// Middleware to parse JSON
router.use(express.json());

// Send message to specific device (WebSocket + MQTT)
router.post('/send/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    const { payload } = req.body;

    if (!deviceId) {
        return res.status(400).json({ error: 'Device ID is required' });
    }

    if (!payload) {
        return res.status(400).json({ error: 'Payload is required' });
    }

    try {
        const result = sendToDevice(deviceId, payload, 'api');
        
        if (!result.sent) {
            return res.status(404).json({ error: `Device ${deviceId} not found or not connected` });
        }

        console.log(`🚀 API sent message to ${deviceId} via ${result.protocols.join(', ')}:`, JSON.stringify(payload));
        res.json({ 
            success: true, 
            message: `Message sent to device ${deviceId}`,
            connections: result.connections,
            protocols: result.protocols
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Send message to multiple devices (WebSocket + MQTT)
router.post('/send-multiple', (req, res) => {
    const { deviceIds, payload } = req.body;

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
        return res.status(400).json({ error: 'deviceIds array is required' });
    }

    if (!payload) {
        return res.status(400).json({ error: 'Payload is required' });
    }

    const results = [];
    let totalSent = 0;

    deviceIds.forEach((deviceId) => {
        const result = sendToDevice(deviceId, payload, 'api');
        if (result.sent) {
            totalSent += result.connections;
            results.push({ 
                deviceId, 
                status: 'sent', 
                connections: result.connections,
                protocols: result.protocols
            });
            console.log(`🚀 API sent message to ${deviceId} via ${result.protocols.join(', ')}:`, JSON.stringify(payload));
        } else {
            results.push({ deviceId, status: 'not_found', connections: 0, protocols: [] });
        }
    });

    res.json({
        success: true,
        message: `Messages processed for ${deviceIds.length} devices`,
        totalSent,
        results
    });
});

// Broadcast message to all connected devices (WebSocket + MQTT)
router.post('/broadcast', (req, res) => {
    const { payload } = req.body;

    if (!payload) {
        return res.status(400).json({ error: 'Payload is required' });
    }

    try {
        const result = broadcastToAll(payload, 'api_broadcast');

        console.log(`📢 API broadcast message to all devices:`, JSON.stringify(payload));
        res.json({
            success: true,
            message: `Broadcast sent to all connected devices`,
            totalSent: result.totalSent,
            devices: result.deviceResults
        });
    } catch (error) {
        console.error('Error broadcasting message:', error);
        res.status(500).json({ error: 'Failed to broadcast message' });
    }
});

// Send batch commands (like the existing WebSocket controlData feature)
router.post('/batch', (req, res) => {
    const { commands } = req.body;

    if (!Array.isArray(commands) || commands.length === 0) {
        return res.status(400).json({ error: 'commands array is required' });
    }

    const results = [];
    let totalSent = 0;

    commands.forEach(({ deviceId, payload }) => {
        if (!deviceId || !payload) {
            results.push({ deviceId: deviceId || 'unknown', status: 'invalid', error: 'deviceId and payload required' });
            return;
        }

        const result = sendToDevice(deviceId, payload, 'api_batch');
        if (result.sent) {
            totalSent += result.connections;
            results.push({ 
                deviceId, 
                status: 'sent', 
                connections: result.connections,
                protocols: result.protocols
            });
            console.log(`🚀 API batch sent to ${deviceId} via ${result.protocols.join(', ')}:`, JSON.stringify(payload));
        } else {
            results.push({ deviceId, status: 'not_found', connections: 0, protocols: [] });
        }
    });

    res.json({
        success: true,
        message: `Batch commands processed for ${commands.length} commands`,
        totalSent,
        results
    });
});

// Get list of connected devices (WebSocket + MQTT)
router.get('/devices', (req, res) => {
    try {
        const allDevices = getAllDevices();
        const connectedDevices = [];
        
        allDevices.forEach((deviceInfo, deviceId) => {
            connectedDevices.push({
                deviceId,
                type: deviceInfo.type, // 'websocket', 'mqtt', or 'hybrid'
                connections: deviceInfo.activeConnections || deviceInfo.connections,
                status: (deviceInfo.activeConnections || deviceInfo.connections) > 0 ? 'online' : 'offline',
                protocols: deviceInfo.type === 'hybrid' ? ['websocket', 'mqtt'] : [deviceInfo.type]
            });
        });

        res.json({
            success: true,
            totalDevices: connectedDevices.length,
            devices: connectedDevices
        });
    } catch (error) {
        console.error('Error getting devices:', error);
        res.status(500).json({ error: 'Failed to get devices list' });
    }
});

// Get specific device status (WebSocket + MQTT)
router.get('/devices/:deviceId', (req, res) => {
    const { deviceId } = req.params;

    try {
        const allDevices = getAllDevices();
        
        if (!allDevices.has(deviceId)) {
            return res.status(404).json({ error: `Device ${deviceId} not found` });
        }

        const deviceInfo = allDevices.get(deviceId);
        
        res.json({
            success: true,
            deviceId,
            type: deviceInfo.type,
            connections: deviceInfo.activeConnections || deviceInfo.connections,
            status: (deviceInfo.activeConnections || deviceInfo.connections) > 0 ? 'online' : 'offline',
            protocols: deviceInfo.type === 'hybrid' ? ['websocket', 'mqtt'] : [deviceInfo.type]
        });
    } catch (error) {
        console.error('Error getting device status:', error);
        res.status(500).json({ error: 'Failed to get device status' });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'up', timestamp: new Date().toISOString() });
});

// MQTT specific endpoints

// Get MQTT broker stats
router.get('/mqtt/stats', (req, res) => {
    try {
        const { aedes } = require('../utils/mqtt');
        
        res.json({
            success: true,
            stats: {
                clients: Object.keys(aedes.clients).length,
                subscriptions: Object.keys(aedes.subscriptions).length
            }
        });
    } catch (error) {
        console.error('Error getting MQTT stats:', error);
        res.status(500).json({ error: 'Failed to get MQTT stats' });
    }
});

// Publish to MQTT topic directly
router.post('/mqtt/publish', (req, res) => {
    const { topic, payload, qos = 1, retain = false } = req.body;
    
    if (!topic || !payload) {
        return res.status(400).json({ error: 'topic and payload are required' });
    }
    
    try {
        const { aedes } = require('../utils/mqtt');
        
        aedes.publish({
            topic,
            payload: Buffer.from(JSON.stringify(payload)),
            qos: parseInt(qos),
            retain: Boolean(retain)
        });
        
        console.log(`📡 Published to MQTT topic ${topic}:`, payload);
        res.json({
            success: true,
            message: `Published to topic ${topic}`
        });
    } catch (error) {
        console.error('Error publishing to MQTT:', error);
        res.status(500).json({ error: 'Failed to publish to MQTT' });
    }
});

module.exports = router;
