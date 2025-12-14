const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs-extra');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const activeConnections = new Map();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Serve HTML pages
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Connection - Cloud Tech</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                padding: 40px;
                width: 100%;
                max-width: 500px;
                text-align: center;
            }
            h1 {
                color: #333;
                margin-bottom: 10px;
                font-size: 28px;
            }
            .subtitle {
                color: #666;
                margin-bottom: 30px;
                font-size: 16px;
            }
            .cloud-tech {
                color: #4a6ee0;
                font-weight: bold;
                font-size: 18px;
            }
            .form-group {
                margin-bottom: 20px;
                text-align: left;
            }
            label {
                display: block;
                margin-bottom: 8px;
                color: #555;
                font-weight: 500;
            }
            input {
                width: 100%;
                padding: 12px 15px;
                border: 2px solid #e0e0e0;
                border-radius: 10px;
                font-size: 16px;
                transition: border-color 0.3s;
            }
            input:focus {
                outline: none;
                border-color: #4a6ee0;
            }
            .btn {
                background: linear-gradient(135deg, #4a6ee0 0%, #6a11cb 100%);
                color: white;
                border: none;
                padding: 15px 30px;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
                margin-top: 10px;
                transition: transform 0.3s, box-shadow 0.3s;
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(74, 110, 224, 0.3);
            }
            .btn:active {
                transform: translateY(0);
            }
            .status-box {
                margin-top: 30px;
                padding: 20px;
                border-radius: 10px;
                background: #f8f9fa;
                display: none;
            }
            .status-box.active {
                display: block;
            }
            #qrCode {
                margin: 20px auto;
                max-width: 200px;
            }
            #pairingCode {
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 5px;
                color: #4a6ee0;
                background: #f0f4ff;
                padding: 10px;
                border-radius: 10px;
                margin: 20px 0;
            }
            .instructions {
                background: #f0f4ff;
                padding: 15px;
                border-radius: 10px;
                margin: 15px 0;
                text-align: left;
                font-size: 14px;
            }
            .step {
                margin-bottom: 10px;
                display: flex;
                align-items: center;
            }
            .step-number {
                background: #4a6ee0;
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
            #connectionStatus {
                padding: 10px;
                border-radius: 10px;
                margin-top: 20px;
                font-weight: bold;
                display: none;
            }
            .connected {
                background: #d4edda;
                color: #155724;
                display: block;
            }
            .disconnected {
                background: #f8d7da;
                color: #721c24;
                display: block;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>WhatsApp Connection</h1>
            <p class="subtitle">Connect your WhatsApp account to <span class="cloud-tech">Cloud Tech</span></p>
            
            <form id="connectForm">
                <div class="form-group">
                    <label for="phoneNumber">📱 WhatsApp Number</label>
                    <input type="tel" id="phoneNumber" placeholder="254712345678" required>
                    <small style="color: #666; font-size: 12px;">Enter with country code (no + sign)</small>
                </div>
                
                <button type="submit" class="btn">🔗 Connect WhatsApp</button>
            </form>
            
            <div class="status-box" id="statusBox">
                <h3>Pairing Instructions</h3>
                
                <div id="qrContainer" style="display: none;">
                    <p>Scan QR Code:</p>
                    <img id="qrCode" alt="QR Code">
                </div>
                
                <div id="codeContainer" style="display: none;">
                    <p>Your Pairing Code:</p>
                    <div id="pairingCode">------</div>
                </div>
                
                <div class="instructions">
                    <div class="step">
                        <span class="step-number">1</span> Open WhatsApp on your phone
                    </div>
                    <div class="step">
                        <span class="step-number">2</span> Go to Settings → Linked Devices
                    </div>
                    <div class="step">
                        <span class="step-number">3</span> Tap "Link a Device"
                    </div>
                    <div class="step">
                        <span class="step-number">4</span> Enter the code above or scan QR
                    </div>
                </div>
                
                <div id="connectionStatus"></div>
            </div>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            const form = document.getElementById('connectForm');
            const statusBox = document.getElementById('statusBox');
            const qrContainer = document.getElementById('qrContainer');
            const codeContainer = document.getElementById('codeContainer');
            const qrCodeImg = document.getElementById('qrCode');
            const pairingCodeEl = document.getElementById('pairingCode');
            const connectionStatus = document.getElementById('connectionStatus');
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const phoneNumber = document.getElementById('phoneNumber').value;
                
                if (!phoneNumber || phoneNumber.length < 10) {
                    alert('Please enter a valid phone number');
                    return;
                }
                
                // Show status box
                statusBox.classList.add('active');
                
                // Send connection request
                socket.emit('connect-whatsapp', { phoneNumber });
            });
            
            // Socket listeners
            socket.on('pairing-code', ({ code }) => {
                codeContainer.style.display = 'block';
                pairingCodeEl.textContent = code;
                connectionStatus.innerHTML = '📱 Enter this code in WhatsApp';
                connectionStatus.className = 'connected';
                connectionStatus.style.display = 'block';
            });
            
            socket.on('qr-code', ({ qr }) => {
                qrContainer.style.display = 'block';
                qrCodeImg.src = qr;
                connectionStatus.innerHTML = '📱 Scan QR Code with WhatsApp';
                connectionStatus.className = 'connected';
                connectionStatus.style.display = 'block';
            });
            
            socket.on('connected', ({ user, phoneNumber }) => {
                connectionStatus.innerHTML = \`
                    ✅ CONNECTION ESTABLISHED by Cloud Tech<br>
                    👤 Connected as: \${user.name || user.id}<br>
                    📱 Number: \${phoneNumber}<br>
                    🕒 Time: \${new Date().toLocaleTimeString()}
                \`;
                connectionStatus.className = 'connected';
                
                // Show success for 5 seconds, then reset
                setTimeout(() => {
                    statusBox.classList.remove('active');
                    form.reset();
                    connectionStatus.style.display = 'none';
                }, 5000);
            });
            
            socket.on('error', ({ message }) => {
                connectionStatus.innerHTML = \`❌ Error: \${message}\`;
                connectionStatus.className = 'disconnected';
                connectionStatus.style.display = 'block';
            });
            
            socket.on('disconnected', () => {
                connectionStatus.innerHTML = '❌ Disconnected. Please try again.';
                connectionStatus.className = 'disconnected';
                connectionStatus.style.display = 'block';
            });
        </script>
    </body>
    </html>
    `);
});

