const mqtt = require('mqtt');

// Connect to the MQTT broker
const client = mqtt.connect('mqtt://localhost:1883', {
    clientId: 'test-device-001'
});

client.on('connect', () => {
    console.log('📡 Connected to MQTT broker');
    
    // Subscribe to multiple topics to test topic tracking
    const topics = [
        'device/test-device-001/commands',
        'device/test-device-001/status',
        'sensor/temperature',
        'sensor/humidity',
        'alerts/system'
    ];
    
    topics.forEach(topic => {
        client.subscribe(topic, (err) => {
            if (!err) {
                console.log(`✅ Subscribed to: ${topic}`);
            } else {
                console.error(`❌ Failed to subscribe to ${topic}:`, err);
            }
        });
    });
    
    // Publish some test messages to create activity
    setTimeout(() => {
        console.log('📨 Publishing test messages...');
        
        client.publish('device/test-device-001/status', JSON.stringify({
            status: 'online',
            timestamp: new Date().toISOString()
        }));
        
        client.publish('sensor/temperature', JSON.stringify({
            value: 23.5,
            unit: 'celsius',
            timestamp: new Date().toISOString()
        }));
        
        client.publish('sensor/humidity', JSON.stringify({
            value: 65.2,
            unit: 'percent',
            timestamp: new Date().toISOString()
        }));
        
        console.log('✅ Test messages published');
    }, 2000);
    
    // Continue publishing messages periodically
    setInterval(() => {
        const temp = Math.round((Math.random() * 10 + 20) * 10) / 10;
        const humidity = Math.round((Math.random() * 20 + 50) * 10) / 10;
        
        client.publish('sensor/temperature', JSON.stringify({
            value: temp,
            unit: 'celsius',
            timestamp: new Date().toISOString()
        }));
        
        client.publish('sensor/humidity', JSON.stringify({
            value: humidity,
            unit: 'percent',
            timestamp: new Date().toISOString()
        }));
        
        console.log(`📊 Published: Temperature ${temp}°C, Humidity ${humidity}%`);
    }, 10000);
});

client.on('message', (topic, message) => {
    console.log(`📩 Received message on ${topic}:`, message.toString());
});

client.on('error', (error) => {
    console.error('❌ MQTT Error:', error);
});

client.on('disconnect', () => {
    console.log('📴 Disconnected from MQTT broker');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n📴 Shutting down MQTT client...');
    client.end();
    process.exit(0);
});

console.log('🚀 Starting MQTT test client...');
