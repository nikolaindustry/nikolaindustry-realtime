const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const axios = require('axios');
const schedule = require('node-schedule');
const { DateTime } = require('luxon'); // Install with: npm install luxon


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

    // Ensure the devices map supports multiple connections per ID
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

        console.log(`Message from ${deviceId}:`);
        console.log(JSON.stringify(decodedMessage));

        const { type, targetIds, targetId, payload } = decodedMessage;

        if (type === 'getConnectedDevices') {
            const connectedDevices = Array.from(devices.keys());
            ws.send(JSON.stringify({ type: 'connectedDevices', devices: connectedDevices }));
            console.log(`Sent connected devices list to ${deviceId}`);
        } else if (type === 'broadcast') {
            const connections = devices.get(deviceId);
            connections.forEach((conn) => {
                if (conn.readyState === WebSocket.OPEN) {
                    conn.send(JSON.stringify({ from: deviceId, payload }));
                    console.log(`Broadcast message from ${deviceId}`);
                }
            });
        } else if (Array.isArray(targetIds)) {
            targetIds.forEach((id) => {
                if (devices.has(id)) {
                    const targets = devices.get(id);
                    targets.forEach((targetSocket) => {
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
            const targets = devices.get(targetId);
            targets.forEach((targetSocket) => {
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

                const { targetId, targetIds, payload } = controlData;
                if (targetId && devices.has(targetId)) {
                    const targetSockets = devices.get(targetId);
                    targetSockets.forEach(socket => {
                        if (socket.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify({ from: "scheduler", payload }));
                            console.log(`Sent scheduled command to ${targetId}`);
                        }
                    });
                } else if (Array.isArray(targetIds) && targetIds.length > 0) {
                    console.log(`Sending payload to multiple target devices: ${targetIds}`);
                    targetIds.forEach((id) => {
                        if (devices.has(id)) {
                            const targets = devices.get(id);
                            targets.forEach((targetSocket) => {
                                if (targetSocket.readyState === WebSocket.OPEN) {
                                    targetSocket.send(JSON.stringify({ from: "scheduler", payload }));
                                    console.log(`Sent scheduled command to ${id}`);
                                }
                            });
                        } else {
                            console.error(`Target device ${id} is not found.`);
                        }
                    });
                } else {
                    console.error(`Invalid or empty targetIds array in control message.`);
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




server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
