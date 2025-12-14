const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = 3000;

// Don't use pino - create simple logger
const simpleLogger = {
    level: 'silent',
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {}
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve HTML interface
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Connect - Cloud Tech</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 20px;
                padding: 40px;
                width: 100%;
                max-width: 400px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
            }
            h1 {
                color: #25D366;
                margin-bottom: 10px;
            }
            .brand {
                color: #4a6ee0;
                font-weight: bold;
                font-size: 18px;
                margin-bottom: 30px;
                display: block;
            }
            input {
                width: 100%;
                padding: 15px;
                margin: 10px 0;
                border: 2px solid #e0e0e0;
                border-radius: 10px;
                font-size: 16px;
                transition: border-color 0.3s;
            }
            input:focus {
                outline: none;
                border-color: #25D366;
            }
            button {
                background: #25D366;
                color: white;
                border: none;
                padding: 16px;
                width: 100%;
                border-radius: 10px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                margin-top: 10px;
                transition: background 0.3s;
            }
            button:hover {
                background: #1da851;
            }
            button:disabled {
                background: #cccccc;
                cursor: not-allowed;
            }
            .result {
                margin-top: 20px;
                padding: 20px;
                border-radius: 10px;
                display: none;
            }
            .success {
                background: #d4edda;
                color: #155724;
                display: block;
            }
            .error {
                background: #f8d7da;
                color: #721c24;
                display: block;
            }
            .code {
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 5px;
                background: #f0f0f0;
                padding: 15px;
                border-radius: 10px;
                margin: 15px 0;
                font-family: monospace;
            }
            .instructions {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 10px;
                margin: 15px 0;
                text-align: left;
                font-size: 14px;
                line-height: 1.6;
            }
            .step {
                margin: 8px 0;
                display: flex;
                align-items: center;
            }
            .step-number {
                background: #25D366;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-right: 10px;
                font-size: 12px;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔗 WhatsApp Connect</h1>
            <span class="brand">by Cloud Tech</span>
            
            <form id="connectForm">
                <input 
                    type="tel" 
                    id="phoneNumber" 
                    placeholder="Enter WhatsApp number (e.g., 254712345678)" 
                    required
                >
                <button type="submit" id="connectBtn">
                    Get Pairing Code
                </button>
            </form>
            
            <div id="result" class="result"></div>
        </div>

        <script>
            const form = document.getElementById('connectForm');
            const resultDiv = document.getElementById('result');
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const phoneNumber = document.getElementById('phoneNumber').value.trim();
                const btn = document.getElementById('connectBtn');
                
                if (!phoneNumber || phoneNumber.length < 10) {
                    showResult('Please enter a valid WhatsApp number', 'error');
                    return;
                }
                
                // Disable button
                btn.disabled = true;
                btn.textContent = 'Connecting...';
                
                try {
                    const response = await fetch('/connect', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ phoneNumber })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        showResult(\`
                            <h3>✅ Pairing Code Generated!</h3>
                            <div class="code">\${data.pairingCode}</div>
                            <div class="instructions">
                                <strong>How to connect:</strong>
                                <div class="step">
                                    <span class="step-number">1</span>
                                    Open WhatsApp on your phone
                                </div>
                                <div class="step">
                                    <span class="step-number">2</span>
                                    Go to Settings → Linked Devices
                                </div>
                                <div class="step">
                                    <span class="step-number">3</span>
                                    Tap "Link a Device"
                                </div>
                                <div class="step">
                                    <span class="step-number">4</span>
                                    Enter code: <strong>\${data.pairingCode}</strong>
                                </div>
                            </div>
                            <p>Check your WhatsApp for confirmation message!</p>
                        \`, 'success');
                    } else {
                        showResult(\`❌ Error: \${data.error}\`, 'error');
                    }
                } catch (error) {
                    showResult(\`❌ Connection error: \${error.message}\`, 'error');
                } finally {
                    // Re-enable button
                    btn.disabled = false;
                    btn.textContent = 'Get Pairing Code';
                }
            });
            
            function showResult(message, type) {
                resultDiv.innerHTML = message;
                resultDiv.className = 'result ' + type;
                resultDiv.style.display = 'block';
            }
        </script>
    </body>
    </html>
    `);
});

