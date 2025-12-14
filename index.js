const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure sessions directory exists
const sessionsDir = path.join(__dirname, 'sessions');
fs.ensureDirSync(sessionsDir);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Global variables to track connection status
let connectionStatus = {
    connected: false,
    phoneNumber: null,
    userName: null,
    pairingCode: null
};

// Routes
app.post('/get-code', async (req, res) => {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber || !/^\d{10,15}$/.test(phoneNumber)) {
        return res.json({ 
            success: false, 
            error: 'Invalid phone number. Please enter 10-15 digits without +' 
        });
    }
    
    try {
        // Generate a random 6-digit code
        const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
        connectionStatus.pairingCode = pairingCode;
        connectionStatus.phoneNumber = phoneNumber;
        
        console.log('\n' + '='.repeat(50));
        console.log('📱 Connection request for:', phoneNumber);
        console.log('='.repeat(50));
        console.log('   🔢 WHATSAPP PAIRING CODE:', pairingCode);
        console.log('='.repeat(50));
        
        res.json({ success: true, code: pairingCode });
        
    } catch (error) {
        console.error('Error:', error);
        res.json({ 
            success: false, 
            error: 'Could not generate pairing code' 
        });
    }
});

app.get('/connection-status', (req, res) => {
    res.json(connectionStatus);
});

// Start server
app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║   WHATSAPP CONNECTION PORTAL            ║');
    console.log('║        by CLOUD TECH                    ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log('🌐 Server: http://localhost:' + PORT);
});
