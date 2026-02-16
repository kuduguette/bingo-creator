import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../hooks/useMultiplayer';

interface ChatPanelProps {
    messages: ChatMessage[];
    onSend: (message: string) => void;
    currentPlayerId: string | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSend, currentPlayerId }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed) return;
        onSend(trimmed);
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="chat-sidebar no-print">
            <div className="chat-header">
                <span>💬 Chat</span>
            </div>
            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-empty">No messages yet. Say hi! 👋</div>
                )}
                {messages.map((msg) => {
                    const isMe = msg.senderId === currentPlayerId;
                    return (
                        <div key={msg.id} className={`chat-msg ${isMe ? 'chat-msg-me' : 'chat-msg-other'}`}>
                            {!isMe && <span className="chat-msg-name">{msg.senderName}</span>}
                            <div className="chat-msg-bubble">{msg.message}</div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-row">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="chat-input"
                />
                <button onClick={handleSend} disabled={!input.trim()} className="chat-send-btn">
                    ➤
                </button>
            </div>
        </div>
    );
};
