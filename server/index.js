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

// Store rooms in memory
// Room structure:
// {
//   id: string,
//   hostId: string,
//   players: [{ id, name }],
//   settings: { size, gameMode, cardTitle, subtitle, titleFont, bodyFont, allCaps, entries }
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

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', ({ hostName }, callback) => {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms.set(roomId, {
            id: roomId,
            hostId: socket.id,
            players: [{ id: socket.id, name: hostName }],
            settings: null
        });
        socket.join(roomId);
        callback({ roomId, playerId: socket.id });
        console.log(`Room ${roomId} created by ${hostName}`);
    });

    socket.on('join_room', ({ roomId, playerName }, callback) => {
        const room = rooms.get(roomId);
        if (!room) {
            return callback({ error: 'Room not found' });
        }

        room.players.push({ id: socket.id, name: playerName });
        socket.join(roomId);

        // Notify others in room
        socket.to(roomId).emit('player_joined', { id: socket.id, name: playerName });

        // Return room info + current settings so joiner can see what's configured
        callback({
            roomId,
            playerId: socket.id,
            hostId: room.hostId,
            players: room.players,
            settings: room.settings
        });
        console.log(`${playerName} joined room ${roomId}`);
    });

    // Host updates room settings (entries, title, size, etc.)
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

    socket.on('declare_win', ({ roomId, playerName, winType }) => {
        socket.to(roomId).emit('player_won', { playerName, winType });
    });

    socket.on('start_game', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || !room.settings) return;

        const { entries, size } = room.settings;
        const entryList = entries.split(',').map(e => e.trim()).filter(e => e.length > 0);
        const needed = size * size;

        if (entryList.length < needed) return;

        // Send each player a uniquely shuffled board
        for (const player of room.players) {
            const shuffled = shuffleArray(entryList);
            const picked = shuffled.slice(0, needed);
            const cellContents = picked.map((text, idx) => ({
                id: idx,
                text,
                image: null
            }));
            io.to(player.id).emit('shuffled_card', cellContents);
        }
        io.to(roomId).emit('game_started');
        console.log(`Game started in room ${roomId} — shuffled cards sent to ${room.players.length} players`);
    });

    socket.on('disconnecting', () => {
        for (const room of socket.rooms) {
            if (rooms.has(room)) {
                const r = rooms.get(room);
                r.players = r.players.filter(p => p.id !== socket.id);
                if (r.players.length === 0) {
                    rooms.delete(room);
                } else {
                    io.to(room).emit('player_left', { id: socket.id });
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
