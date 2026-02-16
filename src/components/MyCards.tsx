import React from 'react';
import type { SavedCard } from '../hooks/useAuth';

interface MyCardsProps {
    cards: SavedCard[];
    onLoad: (cardId: number) => void;
    onDelete: (cardId: number) => void;
    onBack: () => void;
}

export const MyCards: React.FC<MyCardsProps> = ({ cards, onLoad, onDelete, onBack }) => {
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + 'Z');
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="my-cards-panel">
            <div className="my-cards-header">
                <button className="my-cards-back-btn" onClick={onBack}>← Back</button>
                <h2 className="my-cards-title">📂 My Saved Cards</h2>
            </div>

            {cards.length === 0 ? (
                <div className="my-cards-empty">
                    <span className="my-cards-empty-icon">📋</span>
                    <p>No saved cards yet.</p>
                    <p className="my-cards-empty-hint">Create a bingo card and click "💾 Save" to save it here.</p>
                </div>
            ) : (
                <div className="my-cards-grid">
                    {cards.map(card => (
                        <div key={card.id} className="my-card-item">
                            <div className="my-card-info">
                                <div className="my-card-title">{card.title}</div>
                                {card.subtitle && <div className="my-card-subtitle">{card.subtitle}</div>}
                                <div className="my-card-meta">
                                    {card.size}×{card.size} · {card.game_mode} · {formatDate(card.updated_at)}
                                </div>
                            </div>
                            <div className="my-card-actions">
                                <button className="my-card-load-btn" onClick={() => onLoad(card.id)}>
                                    Load
                                </button>
                                <button
                                    className="my-card-delete-btn"
                                    onClick={() => {
                                        if (window.confirm('Delete this card?')) onDelete(card.id);
                                    }}
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
