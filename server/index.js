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

// Store rooms in memory (for now)
// Room structure:
// {
//   id: string,
//   hostId: string,
//   players: { id: string, name: string, ready: boolean }[],
//   gameState: { ... } | null
// }
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', ({ hostName, cardData }, callback) => {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms.set(roomId, {
            id: roomId,
            hostId: socket.id,
            players: [{ id: socket.id, name: hostName, ready: false }],
            gameState: null,
            cardData: cardData || [] // Store the card content for shuffling
        });
        socket.join(roomId);
        callback({ roomId, playerId: socket.id });
        console.log(`Room ${roomId} created by ${hostName} with ${(cardData || []).length} cells`);
    });

    socket.on('join_room', ({ roomId, playerName }, callback) => {
        const room = rooms.get(roomId);
        if (!room) {
            return callback({ error: 'Room not found' });
        }

        room.players.push({ id: socket.id, name: playerName, ready: false });
        socket.join(roomId);

        // Notify others in room
        socket.to(roomId).emit('player_joined', { id: socket.id, name: playerName });

        // Send current game state to new player if it exists
        if (room.gameState) {
            socket.emit('game_state_update', room.gameState);
        }

        // Return room info (players list + card data so joiner can see the card)
        callback({
            roomId,
            playerId: socket.id,
            players: room.players,
            cardData: room.cardData
        });
        console.log(`${playerName} joined room ${roomId}`);
    });

    socket.on('update_game_state', (roomId, newState) => {
        const room = rooms.get(roomId);
        // Only host can update global game config usually, but for now allow anyone
        if (room) {
            room.gameState = newState;
            socket.to(roomId).emit('game_state_update', newState);
        }
    });

    socket.on('declare_win', ({ roomId, playerName, winType }) => {
        socket.to(roomId).emit('player_won', { playerName, winType });
    });

    // Fisher-Yates shuffle helper
    function shuffleArray(arr) {
        const shuffled = [...arr];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    socket.on('start_game', (roomId) => {
        const room = rooms.get(roomId);
        if (room) {
            // Send each player a uniquely shuffled version of the card
            for (const player of room.players) {
                const shuffledContents = shuffleArray(room.cardData).map((cell, idx) => ({
                    id: idx,
                    text: cell.text,
                    image: cell.image
                }));
                io.to(player.id).emit('shuffled_card', shuffledContents);
            }
            io.to(roomId).emit('game_started');
            console.log(`Game started in room ${roomId} — shuffled cards sent to ${room.players.length} players`);
        }
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
                    // If host left, assign new host? (Skip for now)
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
