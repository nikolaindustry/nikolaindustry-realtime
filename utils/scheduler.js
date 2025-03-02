const axios = require('axios');
const schedule = require('node-schedule');
const { DateTime } = require('luxon');
const { devices } = require('./websocket');

const scheduledTasks = new Map();

async function fetchAndSchedule() {
    try {
        const response = await axios.get('https://nikolaindustry.wixstudio.com/hyperwisor-v2/_functions/getschedule?src=222031154');
        const schedules = response.data?.result || [];

        schedules.forEach(scheduleItem => {
            const { schedulekey, time, controlmessage, type, status } = scheduleItem;

            if (status !== 'pending' || scheduledTasks.has(schedulekey)) return;

            let [hours, minutes, seconds] = time.split(':').map(Number);
            const istTime = DateTime.fromObject({ hour: hours, minute: minutes, second: seconds }, { zone: 'Asia/Kolkata' });
            const utcTime = istTime.toUTC().toJSDate();

            const job = schedule.scheduleJob(utcTime, async function () {
                console.log(`Executing scheduled task: ${scheduleItem.title}`);

                try {
                    const controlData = JSON.parse(controlmessage);
                    controlData.forEach(({ targetId, payload }) => {
                        if (devices.has(targetId)) {
                            devices.get(targetId).forEach(socket => {
                                if (socket.readyState === WebSocket.OPEN) {
                                    socket.send(JSON.stringify({ from: "scheduler", payload }));
                                }
                            });
                        }
                    });

                    if (type === "one_time") {
                        scheduledTasks.delete(schedulekey);
                        await axios.get(`https://nikolaindustry.wixstudio.com/hyperwisor-v2/_functions/updateschedulestatus?schedulekey=${schedulekey}&newstatus=executed`);
                    }
                } catch (error) {
                    console.error('Error executing scheduled task:', error);
                }
            });

            scheduledTasks.set(schedulekey, job);
        });
    } catch (error) {
        console.error('Error fetching schedules:', error);
    }
}

// Run scheduling every 30 seconds
setInterval(fetchAndSchedule, 30000);

module.exports = { fetchAndSchedule };
