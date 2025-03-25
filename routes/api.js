const express = require('express');
const { fetchAndSchedule } = require('../utils/scheduler');

const router = express.Router();

router.get('/fetch-and-schedule', async (req, res) => {
    try {
        await fetchAndSchedule(); // If this is a long-running task, consider running it asynchronously
        res.json({ message: "fetchAndSchedule executed successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error executing fetchAndSchedule", details: error.message });
    }
});

// Health Check Route
router.get('/health', (req, res) => {
    res.json({
        status: "up",
        timestamp: new Date().toISOString()
    });
});

// Handle HEAD request for health check
router.head('/health', (req, res) => {
    res.status(200).send();
});

module.exports = router;
