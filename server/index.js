import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRoutes from './auth.js';
import apiRoutes from './api.js';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Room structure:
// {
//   id, hostId, players: [{ id, name }],
//   settings: { size, gameMode, cardTitle, subtitle, titleFont, bodyFont, allCaps, entries, totalRounds, callerEnabled },
//   scores: { [playerId]: number },
//   currentRound: number,
//   gameStarted: boolean,
//   calledEntries: string[]   — entries already called out
// }
const rooms = new Map();

// Fisher-Yates shuffle helper
function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Helper: deal new shuffled cards to all players in a room
function dealCards(room) {
    const { entries, size } = room.settings;
    const entryList = entries.split(',').map(e => e.trim()).filter(e => e.length > 0);
    const needed = size * size;
    if (entryList.length < needed) return;

    for (const player of room.players) {
        const shuffled = shuffleArray(entryList);
        const picked = shuffled.slice(0, needed);
        const cellContents = picked.map((text, idx) => ({
            id: idx, text, image: null
        }));
        io.to(player.id).emit('shuffled_card', cellContents);
    }
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', ({ hostName }, callback) => {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms.set(roomId, {
            id: roomId,
            hostId: socket.id,
            players: [{ id: socket.id, name: hostName }],
            settings: null,
            scores: {},
            currentRound: 0,
            gameStarted: false,
            calledEntries: []
        });
        callback({ roomId, playerId: socket.id });
        socket.join(roomId);
        console.log(`Room ${roomId} created by ${hostName}`);
    });

    socket.on('join_room', ({ roomId, playerName }, callback) => {
        const room = rooms.get(roomId);
        if (!room) return callback({ error: 'Room not found' });

        room.players.push({ id: socket.id, name: playerName });
        room.scores[socket.id] = 0;
        socket.join(roomId);

        socket.to(roomId).emit('player_joined', { id: socket.id, name: playerName });

        callback({
            roomId,
            playerId: socket.id,
            hostId: room.hostId,
            players: room.players,
            settings: room.settings,
            scores: room.scores,
            currentRound: room.currentRound,
            gameStarted: room.gameStarted,
            calledEntries: room.calledEntries || []
        });
        console.log(`${playerName} joined room ${roomId}`);
    });

    // Host updates room settings
    socket.on('update_room_settings', (roomId, settings) => {
        const room = rooms.get(roomId);
        if (room && room.hostId === socket.id) {
            room.settings = settings;
            socket.to(roomId).emit('room_settings_update', settings);
        }
    });

    // Chat
    socket.on('send_message', ({ roomId, playerName, message }) => {
        io.to(roomId).emit('chat_message', {
            id: Date.now() + '-' + socket.id,
            senderId: socket.id,
            senderName: playerName,
            message,
            timestamp: Date.now()
        });
    });

    // Player declares bingo — increment score, broadcast to ALL, check round end
    socket.on('declare_win', ({ roomId, playerName, winType }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        // Increment score
        if (!room.scores[socket.id]) room.scores[socket.id] = 0;
        room.scores[socket.id]++;

        // Broadcast to ALL players (including the winner)
        io.to(roomId).emit('player_scored', {
            playerId: socket.id,
            playerName,
            winType,
            scores: room.scores,
            currentRound: room.currentRound
        });
    });

    // Host starts a new round (or the first round)
    socket.on('start_game', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || !room.settings) return;

        // Initialize scores for all players if first start
        for (const p of room.players) {
            if (room.scores[p.id] === undefined) room.scores[p.id] = 0;
        }

        room.currentRound = 1;
        room.gameStarted = true;
        room.calledEntries = [];

        dealCards(room);
        io.to(roomId).emit('game_started', {
            currentRound: room.currentRound,
            totalRounds: room.settings.totalRounds || 1,
            scores: room.scores
        });
        console.log(`Game started in room ${roomId} — Round 1 of ${room.settings.totalRounds || 1}`);
    });

    // Host starts next round
    socket.on('next_round', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || !room.settings || room.hostId !== socket.id) return;

        const totalRounds = room.settings.totalRounds || 1;
        if (room.currentRound >= totalRounds) return;

        room.currentRound++;
        room.calledEntries = [];

        dealCards(room);
        io.to(roomId).emit('new_round', {
            currentRound: room.currentRound,
            totalRounds,
            scores: room.scores
        });
        console.log(`Room ${roomId} — Round ${room.currentRound} of ${totalRounds}`);
    });

    // Host draws next entry to call out
    socket.on('next_call', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || !room.settings || room.hostId !== socket.id) return;

        const entryList = room.settings.entries.split(',').map(e => e.trim()).filter(e => e.length > 0);
        const remaining = entryList.filter(e => !(room.calledEntries || []).includes(e));
        if (remaining.length === 0) return;

        const pick = remaining[Math.floor(Math.random() * remaining.length)];
        if (!room.calledEntries) room.calledEntries = [];
        room.calledEntries.push(pick);

        io.to(roomId).emit('entry_called', {
            entry: pick,
            calledEntries: room.calledEntries,
            remaining: remaining.length - 1
        });
    });

    // Host resets called entries
    socket.on('reset_calls', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || room.hostId !== socket.id) return;
        room.calledEntries = [];
        io.to(roomId).emit('calls_reset');
    });

    socket.on('disconnecting', () => {
        for (const room of socket.rooms) {
            if (rooms.has(room)) {
                const r = rooms.get(room);
                r.players = r.players.filter(p => p.id !== socket.id);
                delete r.scores[socket.id];
                if (r.players.length === 0) {
                    rooms.delete(room);
                } else {
                    io.to(room).emit('player_left', { id: socket.id, scores: r.scores });
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
