import React, { useState, useEffect } from 'react';

interface MultiplayerLobbyProps {
    onCreateRoom: (name: string) => void;
    onJoinRoom: (roomId: string, name: string) => void;
    onPrintableCard: () => void;
    isConnected: boolean;
    urlRoomCode: string | null;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
    onCreateRoom,
    onJoinRoom,
    onPrintableCard,
    isConnected,
    urlRoomCode,
}) => {
    const [name, setName] = useState('');
    const [roomInput, setRoomInput] = useState('');

    useEffect(() => {
        if (urlRoomCode) setRoomInput(urlRoomCode);
    }, [urlRoomCode]);

    return (
        <div className="home-hero">
            <div className="home-brand">
                <h1 className="home-title">🎯 Bingify</h1>
                <p className="home-subtitle">Create & play bingo with friends in real time</p>
            </div>

            <div className="home-name-row">
                <label className="home-label">Your Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="home-name-input"
                    placeholder="Enter your name..."
                />
            </div>

            <div className="home-cards">
                {/* Create Room */}
                <div className="home-card home-card-create">
                    <div className="home-card-icon">🎮</div>
                    <h2 className="home-card-title">Create Room</h2>
                    <p className="home-card-desc">Host a bingo game and control the cards</p>
                    <button
                        disabled={!name || !isConnected}
                        onClick={() => onCreateRoom(name)}
                        className="home-card-btn home-btn-create"
                    >
                        Create
                    </button>
                </div>

                {/* Join Room */}
                <div className="home-card home-card-join">
                    <div className="home-card-icon">🔗</div>
                    <h2 className="home-card-title">Join Room</h2>
                    <p className="home-card-desc">Enter a code to join a friend's game</p>
                    <input
                        type="text"
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                        placeholder="CODE"
                        className="home-code-input"
                        maxLength={4}
                    />
                    <button
                        disabled={!name || !roomInput || !isConnected}
                        onClick={() => onJoinRoom(roomInput, name)}
                        className="home-card-btn home-btn-join"
                    >
                        Join
                    </button>
                </div>
            </div>

            {/* Printable Card */}
            <button className="home-printable-btn" onClick={onPrintableCard}>
                🖨️ Create a Printable Bingo Card
            </button>

            <div className="home-status">
                <span className={`home-status-dot ${isConnected ? 'online' : ''}`} />
                {isConnected ? 'Connected to server' : 'Connecting...'}
            </div>
        </div>
    );
};
