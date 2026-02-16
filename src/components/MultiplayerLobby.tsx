import React, { useState, useEffect } from 'react';

interface MultiplayerLobbyProps {
    onCreateRoom: (name: string) => void;
    onJoinRoom: (roomId: string, name: string) => void;
    isConnected: boolean;
    urlRoomCode: string | null;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
    onCreateRoom,
    onJoinRoom,
    isConnected,
    urlRoomCode,
}) => {
    const [name, setName] = useState('');
    const [roomInput, setRoomInput] = useState('');

    // Pre-fill room code from URL parameter
    useEffect(() => {
        if (urlRoomCode) {
            setRoomInput(urlRoomCode);
        }
    }, [urlRoomCode]);



    // Join/Create view
    return (
        <div className="lobby-panel">
            <h2 className="lobby-title">
                <span className="lobby-title-icon">🌐</span>
                Multiplayer Bingo
            </h2>

            <div>
                <label className="lobby-section-label">Your Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="lobby-input"
                    placeholder="Enter your name..."
                />
            </div>

            <div className="lobby-cards">
                {/* Create Room */}
                <div className="lobby-card">
                    <div className="lobby-card-title">
                        <span>🎮</span> Create Room
                    </div>
                    <button
                        disabled={!name}
                        onClick={() => onCreateRoom(name)}
                        className="lobby-btn lobby-btn-create"
                    >
                        Create
                    </button>
                </div>

                {/* Join Room */}
                <div className="lobby-card">
                    <div className="lobby-card-title">
                        <span>🔗</span> Join Room
                    </div>
                    <input
                        type="text"
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                        placeholder="CODE"
                        className="lobby-input room-code-input"
                        maxLength={4}
                    />
                    <button
                        disabled={!name || !roomInput}
                        onClick={() => onJoinRoom(roomInput, name)}
                        className="lobby-btn lobby-btn-join"
                    >
                        Join
                    </button>
                </div>
            </div>

            <div className="lobby-status">
                <span className={`lobby-status-dot ${isConnected ? 'online' : ''}`} />
                {isConnected ? 'Server connected' : 'Connecting to server...'}
            </div>
        </div>
    );
};
