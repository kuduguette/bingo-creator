import { useEffect, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Player {
    id: string;
    name: string;
}

export interface RoomSettings {
    size: number;
    gameMode: string;
    cardTitle: string;
    subtitle: string;
    titleFont: string;
    bodyFont: string;
    allCaps: boolean;
    entries: string;
}

export type CellContent = { id: number; text: string; image: string | null };

export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    message: string;
    timestamp: number;
}

export const useMultiplayer = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [gameStarted, setGameStarted] = useState(false);
    const [hostId, setHostId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [shuffledCardCallback, setShuffledCardCallback] = useState<((contents: CellContent[]) => void) | null>(null);
    const [roomSettingsCallback, setRoomSettingsCallback] = useState<((settings: RoomSettings) => void) | null>(null);

    // Initialize socket
    useEffect(() => {
        const newSocket = io(SERVER_URL, {
            autoConnect: true,
        });

        setSocket(newSocket);

        newSocket.on('connect', () => {
            setIsConnected(true);
            console.log('Connected to multiplayer server');
        });

        newSocket.on('disconnect', () => {
            setIsConnected(false);
            console.log('Disconnected from server');
        });

        newSocket.on('player_joined', (player: Player) => {
            setPlayers(prev => [...prev.filter(p => p.id !== player.id), player]);
        });

        newSocket.on('player_left', ({ id }: { id: string }) => {
            setPlayers(prev => prev.filter(p => p.id !== id));
        });

        newSocket.on('player_won', ({ playerName, winType }: { playerName: string, winType: string }) => {
            alert(`${playerName} won with a ${winType}!`);
        });

        newSocket.on('game_started', () => {
            setGameStarted(true);
        });

        newSocket.on('chat_message', (msg: ChatMessage) => {
            setMessages(prev => [...prev, msg]);
        });

        return () => {
            newSocket.close();
        };
    }, []);

    // Listen for shuffled card event
    useEffect(() => {
        if (!socket) return;

        const handler = (contents: CellContent[]) => {
            if (shuffledCardCallback) {
                shuffledCardCallback(contents);
            }
        };

        socket.on('shuffled_card', handler);
        return () => { socket.off('shuffled_card', handler); };
    }, [socket, shuffledCardCallback]);

    // Listen for room settings updates (from host)
    useEffect(() => {
        if (!socket) return;

        const handler = (settings: RoomSettings) => {
            if (roomSettingsCallback) {
                roomSettingsCallback(settings);
            }
        };

        socket.on('room_settings_update', handler);
        return () => { socket.off('room_settings_update', handler); };
    }, [socket, roomSettingsCallback]);

    const onShuffledCard = useCallback((cb: (contents: CellContent[]) => void) => {
        setShuffledCardCallback(() => cb);
    }, []);

    const onRoomSettings = useCallback((cb: (settings: RoomSettings) => void) => {
        setRoomSettingsCallback(() => cb);
    }, []);

    const createRoom = useCallback((playerName: string) => {
        if (!socket) return;
        socket.emit('create_room', { hostName: playerName }, (response: any) => {
            setRoomCode(response.roomId);
            setPlayerId(response.playerId);
            setHostId(response.playerId);
            setPlayers([{ id: response.playerId, name: playerName }]);
            setGameStarted(false);
        });
    }, [socket]);

    const joinRoom = useCallback((roomId: string, playerName: string) => {
        if (!socket) return;
        socket.emit('join_room', { roomId, playerName }, (response: any) => {
            if (response.error) {
                alert(response.error);
                return;
            }
            setRoomCode(response.roomId);
            setPlayerId(response.playerId);
            setHostId(response.hostId);
            setPlayers(response.players);
            setGameStarted(false);

            // If the room already has settings, apply them
            if (response.settings && roomSettingsCallback) {
                roomSettingsCallback(response.settings);
            }
        });
    }, [socket, roomSettingsCallback]);

    const updateRoomSettings = useCallback((settings: RoomSettings) => {
        if (!socket || !roomCode) return;
        socket.emit('update_room_settings', roomCode, settings);
    }, [socket, roomCode]);

    const declareWin = useCallback((winType: string, playerName: string) => {
        if (!socket || !roomCode) return;
        socket.emit('declare_win', { roomId: roomCode, playerName, winType });
    }, [socket, roomCode]);

    const startGame = useCallback(() => {
        if (!socket || !roomCode) return;
        socket.emit('start_game', roomCode);
        setGameStarted(true);
    }, [socket, roomCode]);

    const sendMessage = useCallback((playerName: string, message: string) => {
        if (!socket || !roomCode) return;
        socket.emit('send_message', { roomId: roomCode, playerName, message });
    }, [socket, roomCode]);

    const isHost = playerId !== null && playerId === hostId;

    return {
        socket,
        isConnected,
        roomCode,
        playerId,
        players,
        gameStarted,
        isHost,
        messages,
        createRoom,
        joinRoom,
        updateRoomSettings,
        declareWin,
        startGame,
        sendMessage,
        onShuffledCard,
        onRoomSettings
    };
};
