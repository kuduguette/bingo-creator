import { useEffect, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

// URL for local Development. In production this would be dynamic.
const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Player {
    id: string;
    name: string;
}

export interface GameState {
    size: number;
    gameMode: string;
    cardTitle: string;
    subtitle: string;
    titleFont: string;
    bodyFont: string;
    allCaps: boolean;
    // We share the *content* of cells (text/image) but not the *marked* state
    cellContents: { id: number; text: string; image: string | null }[];
}

export type CellContent = { id: number; text: string; image: string | null };

export const useMultiplayer = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [gameStarted, setGameStarted] = useState(false);
    const [hostId, setHostId] = useState<string | null>(null);
    const [shuffledCardCallback, setShuffledCardCallback] = useState<((contents: CellContent[]) => void) | null>(null);

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

    const onShuffledCard = useCallback((cb: (contents: CellContent[]) => void) => {
        setShuffledCardCallback(() => cb);
    }, []);

    const createRoom = useCallback((playerName: string, cardData: CellContent[]) => {
        if (!socket) return;
        socket.emit('create_room', { hostName: playerName, cardData }, (response: any) => {
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
            setHostId(null); // Joiner is not the host
            setPlayers(response.players);
            setGameStarted(false);

            // If the room has card data, apply it to the joiner's board
            if (response.cardData && response.cardData.length > 0 && shuffledCardCallback) {
                shuffledCardCallback(response.cardData);
            }
        });
    }, [socket, shuffledCardCallback]);

    const updateGameState = useCallback((state: GameState) => {
        if (!socket || !roomCode) return;
        socket.emit('update_game_state', roomCode, state);
    }, [socket, roomCode]);

    const declareWin = useCallback((winType: string, playerName: string) => {
        if (!socket || !roomCode) return;
        socket.emit('declare_win', { roomId: roomCode, playerName, winType });
    }, [socket, roomCode]);

    const startGame = useCallback(() => {
        if (!socket || !roomCode) return;
        socket.emit('start_game', roomCode);
        setGameStarted(true); // Also set locally for the host
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
        createRoom,
        joinRoom,
        updateGameState,
        declareWin,
        startGame,
        onShuffledCard
    };
};
