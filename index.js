const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { Boom } = require('@hapi/boom');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure sessions directory exists
const sessionsDir = path.join(__dirname, 'sessions');
fs.ensureDirSync(sessionsDir);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// HTML form
const htmlForm = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Connection Portal</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
            max-width: 500px;
            width: 100%;
        }
        
        .header {
            background: linear-gradient(135deg, #4c6ef5 0%, #3b5bdb 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 16px;
        }
        
        .content {
            padding: 40px;
        }
        
        .form-group {
            margin-bottom: 25px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            color: #495057;
            font-weight: 500;
        }
        
        input {
            width: 100%;
            padding: 15px;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            font-size: 16px;
            transition: all 0.3s;
        }
        
        input:focus {
            outline: none;
            border-color: #4c6ef5;
            box-shadow: 0 0 0 3px rgba(76, 110, 245, 0.1);
        }
        
        .btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #4c6ef5 0%, #3b5bdb 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(76, 110, 245, 0.3);
        }
        
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .result-box {
            margin-top: 30px;
            padding: 25px;
            background: #f8f9fa;
            border-radius: 10px;
            display: none;
        }
        
        .code-display {
            text-align: center;
            margin: 20px 0;
        }
        
        .code {
            font-size: 48px;
            font-weight: 700;
            color: #4c6ef5;
            letter-spacing: 8px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }
        
        .instructions {
            background: #e7f5ff;
            border-left: 4px solid #4c6ef5;
            padding: 15px;
            border-radius: 0 10px 10px 0;
            margin-top: 20px;
        }
        
        .instructions ol {
            padding-left: 20px;
        }
        
        .instructions li {
            margin-bottom: 10px;
        }
        
        .status {
            text-align: center;
            margin-top: 15px;
            font-weight: 600;
        }
        
        .success {
            color: #40c057;
        }
        
        .error {
            color: #fa5252;
        }
        
        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #868e96;
            font-size: 14px;
        }
        
        @media (max-width: 480px) {
            .content {
                padding: 25px;
            }
            
            .header {
                padding: 25px 20px;
            }
            
            .code {
                font-size: 36px;
                letter-spacing: 6px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>WhatsApp Connection Portal</h1>
            <p>by CLOUD TECH</p>
        </div>
        
        <div class="content">
            <form id="connectionForm">
                <div class="form-group">
                    <label for="phoneNumber">WhatsApp Phone Number</label>
                    <input 
                        type="text" 
                        id="phoneNumber" 
                        name="phoneNumber" 
                        placeholder="e.g., 254743982206 (without +)" 
                        required
                        pattern="[0-9]{10,15}"
                        title="Enter 10-15 digits without country code"
                    >
                    <small style="color: #868e96; display: block; margin-top: 5px;">
                        Enter your number without + sign
                    </small>
                </div>
                
                <button type="submit" class="btn" id="submitBtn">
                    <span id="btnText">Get Pairing Code</span>
                    <span id="btnSpinner" style="display: none;">
                        <span class="spinner"></span> Generating...
                    </span>
                </button>
            </form>
            
            <div class="result-box" id="resultBox">
                <div class="code-display">
                    <div>Your WhatsApp Pairing Code:</div>
                    <div class="code" id="pairingCode">000000</div>
                </div>
                
                <div class="instructions">
                    <h3>Instructions:</h3>
                    <ol>
                        <li>Open WhatsApp on your phone</li>
                        <li>Go to Settings → Linked Devices</li>
                        <li>Tap "Link a Device"</li>
                        <li>Enter the code: <strong id="codeDisplay"></strong></li>
                        <li>Wait for confirmation...</li>
                    </ol>
                </div>
                
                <div class="status" id="statusMessage"></div>
            </div>
        </div>
        
        <footer>
            © 2024 CLOUD TECH. WhatsApp Connection Portal
        </footer>
    </div>
    
    <script>
        document.getElementById('connectionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const phoneNumber = document.getElementById('phoneNumber').value.trim();
            const submitBtn = document.getElementById('submitBtn');
            const btnText = document.getElementById('btnText');
            const btnSpinner = document.getElementById('btnSpinner');
            const resultBox = document.getElementById('resultBox');
            const pairingCode = document.getElementById('pairingCode');
            const codeDisplay = document.getElementById('codeDisplay');
            const statusMessage = document.getElementById('statusMessage');
            
            if (!/^\d{10,15}$/.test(phoneNumber)) {
                alert('Please enter a valid phone number (10-15 digits)');
                return;
            }
            
            // Show loading state
            submitBtn.disabled = true;
            btnText.style.display = 'none';
            btnSpinner.style.display = 'inline-block';
            statusMessage.textContent = '';
            statusMessage.className = 'status';
            
            try {
                const response = await fetch('/get-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `phoneNumber=${encodeURIComponent(phoneNumber)}`
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Display the pairing code
                    pairingCode.textContent = result.code;
                    codeDisplay.textContent = result.code;
                    resultBox.style.display = 'block';
                    
                    // Scroll to result
                    resultBox.scrollIntoView({ behavior: 'smooth' });
                    
                    // Show status
                    statusMessage.textContent = 'Waiting for connection...';
                    statusMessage.className = 'status';
                    
                    // Start checking connection status
                    checkConnectionStatus();
                } else {
                    throw new Error(result.error || 'Failed to generate code');
                }
                
            } catch (error) {
                statusMessage.textContent = 'Error: ' + error.message;
                statusMessage.className = 'status error';
                resultBox.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                btnText.style.display = 'inline-block';
                btnSpinner.style.display = 'none';
            }
        });
        
        async function checkConnectionStatus() {
            const statusMessage = document.getElementById('statusMessage');
            
            try {
                const response = await fetch('/connection-status');
                const result = await response.json();
                
                if (result.connected) {
                    statusMessage.textContent = '✅ Connected successfully! Check your WhatsApp for confirmation.';
                    statusMessage.className = 'status success';
                    
                    // Show connection details
                    setTimeout(() => {
                        statusMessage.innerHTML = `
                            ✅ CONNECTION ESTABLISHED<br>
                            <small>by CLOUD TECH</small><br><br>
                            📱 Number: ${result.phoneNumber}<br>
                            👤 User: ${result.userName || 'Connected'}<br>
                            🕒 Time: ${new Date().toLocaleTimeString()}<br><br>
                            📨 Confirmation message sent to WhatsApp
                        `;
                    }, 1000);
                } else {
                    // Keep checking every 3 seconds
                    setTimeout(checkConnectionStatus, 3000);
                }
            } catch (error) {
                console.error('Status check error:', error);
                setTimeout(checkConnectionStatus, 3000);
            }
        }
    </script>
</body>
</html>
`;

// Global variables to track connection status
let currentConnection = null;
let connectionStatus = {
    connected: false,
    phoneNumber: null,
    userName: null,
    pairingCode: null
};

// WhatsApp connection logic
async function connectWhatsApp(phoneNumber) {
    try {
        console.log('\n' + '='.repeat(50));
        console.log('📱 Connection request for:', phoneNumber);
        console.log('='.repeat(50) + '\n');
        
        const { default: makeWASocket, useMultiFileAuthState } = await import('@whiskeysockets/baileys');
        
        // Generate a random 6-digit code
        const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
        connectionStatus.pairingCode = pairingCode;
        connectionStatus.phoneNumber = phoneNumber;
        
        console.log('════════════════════════════════════════════');
        console.log('   🔢 WHATSAPP PAIRING CODE:', pairingCode);
        console.log('════════════════════════════════════════════\n');
        
        console.log('📱 Instructions:');
        console.log('1. Open WhatsApp → Settings → Linked Devices');
        console.log('2. Tap "Link a Device"');
        console.log('3. Enter:', pairingCode);
        console.log('4. Wait for confirmation...\n');
        
        // Create session directory for this number
        const sessionPath = path.join(sessionsDir, phoneNumber);
        fs.ensureDirSync(sessionPath);
        
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        
        // Create socket with minimal configuration
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: {
                level: 'silent'
            },
            browser: ['CLOUD TECH', 'Chrome', '1.0.0'],
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            shouldIgnoreJid: (jid) => jid?.endsWith('@g.us')
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log('\n╔══════════════════════════════════════════╗');
                console.log('║     ✅ CONNECTION ESTABLISHED           ║');
                console.log('║        by CLOUD TECH                    ║');
                console.log('╚══════════════════════════════════════════╝\n');
                
                // Get user info
                const user = sock.user;
                connectionStatus.connected = true;
                connectionStatus.userName = user?.name || 'User';
                
                console.log('📱 Connected:', phoneNumber);
                console.log('👤 User:', connectionStatus.userName);
                console.log('🕒 Time:', new Date().toLocaleTimeString());
                console.log('\n📨 Sending confirmation message...');
                
                try {
                    // Send confirmation message to self
                    await sock.sendMessage(
                        `${phoneNumber}@s.whatsapp.net`,
                        {
                            text: `✅ CONNECTION ESTABLISHED\n\nPowered by CLOUD TECH\n\n📱 Number: ${phoneNumber}\n🕒 Time: ${new Date().toLocaleString()}\n\n✅ WhatsApp linked successfully!`
                        }
                    );
                    
                    console.log('✅ Confirmation message sent to WhatsApp\n');
                } catch (msgError) {
                    console.log('⚠️ Could not send message (might be privacy settings)');
                }
                
                console.log('🔄 Connection is now active and monitoring...');
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                console.log('\n⚠️ Connection closed:', lastDisconnect?.error?.message || 'Unknown error');
                
                if (shouldReconnect) {
                    console.log('🔄 Attempting to reconnect in 5 seconds...');
                    setTimeout(() => connectWhatsApp(phoneNumber), 5000);
                } else {
                    console.log('❌ Cannot reconnect - authentication required');
                    connectionStatus.connected = false;
                }
            }
        });
        
        // Request pairing if not registered
        if (!sock.authState.creds.registered) {
            await sock.requestPairingCode(phoneNumber);
        }
        
        currentConnection = sock;
        return pairingCode;
        
    } catch (error) {
        console.error('❌ Connection error:', error.message);
        throw new Error(`Failed to connect: ${error.message}`);
    }
}

// Routes
app.get('/', (req, res) => {
    res.send(htmlForm);
});

app.post('/get-code', async (req, res) => {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber || !/^\d{10,15}$/.test(phoneNumber)) {
        return res.json({ 
            success: false, 
            error: 'Invalid phone number. Please enter 10-15 digits without +' 
        });
    }
    
    try {
        const code = await connectWhatsApp(phoneNumber);
        res.json({ success: true, code });
    } catch (error) {
        console.error('Error generating code:', error);
        res.json({ 
            success: false, 
            error: 'Could not generate pairing code. Please try again.' 
        });
    }
});

app.get('/connection-status', (req, res) => {
    res.json({
        connected: connectionStatus.connected,
        phoneNumber: connectionStatus.phoneNumber,
        userName: connectionStatus.userName,
        pairingCode: connectionStatus.pairingCode
    });
});

// Start server
app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║   WHATSAPP CONNECTION PORTAL            ║');
    console.log('║        by CLOUD TECH                    ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log('🌐 Server: http://localhost:' + PORT);
    console.log('\n📱 Ready to accept connections...\n');
});
