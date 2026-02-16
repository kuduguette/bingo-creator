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
    totalRounds: number;
    callerEnabled: boolean;
}

export type CellContent = { id: number; text: string; image: string | null };

export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    message: string;
    timestamp: number;
}

export interface ScoreEvent {
    playerId: string;
    playerName: string;
    winType: string;
    scores: Record<string, number>;
    currentRound: number;
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
    const [scores, setScores] = useState<Record<string, number>>({});
    const [currentRound, setCurrentRound] = useState(0);
    const [totalRounds, setTotalRounds] = useState(1);
    const [latestScoreEvent, setLatestScoreEvent] = useState<ScoreEvent | null>(null);
    const [calledEntries, setCalledEntries] = useState<string[]>([]);
    const [currentCall, setCurrentCall] = useState<string | null>(null);
    const [callerRemaining, setCallerRemaining] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [shuffledCardCallback, setShuffledCardCallback] = useState<((contents: CellContent[]) => void) | null>(null);
    const [roomSettingsCallback, setRoomSettingsCallback] = useState<((settings: RoomSettings) => void) | null>(null);

    // Initialize socket
    useEffect(() => {
        const newSocket = io(SERVER_URL, { autoConnect: true });
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

        newSocket.on('player_left', ({ id, scores: newScores }: { id: string; scores: Record<string, number> }) => {
            setPlayers(prev => prev.filter(p => p.id !== id));
            if (newScores) setScores(newScores);
        });

        newSocket.on('game_started', ({ currentRound: round, totalRounds: total, scores: s }: { currentRound: number; totalRounds: number; scores: Record<string, number> }) => {
            setGameStarted(true);
            setCurrentRound(round);
            setTotalRounds(total);
            setScores(s);
        });

        newSocket.on('player_scored', (event: ScoreEvent) => {
            setScores(event.scores);
            setLatestScoreEvent(event);
        });

        newSocket.on('new_round', ({ currentRound: round, totalRounds: total, scores: s }: { currentRound: number; totalRounds: number; scores: Record<string, number> }) => {
            setCurrentRound(round);
            setTotalRounds(total);
            setScores(s);
        });

        newSocket.on('chat_message', (msg: ChatMessage) => {
            setMessages(prev => [...prev, msg]);
        });

        newSocket.on('entry_called', ({ entry, calledEntries: called, remaining }: { entry: string; calledEntries: string[]; remaining: number }) => {
            setCurrentCall(entry);
            setCalledEntries(called);
            setCallerRemaining(remaining);
        });

        newSocket.on('calls_reset', () => {
            setCalledEntries([]);
            setCurrentCall(null);
            setCallerRemaining(0);
        });

        newSocket.on('game_over', ({ scores: s }: { scores: Record<string, number> }) => {
            setScores(s);
            setGameOver(true);
        });

        return () => { newSocket.close(); };
    }, []);

    // Listen: shuffled card
    useEffect(() => {
        if (!socket) return;
        const handler = (contents: CellContent[]) => {
            if (shuffledCardCallback) shuffledCardCallback(contents);
        };
        socket.on('shuffled_card', handler);
        return () => { socket.off('shuffled_card', handler); };
    }, [socket, shuffledCardCallback]);

    // Listen: room settings updates
    useEffect(() => {
        if (!socket) return;
        const handler = (settings: RoomSettings) => {
            if (roomSettingsCallback) roomSettingsCallback(settings);
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
            setScores({});
            setCurrentRound(0);
            setCalledEntries([]);
            setCurrentCall(null);
            setGameOver(false);
        });
    }, [socket]);

    const joinRoom = useCallback((roomId: string, playerName: string) => {
        if (!socket) return;
        socket.emit('join_room', { roomId, playerName }, (response: any) => {
            if (response.error) { alert(response.error); return; }
            setRoomCode(response.roomId);
            setPlayerId(response.playerId);
            setHostId(response.hostId);
            setPlayers(response.players);
            setGameStarted(response.gameStarted || false);
            setScores(response.scores || {});
            setCurrentRound(response.currentRound || 0);
            if (response.settings && roomSettingsCallback) {
                roomSettingsCallback(response.settings);
                setTotalRounds(response.settings.totalRounds || 1);
            }
            setCalledEntries(response.calledEntries || []);
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
    }, [socket, roomCode]);

    const nextRound = useCallback(() => {
        if (!socket || !roomCode) return;
        socket.emit('next_round', roomCode);
    }, [socket, roomCode]);

    const sendMessage = useCallback((playerName: string, message: string) => {
        if (!socket || !roomCode) return;
        socket.emit('send_message', { roomId: roomCode, playerName, message });
    }, [socket, roomCode]);

    const clearScoreEvent = useCallback(() => {
        setLatestScoreEvent(null);
    }, []);

    const nextCall = useCallback(() => {
        if (!socket || !roomCode) return;
        socket.emit('next_call', roomCode);
    }, [socket, roomCode]);

    const resetCalls = useCallback(() => {
        if (!socket || !roomCode) return;
        socket.emit('reset_calls', roomCode);
    }, [socket, roomCode]);

    const isHost = playerId !== null && playerId === hostId;

    return {
        socket, isConnected, roomCode, playerId, players,
        gameStarted, gameOver, isHost, messages,
        scores, currentRound, totalRounds, latestScoreEvent,
        calledEntries, currentCall, callerRemaining,
        createRoom, joinRoom, updateRoomSettings, declareWin,
        startGame, nextRound, sendMessage, clearScoreEvent,
        nextCall, resetCalls,
        onShuffledCard, onRoomSettings
    };
};
