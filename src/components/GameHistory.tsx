import React from 'react';
import type { GameRecord } from '../hooks/useAuth';

interface GameHistoryProps {
    games: GameRecord[];
    onBack: () => void;
}

export const GameHistory: React.FC<GameHistoryProps> = ({ games, onBack }) => {
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + 'Z');
        return d.toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="game-history-panel">
            <div className="game-history-header">
                <button className="game-history-back-btn" onClick={onBack}>← Back</button>
                <h2 className="game-history-title">📜 Game History</h2>
            </div>

            {games.length === 0 ? (
                <div className="game-history-empty">
                    <span className="game-history-empty-icon">🎮</span>
                    <p>No games played yet.</p>
                    <p className="game-history-empty-hint">Join or host a multiplayer game to see your history here.</p>
                </div>
            ) : (
                <div className="game-history-list">
                    {games.map(game => (
                        <div key={game.id} className="game-history-item">
                            <div className="game-history-item-header">
                                <span className="game-history-card-title">{game.card_title || 'Untitled'}</span>
                                {game.room_code && (
                                    <span className="game-history-room-code">Room: {game.room_code}</span>
                                )}
                            </div>
                            <div className="game-history-item-details">
                                {game.winner_name && (
                                    <span className="game-history-winner">
                                        🏆 {game.winner_name} ({game.win_type})
                                    </span>
                                )}
                                <span className="game-history-players">
                                    👥 {game.players.map(p => p.name).join(', ') || 'Solo'}
                                </span>
                            </div>
                            <div className="game-history-date">
                                {formatDate(game.played_at)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
