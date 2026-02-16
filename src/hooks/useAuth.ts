import { useState, useEffect, useCallback } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

export interface User {
    id: number;
    email: string;
    username: string;
}

export interface SavedCard {
    id: number;
    title: string;
    subtitle: string;
    size: number;
    game_mode: string;
    title_font: string;
    body_font: string;
    all_caps: number;
    created_at: string;
    updated_at: string;
    cells?: { id: number; text: string; image: string | null }[];
}

export interface GameRecord {
    id: number;
    room_code: string;
    card_title: string;
    players: { name: string }[];
    winner_name: string;
    win_type: string;
    played_at: string;
}

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
    const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);

    const isLoggedIn = !!user;

    // Helper for authenticated requests
    const authFetch = useCallback(async (path: string, options: RequestInit = {}) => {
        const currentToken = token || localStorage.getItem('bingo_token');
        return fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
                ...options.headers,
            },
        });
    }, [token]);

    // Validate token on mount
    useEffect(() => {
        const stored = localStorage.getItem('bingo_token');
        if (stored) {
            setToken(stored);
            fetch(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${stored}` },
            })
                .then(r => r.json())
                .then(data => {
                    if (data.user) {
                        setUser(data.user);
                    } else {
                        localStorage.removeItem('bingo_token');
                    }
                })
                .catch(() => {
                    localStorage.removeItem('bingo_token');
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const signup = useCallback(async (email: string, username: string, password: string) => {
        const res = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Signup failed');

        localStorage.setItem('bingo_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data;
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        localStorage.setItem('bingo_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('bingo_token');
        setToken(null);
        setUser(null);
        setSavedCards([]);
        setGameHistory([]);
    }, []);

    // ── Cards CRUD ────────────────────────────────────────────────

    const fetchCards = useCallback(async () => {
        if (!token) return;
        const res = await authFetch('/cards');
        const data = await res.json();
        if (data.cards) setSavedCards(data.cards);
    }, [token, authFetch]);

    const saveCard = useCallback(async (cardData: {
        title: string; subtitle: string; size: number; gameMode: string;
        cells: { id: number; text: string; image: string | null }[];
        titleFont: string; bodyFont: string; allCaps: boolean;
    }) => {
        const res = await authFetch('/cards', {
            method: 'POST',
            body: JSON.stringify(cardData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save card');
        await fetchCards();
        return data;
    }, [authFetch, fetchCards]);

    const loadCard = useCallback(async (cardId: number) => {
        const res = await authFetch(`/cards/${cardId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load card');
        return data.card;
    }, [authFetch]);

    const deleteCard = useCallback(async (cardId: number) => {
        const res = await authFetch(`/cards/${cardId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete card');
        await fetchCards();
    }, [authFetch, fetchCards]);

    // ── Game History ──────────────────────────────────────────────

    const fetchGames = useCallback(async () => {
        if (!token) return;
        const res = await authFetch('/games');
        const data = await res.json();
        if (data.games) setGameHistory(data.games);
    }, [token, authFetch]);

    const saveGameResult = useCallback(async (gameData: {
        roomCode: string; cardTitle: string;
        players: { name: string }[];
        winnerName: string; winType: string;
    }) => {
        await authFetch('/games', {
            method: 'POST',
            body: JSON.stringify(gameData),
        });
        await fetchGames();
    }, [authFetch, fetchGames]);

    return {
        user,
        isLoggedIn,
        loading,
        signup,
        login,
        logout,
        savedCards,
        gameHistory,
        fetchCards,
        saveCard,
        loadCard,
        deleteCard,
        fetchGames,
        saveGameResult,
    };
};