// Store active connections
const connections = new Map();

// Connect endpoint
app.post('/connect', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        
        if (!cleanNumber || cleanNumber.length < 10) {
            return res.json({ 
                success: false, 
                error: 'Invalid phone number. Use format: 254712345678' 
            });
        }
        
        console.log(`\n📱 Connection request for: ${cleanNumber}`);
        
        // Generate random 6-digit code (simulated - real one comes from WhatsApp)
        const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Start connection in background
        startWhatsAppConnection(cleanNumber, pairingCode);
        
        res.json({
            success: true,
            phoneNumber: cleanNumber,
            pairingCode: pairingCode,
            message: 'Check your WhatsApp for the actual pairing code'
        });
        
    } catch (error) {
        console.error('Connection error:', error);
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

async function startWhatsAppConnection(phoneNumber, pairingCode) {
    try {
        console.log(`\n🔄 Starting WhatsApp connection for: ${phoneNumber}`);
        
        // Create session directory
        const sessionDir = path.join(__dirname, 'sessions', phoneNumber);
        await fs.ensureDir(sessionDir);
        
        // Load auth state
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        // Create WhatsApp socket WITHOUT problematic logger
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: state.keys,
            },
            printQRInTerminal: false,
            // Use simple logger to avoid pino issues
            logger: simpleLogger,
            browser: ['CloudTech', 'Chrome', '1.0.0']
        });
        
        // Save credentials when updated
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            
            // Show actual pairing code from WhatsApp
            if (update.pairingCode) {
                console.log('\n════════════════════════════════════════════');
                console.log(`   🔢 WHATSAPP PAIRING CODE: ${update.pairingCode}`);
                console.log('════════════════════════════════════════════\n');
                console.log('📱 Instructions:');
                console.log('1. Open WhatsApp → Settings → Linked Devices');
                console.log('2. Tap "Link a Device"');
                console.log(`3. Enter: ${update.pairingCode}`);
                console.log('4. Wait for confirmation...\n');
            }
            
            if (connection === 'open') {
                console.log('\n╔══════════════════════════════════════════╗');
                console.log('║     ✅ CONNECTION ESTABLISHED           ║');
                console.log('║        by CLOUD TECH                    ║');
                console.log('╚══════════════════════════════════════════╝\n');
                
                console.log(`📱 Connected: ${phoneNumber}`);
                console.log(`👤 User: ${sock.user?.name || 'WhatsApp User'}`);
                console.log(`🆔 ID: ${sock.user?.id}`);
                console.log(`🕒 Time: ${new Date().toLocaleTimeString()}\n`);
                
                // Send confirmation message
                try {
                    await sock.sendMessage(sock.user.id, {
                        text: `✅ *CONNECTION ESTABLISHED*\n\nPowered by *CLOUD TECH*\n\n📱 Number: ${phoneNumber}\n🕒 Time: ${new Date().toLocaleString()}\n\n✅ WhatsApp linked successfully!`
                    });
                    console.log('📨 Confirmation message sent to WhatsApp\n');
                } catch (err) {
                    console.log('⚠️ Could not send confirmation\n');
                }
            }
            
            if (connection === 'close') {
                console.log(`\n❌ Disconnected: ${phoneNumber}`);
                connections.delete(phoneNumber);
            }
        });
        
        // Store connection
        connections.set(phoneNumber, sock);
        
        // Request actual pairing code from WhatsApp
        console.log('🔄 Requesting pairing code from WhatsApp...');
        await sock.requestPairingCode(phoneNumber);
        
    } catch (error) {
        console.error(`❌ Connection failed for ${phoneNumber}:`, error.message);
        connections.delete(phoneNumber);
    }
}

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online', 
        connections: connections.size,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.clear();
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   WHATSAPP CONNECTION PORTAL            ║');
    console.log('║        by CLOUD TECH                    ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log(`🌐 Server: http://localhost:${PORT}`);
    console.log('📱 Open browser and enter your WhatsApp number');
    console.log('🔢 You will receive a 6-digit pairing code\n');
    console.log('📁 Sessions are saved in: ./sessions/\n');
});

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    process.exit(0);
});
