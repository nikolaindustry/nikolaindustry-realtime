const express = require('express');
const WebSocket = require('ws');
const { devices } = require('../utils/websocket');

const router = express.Router();

// Middleware to parse JSON
router.use(express.json());

// Send message to specific device
router.post('/send/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    const { payload } = req.body;

    if (!deviceId) {
        return res.status(400).json({ error: 'Device ID is required' });
    }

    if (!payload) {
        return res.status(400).json({ error: 'Payload is required' });
    }

    if (!devices.has(deviceId)) {
        return res.status(404).json({ error: `Device ${deviceId} not found or not connected` });
    }

    try {
        const deviceConnections = devices.get(deviceId);
        let sentCount = 0;

        deviceConnections.forEach((socket) => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ from: 'api', payload }));
                sentCount++;
            }
        });

        if (sentCount === 0) {
            return res.status(503).json({ error: `Device ${deviceId} has no active connections` });
        }

        console.log(`🚀 API sent message to ${deviceId}:`, JSON.stringify(payload));
        res.json({ 
            success: true, 
            message: `Message sent to device ${deviceId}`,
            connections: sentCount
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Send message to multiple devices
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
        if (devices.has(deviceId)) {
            const deviceConnections = devices.get(deviceId);
            let sentCount = 0;

            deviceConnections.forEach((socket) => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ from: 'api', payload }));
                    sentCount++;
                    totalSent++;
                }
            });

            results.push({ deviceId, status: 'sent', connections: sentCount });
            console.log(`🚀 API sent message to ${deviceId}:`, JSON.stringify(payload));
        } else {
            results.push({ deviceId, status: 'not_found', connections: 0 });
        }
    });

    res.json({
        success: true,
        message: `Messages processed for ${deviceIds.length} devices`,
        totalSent,
        results
    });
});

// Broadcast message to all connected devices
router.post('/broadcast', (req, res) => {
    const { payload } = req.body;

    if (!payload) {
        return res.status(400).json({ error: 'Payload is required' });
    }

    let totalSent = 0;
    const deviceResults = [];

    devices.forEach((connections, deviceId) => {
        let sentCount = 0;
        connections.forEach((socket) => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ from: 'api_broadcast', payload }));
                sentCount++;
                totalSent++;
            }
        });
        deviceResults.push({ deviceId, connections: sentCount });
    });

    console.log(`📢 API broadcast message to all devices:`, JSON.stringify(payload));
    res.json({
        success: true,
        message: `Broadcast sent to all connected devices`,
        totalSent,
        devices: deviceResults
    });
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

        if (devices.has(deviceId)) {
            const deviceConnections = devices.get(deviceId);
            let sentCount = 0;

            deviceConnections.forEach((socket) => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ from: 'api_batch', payload }));
                    sentCount++;
                    totalSent++;
                }
            });

            results.push({ deviceId, status: 'sent', connections: sentCount });
            console.log(`🚀 API batch sent to ${deviceId}:`, JSON.stringify(payload));
        } else {
            results.push({ deviceId, status: 'not_found', connections: 0 });
        }
    });

    res.json({
        success: true,
        message: `Batch commands processed for ${commands.length} commands`,
        totalSent,
        results
    });
});

// Get list of connected devices
router.get('/devices', (req, res) => {
    const connectedDevices = [];
    
    devices.forEach((connections, deviceId) => {
        const activeConnections = connections.filter(socket => socket.readyState === WebSocket.OPEN).length;
        connectedDevices.push({
            deviceId,
            connections: activeConnections,
            status: activeConnections > 0 ? 'online' : 'offline'
        });
    });

    res.json({
        success: true,
        totalDevices: connectedDevices.length,
        devices: connectedDevices
    });
});

// Get specific device status
router.get('/devices/:deviceId', (req, res) => {
    const { deviceId } = req.params;

    if (!devices.has(deviceId)) {
        return res.status(404).json({ error: `Device ${deviceId} not found` });
    }

    const connections = devices.get(deviceId);
    const activeConnections = connections.filter(socket => socket.readyState === WebSocket.OPEN).length;

    res.json({
        success: true,
        deviceId,
        connections: activeConnections,
        status: activeConnections > 0 ? 'online' : 'offline'
    });
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'up', timestamp: new Date().toISOString() });
});

module.exports = router;
