import React, { useRef } from 'react';

function getCellFontSize(gridSize: number): string {
    if (gridSize <= 3) return '1.1rem';
    if (gridSize <= 4) return '0.95rem';
    return '0.85rem';
}

interface BingoCellProps {
    id: number;
    text: string;
    image: string | null;
    marked: boolean;
    editMode: boolean;
    gridSize: number;
    onToggle: (id: number) => void;
    onUpdate: (id: number, text: string, image: string | null) => void;
    called?: boolean;
}

export const BingoCell: React.FC<BingoCellProps> = ({
    id,
    text,
    image,
    marked,
    editMode,
    gridSize,
    onToggle,
    onUpdate,
    called = false,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onUpdate(id, text, reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(id, e.target.value, image);
    };

    const handleClick = () => {
        if (!editMode) {
            onToggle(id);
        }
    };

    const cellClasses = [
        'bingo-cell',
        marked && !editMode ? 'marked' : '',
        editMode ? 'edit-mode' : '',
        called && !marked && !editMode ? 'called' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={cellClasses} onClick={handleClick}>
            {/* Background Image */}
            {image && (
                <div
                    className="cell-bg-image"
                    style={{ backgroundImage: `url(${image})` }}
                />
            )}

            {/* Marked overlay */}
            {marked && !editMode && <div className="cell-marked-overlay" />}

            {/* Check mark when marked */}
            {marked && !editMode && <span className="cell-check">✕</span>}

            {/* Content */}
            <div className="cell-content">
                {editMode ? (
                    <div className="cell-edit-wrapper">
                        <textarea
                            className="cell-textarea"
                            placeholder="Type here..."
                            value={text}
                            onChange={handleTextChange}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="cell-btn-row">
                            {image && (
                                <button
                                    className="cell-upload-btn cell-remove-img-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdate(id, text, null);
                                    }}
                                    title="Remove Image"
                                >
                                    ✕
                                </button>
                            )}
                            <button
                                className="cell-upload-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                }}
                                title="Upload Image"
                            >
                                📷
                            </button>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>
                ) : (
                    <span className="cell-text" style={{ fontSize: getCellFontSize(gridSize) }}>
                        {text}
                    </span>
                )}
            </div>
        </div>
    );
};
