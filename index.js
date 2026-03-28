require('dotenv').config();
const axios = require('axios');
const WebSocket = require('ws');
const fs = require('fs');

// CONFIG
const WS_URL = 'wss://api.autodarts.io/ms/v0/subscribe';
const AUTH_URL = 'https://login.autodarts.io/realms/autodarts/protocol/openid-connect/token';

// 👉 HIER EINTRAGEN
const EMAIL = "user@example.com";
const PASSWORD = "***REMOVED***";
const BOARD_ID = "00000000-0000-4000-8000-000000000001";

// LOG FILES
const inLog = fs.createWriteStream('autodarts-in.log', { flags: 'a' });
const outLog = fs.createWriteStream('autodarts-out.log', { flags: 'a' });

// JWT decode helper
function parseJwt(token) {
    const base64Payload = token.split('.')[1];
    const payload = Buffer.from(base64Payload, 'base64').toString();
    return JSON.parse(payload);
}

// LOGIN (Keycloak)
async function getToken() {
    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'password');
        params.append('client_id', 'developer-darts-caller');
        params.append('client_secret', '***REMOVED***');
        params.append('username', EMAIL);
        params.append('password', PASSWORD);

        const res = await axios.post(AUTH_URL, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        console.log('✅ Login success');
        return res.data.access_token;

    } catch (err) {
        console.error('Login failed:', err.response?.data || err.message);
        process.exit(1);
    }
}

// helper logging
function log(stream, label, data) {
    const line = `[${new Date().toISOString()}] ${label} ${typeof data === 'string' ? data : JSON.stringify(data)}\n`;
    stream.write(line);
    console.log(line.trim());
}

function send(ws, obj) {
    ws.send(JSON.stringify(obj));
    log(outLog, 'SEND', obj);
}

// CONNECT WEBSOCKET
async function connect() {
    const token = await getToken();

    const decoded = parseJwt(token);
    const USER_ID = decoded.sub;

    console.log('👤 USER_ID:', USER_ID);

    const ws = new WebSocket(WS_URL, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    ws.on('open', () => {
        console.log('🔌 WebSocket connected');

        // 🔥 WICHTIG: Subscriptions wie darts-caller
        
       send(ws, {
            type: 'subscribe',
            channel: 'autodarts.boards',
            topic: `${BOARD_ID}.state`
        });

        send(ws, {
            type: 'subscribe',
            channel: 'autodarts.boards',
            topic: `${BOARD_ID}.matches`
        });
    });

    ws.on('message', (data) => {
        const msg = data.toString();
        log(inLog, 'RECV', msg);

        try {
            const json = JSON.parse(msg);

            // 🎯 Match erkannt → weitere Subscriptions
            if (
                json.channel === 'autodarts.boards' &&
                json.data &&
                json.data.event === 'start' &&
                json.data.id
            ) {
                const matchId = json.data.id;

                console.log('🎯 MATCH DETECTED:', matchId);

                send(ws, {
                    channel: 'autodarts.matches',
                    type: 'subscribe',
                    topic: `${matchId}.state`
                });

                send(ws, {
                    channel: 'autodarts.boards',
                    type: 'subscribe',
                    topic: `${BOARD_ID}.events`
                });
            }

            // 🧍 Lobby erkannt
            if (
                json.channel === 'autodarts.users' &&
                json.data &&
                json.data.event === 'lobby-enter' &&
                json.data.body &&
                json.data.body.id
            ) {
                const lobbyId = json.data.body.id;

                console.log('👥 LOBBY DETECTED:', lobbyId);

                send(ws, {
                    channel: 'autodarts.lobbies',
                    type: 'subscribe',
                    topic: `${lobbyId}.state`
                });

                send(ws, {
                    channel: 'autodarts.lobbies',
                    type: 'subscribe',
                    topic: `${lobbyId}.events`
                });
            }

        } catch (e) {
            // ignore parse errors
        }
    });

    ws.on('close', () => {
        console.log('❌ WS closed, reconnecting in 5s...');
        setTimeout(connect, 5000);
    });

    ws.on('error', (err) => {
        console.error('WS Error:', err.message);
    });
}

connect();