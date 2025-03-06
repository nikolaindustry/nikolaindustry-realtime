const axios = require('axios');
const schedule = require('node-schedule');
const { DateTime } = require('luxon');
const { pub } = require('./redis'); // Use Redis for message publishing
const redis = require('redis');

// Create a Redis client for task tracking
const redisClient = redis.createClient({ url: process.env.REDIS_URL });

redisClient.on('error', (err) => console.error("❌ Redis Error:", err));

(async () => {
    await redisClient.connect();
    console.log("✅ Redis connected for scheduling!");
})();

async function fetchAndSchedule() {
    try {
        const response = await axios.get('https://nikolaindustry.wixstudio.com/hyperwisor-v2/_functions/getschedule?src=222031154');
        const schedules = response.data?.result || [];

        for (const scheduleItem of schedules) {
            const { schedulekey, time, controlmessage, type, status } = scheduleItem;

            // Check Redis to prevent duplicate scheduling across instances
            const isScheduled = await redisClient.get(`schedule:${schedulekey}`);
            if (status !== 'pending' || isScheduled) continue;

            let [hours, minutes, seconds] = time.split(':').map(Number);
            const istTime = DateTime.fromObject({ hour: hours, minute: minutes, second: seconds }, { zone: 'Asia/Kolkata' });
            const utcTime = istTime.toUTC().toJSDate();

            const job = schedule.scheduleJob(utcTime, async function () {
                console.log(`Executing scheduled task: ${scheduleItem.title}`);

                try {
                    const controlData = JSON.parse(controlmessage);
                    
                    // Publish control message to Redis (all WebSocket servers will get this)
                    await pub.publish('controlChannel', JSON.stringify({ from: "scheduler", controlData }));

                    if (type === "one_time") {
                        await redisClient.del(`schedule:${schedulekey}`);
                        await axios.get(`https://nikolaindustry.wixstudio.com/hyperwisor-v2/_functions/updateschedulestatus?schedulekey=${schedulekey}&newstatus=executed`);
                    }
                } catch (error) {
                    console.error('Error executing scheduled task:', error);
                }
            });

            // Store the scheduled task in Redis
            await redisClient.set(`schedule:${schedulekey}`, "scheduled");
        }
    } catch (error) {
        console.error('Error fetching schedules:', error);
    }
}

// Run scheduling every 30 seconds
setInterval(fetchAndSchedule, 30000);

module.exports = { fetchAndSchedule };
