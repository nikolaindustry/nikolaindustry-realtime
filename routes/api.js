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
    res.json({
        status: "up",
        timestamp: new Date().toISOString()
    });
});



module.exports = router;
