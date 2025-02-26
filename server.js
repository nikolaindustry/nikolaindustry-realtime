const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const axios = require('axios');
const schedule = require('node-schedule');
const { DateTime } = require('luxon');

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
            console.error('Error parsing message:', e);
            return;
        }
    
        console.log(`Message received:`, JSON.stringify(decodedMessages, null, 2));

        // Example JSON format for batch controlData messages:
        // {
        //   "controlData": [
        //     { "targetId": "device1", "payload": { "command": "turnOn" } },
        //     { "targetId": "device2", "payload": { "command": "turnOff" } }
        //   ]
        // }
        if (decodedMessages.controlData && Array.isArray(decodedMessages.controlData)) {
            console.log(`Processing batch control messages: ${decodedMessages.controlData.length} items`);

            decodedMessages.controlData.forEach(({ targetId, payload }) => {
                if (targetId && devices.has(targetId)) {
                    devices.get(targetId).forEach((targetSocket) => {
                        if (targetSocket.readyState === WebSocket.OPEN) {
                            targetSocket.send(JSON.stringify({ from: "server", payload }));
                            console.log(`Sent command to ${targetId}:`, JSON.stringify(payload));
                        }
                    });
                } else {
                    console.error(`Target device ${targetId} not found.`);
                }
            });
            return;
        }

        if (!Array.isArray(decodedMessages)) {
            decodedMessages = [decodedMessages];
        }
    
        decodedMessages.forEach((decodedMessage) => {
            const { type, targetIds, targetId, payload } = decodedMessage;
    
            // Example JSON for requesting connected devices:
            // { "type": "getConnectedDevices" }
            if (type === 'getConnectedDevices') {
                const connectedDevices = Array.from(devices.keys());
                ws.send(JSON.stringify({ type: 'connectedDevices', devices: connectedDevices }));
                console.log(`Sent connected devices list`);
            } else if (type === 'broadcast') {
                // Example JSON for broadcasting:
                // { "type": "broadcast", "payload": { "message": "Hello everyone!" } }
                devices.get(deviceId)?.forEach((conn) => {
                    if (conn.readyState === WebSocket.OPEN) {
                        conn.send(JSON.stringify({ from: deviceId, payload }));
                        console.log(`Broadcast message from ${deviceId}`);
                    }
                });
            } else if (Array.isArray(targetIds)) {
                // Example JSON for targeting multiple devices:
                // { "targetIds": ["device1", "device2"], "payload": { "command": "restart" } }
                targetIds.forEach((id) => {
                    if (devices.has(id)) {
                        devices.get(id).forEach((targetSocket) => {
                            if (targetSocket.readyState === WebSocket.OPEN) {
                                targetSocket.send(JSON.stringify({ from: deviceId, payload }));
                                console.log(`Message forwarded from ${deviceId} to ${id}`);
                            }
                        });
                    } else {
                        console.error(`Target device ${id} is not found.`);
                    }
                });
            } else if (targetId && devices.has(targetId)) {
                // Example JSON for a single target:
                // { "targetId": "device1", "payload": { "command": "shutdown" } }
                devices.get(targetId).forEach((targetSocket) => {
                    if (targetSocket.readyState === WebSocket.OPEN) {
                        targetSocket.send(JSON.stringify({ from: deviceId, payload }));
                        console.log(`Message forwarded from ${deviceId} to ${targetId}`);
                    }
                });
            } else {
                const response = JSON.stringify({ message: "I got your message" });
                ws.send(response);
            }
        });
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


const scheduledTasks = new Map(); // Store scheduled jobs to avoid duplicates

async function fetchAndSchedule() {
    try {
        const response = await axios.get('https://nikolaindustry.wixstudio.com/hyperwisor-v2/_functions/getschedule?src=222031154');

        if (!response.data || !response.data.result) {
            console.error('Invalid API response structure.');
            return;
        }

        const schedules = response.data.result;

        if (schedules.length === 0) {
            console.log("No pending scheduled tasks found.");
            return;
        }


        console.log(`Fetched ${schedules.length} scheduled tasks`);

        schedules.forEach(scheduleItem => {
            const { schedulekey, time, controlmessage, type, status, date, timezone } = scheduleItem;

            if (status !== 'pending') return; // Only process pending schedules

            let [hours, minutes, seconds] = time.split(':').map(Number);

            // Convert API-provided time (IST) to UTC
            const istTime = DateTime.fromObject(
                { hour: hours, minute: minutes, second: seconds },
                { zone: 'Asia/Kolkata' } // Your API's time zone
            );

            const utcTime = istTime.toUTC(); // Convert IST to UTC
            const scheduleDate = utcTime.toJSDate(); // Convert to JS Date

            console.log(`Scheduling task "${scheduleItem.title}" at ${scheduleDate} (UTC)`);

            if (scheduledTasks.has(schedulekey)) return; // Avoid rescheduling

            const job = schedule.scheduleJob(scheduleDate, async function () { // Mark this function as async
                console.log(`Executing scheduled task: ${scheduleItem.title}`);

                let controlData;
                try {
                    controlData = JSON.parse(controlmessage);
                } catch (e) {
                    console.error(`Invalid control message JSON: ${e.message}`);
                    return;
                }

                if (Array.isArray(controlData) && controlData.length > 0) {
                    console.log(`Processing ${controlData.length} control messages.`);
                    controlData.forEach(({ targetId, payload }) => {
                        if (targetId && devices.has(targetId)) {
                            const targetSockets = devices.get(targetId);
                            targetSockets.forEach(socket => {
                                if (socket.readyState === WebSocket.OPEN) {
                                    socket.send(JSON.stringify({ from: "scheduler", payload }));
                                    console.log(`Sent scheduled command to ${targetId}`);
                                }
                            });
                        } else {
                            console.error(`Target device ${targetId} not found.`);
                        }
                    });
                } else {
                    console.error("Invalid or empty controlData array in control message.");
                }

                // Remove one-time schedules after execution
                if (type === "one_time") {
                    scheduledTasks.delete(schedulekey);

                    try {
                        const replay = await axios.get(`https://nikolaindustry.wixstudio.com/hyperwisor-v2/_functions/updateschedulestatus?schedulekey=${schedulekey}&newstatus=executed`);
                        console.log(replay.data);
                    } catch (error) {
                        console.error(`Error updating schedule status: ${error.message}`);
                    }
                }
            });

            scheduledTasks.set(schedulekey, job);
        });

    } catch (error) {
        console.error('Error fetching schedules:', error.message);
    }
}

// Run every 30 seconds
setInterval(fetchAndSchedule, 30000);


//------------------------------------------------------------------backend http call---------------
app.get('/api/fetch-and-schedule', async (req, res) => {
    try {
        await fetchAndSchedule(); // Call the function
        res.status(200).json({ message: "fetchAndSchedule executed successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error executing fetchAndSchedule", details: error.message });
    }
});


server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
