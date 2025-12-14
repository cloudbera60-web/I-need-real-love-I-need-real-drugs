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

// Create proper pino logger instance
const pino = require('pino');
const logger = pino({
    level: 'silent', // Disable all logs
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Serve HTML interface
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Connect - Cloud Tech</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {
                font-family: Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 15px;
                padding: 30px;
                width: 100%;
                max-width: 400px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            h1 {
                color: #333;
                text-align: center;
                margin-bottom: 5px;
            }
            .subtitle {
                color: #666;
                text-align: center;
                margin-bottom: 25px;
                font-size: 14px;
            }
            .brand {
                color: #4a6ee0;
                font-weight: bold;
            }
            .form-group {
                margin-bottom: 20px;
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
                border-radius: 8px;
                font-size: 16px;
                transition: border-color 0.3s;
            }
            input:focus {
                outline: none;
                border-color: #4a6ee0;
            }
            .btn {
                background: #4a6ee0;
                color: white;
                border: none;
                padding: 15px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
                transition: background 0.3s;
            }
            .btn:hover {
                background: #3a5ed0;
            }
            .status-box {
                margin-top: 20px;
                padding: 20px;
                border-radius: 8px;
                background: #f8f9fa;
                display: none;
            }
            .status-box.active {
                display: block;
            }
            #pairingCode {
                font-size: 28px;
                font-weight: bold;
                letter-spacing: 3px;
                color: #4a6ee0;
                background: #f0f4ff;
                padding: 15px;
                border-radius: 8px;
                margin: 15px 0;
                text-align: center;
            }
            .instructions {
                background: #f0f4ff;
                padding: 15px;
                border-radius: 8px;
                margin: 15px 0;
                font-size: 14px;
                line-height: 1.6;
            }
            #connectionStatus {
                padding: 12px;
                border-radius: 8px;
                margin-top: 15px;
                font-weight: 500;
                text-align: center;
                display: none;
            }
            .connected {
                background: #d4edda;
                color: #155724;
                display: block;
            }
            .error {
                background: #f8d7da;
                color: #721c24;
                display: block;
            }
            .loading {
                background: #fff3cd;
                color: #856404;
                display: block;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔗 WhatsApp Connect</h1>
            <p class="subtitle">by <span class="brand">Cloud Tech</span></p>
            
            <form id="connectForm">
                <div class="form-group">
                    <label for="phoneNumber">📱 WhatsApp Number</label>
                    <input type="tel" id="phoneNumber" placeholder="254712345678" required>
                </div>
                
                <button type="submit" class="btn">Connect WhatsApp</button>
            </form>
            
            <div class="status-box" id="statusBox">
                <h3 style="text-align: center; margin-bottom: 15px;">Pairing Instructions</h3>
                
                <div id="codeContainer" style="display: none;">
                    <div id="pairingCode">------</div>
                </div>
                
                <div class="instructions">
                    <strong>Steps to connect:</strong><br>
                    1. Open WhatsApp on your phone<br>
                    2. Go to Settings → Linked Devices<br>
                    3. Tap "Link a Device"<br>
                    4. Enter the 6-digit code above
                </div>
                
                <div id="connectionStatus"></div>
            </div>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            const form = document.getElementById('connectForm');
            const statusBox = document.getElementById('statusBox');
            const codeContainer = document.getElementById('codeContainer');
            const pairingCodeEl = document.getElementById('pairingCode');
            const connectionStatus = document.getElementById('connectionStatus');
            
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const phoneNumber = document.getElementById('phoneNumber').value.trim();
                
                if (!phoneNumber || phoneNumber.length < 10) {
                    alert('Please enter a valid phone number (e.g., 254712345678)');
                    return;
                }
                
                // Show status box
                statusBox.classList.add('active');
                connectionStatus.innerHTML = '🔄 Connecting to WhatsApp...';
                connectionStatus.className = 'loading';
                connectionStatus.style.display = 'block';
                
                // Send connection request
                socket.emit('connect-whatsapp', { phoneNumber });
            });
            
            // Socket listeners
            socket.on('pairing-code', ({ code }) => {
                codeContainer.style.display = 'block';
                pairingCodeEl.textContent = code;
                connectionStatus.innerHTML = '📱 Enter this code in WhatsApp';
                connectionStatus.className = 'connected';
            });
            
            socket.on('connected', ({ phoneNumber }) => {
                connectionStatus.innerHTML = \`
                    ✅ CONNECTION ESTABLISHED by Cloud Tech<br><br>
                    📱 Number: \${phoneNumber}<br>
                    🕒 Time: \${new Date().toLocaleTimeString()}<br><br>
                    Check WhatsApp for confirmation message!
                \`;
                connectionStatus.className = 'connected';
                
                // Auto-reset after 8 seconds
                setTimeout(() => {
                    statusBox.classList.remove('active');
                    form.reset();
                    codeContainer.style.display = 'none';
                    connectionStatus.style.display = 'none';
                }, 8000);
            });
            
            socket.on('error', ({ message }) => {
                connectionStatus.innerHTML = \`❌ Error: \${message}\`;
                connectionStatus.className = 'error';
            });
        </script>
    </body>
    </html>
    `);
});

// WhatsApp connection function
async function connectWhatsApp(socket, phoneNumber) {
    try {
        const sessionFolder = path.join(__dirname, 'sessions', phoneNumber);
        await fs.ensureDir(sessionFolder);
        
        const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
        
        // Create socket with proper logger
        const sock = makeWASocket({
            version: [2, 2413, 1],
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: state.keys,
            },
            // Fixed logger configuration
            logger: logger.child({ level: 'fatal' }), // Use child logger
            browser: ['CloudTech', 'Chrome', '1.0.0']
        });
        
        // Save credentials
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr } = update;
            
            // Send QR code if available (fallback)
            if (qr) {
                try {
                    const qrDataUrl = await QRCode.toDataURL(qr);
                    socket.emit('qr-code', { qr: qrDataUrl });
                } catch (err) {
                    console.error('QR error:', err);
                }
            }
            
            // Send pairing code
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
                    phoneNumber: phoneNumber,
                    user: user
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

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('🔌 Client connected');
    
    socket.on('connect-whatsapp', async (data) => {
        const { phoneNumber } = data;
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        
        if (cleanNumber.length < 10) {
            socket.emit('error', { message: 'Invalid phone number' });
            return;
        }
        
        console.log(`🔄 Pairing: ${cleanNumber}`);
        connectWhatsApp(socket, cleanNumber);
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected');
    });
});

// Start server
server.listen(PORT, () => {
    console.clear();
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   WHATSAPP CONNECTION PORTAL            ║');
    console.log('║        by CLOUD TECH                    ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log(`🌐 Server: http://localhost:${PORT}`);
    console.log('📱 Enter your WhatsApp number to connect');
    console.log('🔢 Get pairing code and link your device\n');
});

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    server.close();
    process.exit(0);
});