// WhatsApp connection handler
async function connectWhatsApp(socket, phoneNumber) {
    try {
        const sessionFolder = path.join(__dirname, 'sessions', phoneNumber);
        await fs.ensureDir(sessionFolder);
        
        const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
        
        const sock = makeWASocket({
            version: [2, 2413, 1],
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: state.keys,
            },
            browser: ['CloudTech', 'Chrome', '1.0.0'],
            logger: { level: 'silent' }
        });
        
        // Save credentials
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, isNewLogin } = update;
            
            // Send QR code to client if available
            if (qr) {
                try {
                    const qrDataUrl = await QRCode.toDataURL(qr);
                    socket.emit('qr-code', { qr: qrDataUrl });
                } catch (err) {
                    console.error('QR generation error:', err);
                }
            }
            
            // Send pairing code if available
            if (update.pairingCode) {
                socket.emit('pairing-code', { code: update.pairingCode });
            }
            
            // Connection successful
            if (connection === 'open') {
                const user = sock.user;
                
                // Send confirmation message
                await sock.sendMessage(user.id, {
                    text: `✅ *CONNECTION ESTABLISHED*\n\nPowered by *CLOUD TECH*\n\n📱 Number: ${phoneNumber}\n🕒 Time: ${new Date().toLocaleString()}\n\n✅ Connection successful!`
                });
                
                socket.emit('connected', {
                    user: {
                        id: user.id,
                        name: user.name || 'WhatsApp User'
                    },
                    phoneNumber: phoneNumber
                });
                
                console.log(`✅ Connected: ${phoneNumber}`);
            }
            
            // Connection closed
            if (connection === 'close') {
                socket.emit('disconnected');
                activeConnections.delete(phoneNumber);
            }
        });
        
        // Request pairing code
        await sock.requestPairingCode(phoneNumber);
        
        // Store connection
        activeConnections.set(phoneNumber, { socket: sock, userId: socket.id });
        
    } catch (error) {
        console.error('Connection error:', error);
        socket.emit('error', { message: error.message });
    }
}

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);
    
    socket.on('connect-whatsapp', async (data) => {
        const { phoneNumber } = data;
        console.log(`🔄 Pairing request for: ${phoneNumber}`);
        
        // Clean phone number
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        
        if (cleanNumber.length < 10) {
            socket.emit('error', { message: 'Invalid phone number' });
            return;
        }
        
        // Check if already connected
        if (activeConnections.has(cleanNumber)) {
            socket.emit('error', { message: 'Already connected or pairing in progress' });
            return;
        }
        
        // Start WhatsApp connection
        connectWhatsApp(socket, cleanNumber);
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// Start server
server.listen(PORT, () => {
    console.clear();
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   WHATSAPP WEB PAIRING SERVER           ║');
    console.log('║        by CLOUD TECH                    ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log(`🌐 Server running on: http://localhost:${PORT}`);
    console.log('\n📱 Open browser and enter your WhatsApp number');
    console.log('🔢 Get pairing code and connect!\n');
});

// Handle server shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    server.close();
    process.exit(0);
});
