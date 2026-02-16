import React, { useState } from 'react';
import type { Player } from '../hooks/useMultiplayer';

interface RoomPanelProps {
    roomCode: string;
    players: Player[];
    isHost: boolean;
    gameStarted: boolean;
    isConnected: boolean;
    onStartGame: () => void;
    onLeave: () => void;
}

export const RoomPanel: React.FC<RoomPanelProps> = ({
    roomCode,
    players,
    isHost,
    gameStarted,
    isConnected,
    onStartGame,
    onLeave,
}) => {
    const [collapsed, setCollapsed] = useState(false);
    const [copied, setCopied] = useState(false);

    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

    const copyUrl = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const copyCode = () => {
        navigator.clipboard.writeText(roomCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (collapsed) {
        return (
            <div className="room-panel room-panel-collapsed no-print" onClick={() => setCollapsed(false)}>
                <span className="room-panel-collapsed-dot" />
                <span className="room-panel-collapsed-code">{roomCode}</span>
                <span className="room-panel-collapsed-count">👥 {players.length}</span>
            </div>
        );
    }

    return (
        <div className="room-panel no-print">
            <div className="room-panel-header">
                <div className="room-panel-title">
                    <span className="room-panel-live-dot" />
                    Room {roomCode}
                </div>
                <button className="room-panel-collapse-btn" onClick={() => setCollapsed(true)} title="Minimize">
                    ─
                </button>
            </div>

            {/* Share Section */}
            <div className="room-panel-section">
                <div className="room-panel-code-row">
                    <span className="room-panel-code">{roomCode}</span>
                    <button className="room-panel-copy-btn" onClick={copyCode} title="Copy code">
                        {copied ? '✅' : '📋'}
                    </button>
                </div>
                <button className="room-panel-share-btn" onClick={copyUrl}>
                    🔗 {copied ? 'Copied!' : 'Copy Invite Link'}
                </button>
            </div>

            {/* Players */}
            <div className="room-panel-section">
                <div className="room-panel-label">Players ({players.length})</div>
                <ul className="room-panel-players">
                    {players.map(p => (
                        <li key={p.id} className="room-panel-player">
                            <span className="room-panel-player-avatar">
                                {p.name.charAt(0).toUpperCase()}
                            </span>
                            {p.name}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Actions */}
            {!gameStarted && isHost && (
                <button className="room-panel-start-btn" onClick={onStartGame}>
                    🎯 Start Game
                </button>
            )}

            {gameStarted && (
                <div className="room-panel-status-badge">🎮 Game in progress</div>
            )}

            <div className="room-panel-footer">
                <span className={`lobby-status-dot ${isConnected ? 'online' : ''}`} />
                <span>{isConnected ? 'Connected' : 'Reconnecting...'}</span>
                <button className="room-panel-leave-btn" onClick={onLeave}>Leave</button>
            </div>
        </div>
    );
};
