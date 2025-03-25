const express = require('express');
const { fetchAndSchedule } = require('../utils/scheduler');

const router = express.Router();

router.get('/fetch-and-schedule', async (req, res) => {
    try {
        await fetchAndSchedule();
        res.json({ message: "fetchAndSchedule executed successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error executing fetchAndSchedule", details: error.message });
    }
});

router.get('/health', async (req, res) => {
    try {
        // Just return the status without running heavy operations
        res.json({ 
            status: "up",
            timestamp: new Date().toISOString() 
        });
    } catch (error) {
        res.status(500).json({ 
            status: "down",
            error: error.message 
        });
    }
});

// Also handle HEAD requests which is what the client is using
router.head('/health', (req, res) => {
    res.status(200).send();
});


module.exports = router;
