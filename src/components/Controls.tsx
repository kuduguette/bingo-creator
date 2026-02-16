import React from 'react';

const FONT_OPTIONS = [
    { label: 'Inter', value: 'Inter' },
    { label: 'Outfit', value: 'Outfit' },
    { label: 'Roboto', value: 'Roboto' },
    { label: 'Poppins', value: 'Poppins' },
    { label: 'Montserrat', value: 'Montserrat' },
    { label: 'Lato', value: 'Lato' },
    { label: 'Open Sans', value: 'Open Sans' },
    { label: 'Nunito', value: 'Nunito' },
    { label: 'Raleway', value: 'Raleway' },
    { label: 'Comic Neue', value: 'Comic Neue' },
    { label: 'Caveat', value: 'Caveat' },
    { label: 'Permanent Marker', value: 'Permanent Marker' },
    { label: 'Pacifico', value: 'Pacifico' },
    { label: 'Lobster', value: 'Lobster' },
    { label: 'Dancing Script', value: 'Dancing Script' },
    { label: 'Satisfy', value: 'Satisfy' },
    { label: 'Patrick Hand', value: 'Patrick Hand' },
    { label: 'Indie Flower', value: 'Indie Flower' },
    { label: 'Press Start 2P', value: 'Press Start 2P' },
    { label: 'Silkscreen', value: 'Silkscreen' },
    { label: 'Roboto Mono', value: 'Roboto Mono' },
    { label: 'Fira Code', value: 'Fira Code' },
    { label: 'Playfair Display', value: 'Playfair Display' },
    { label: 'Merriweather', value: 'Merriweather' },
    { label: 'Lora', value: 'Lora' },
    { label: 'Bebas Neue', value: 'Bebas Neue' },
    { label: 'Oswald', value: 'Oswald' },
    { label: 'Righteous', value: 'Righteous' },
];

interface ControlsProps {
    size: number;
    setSize: (size: number) => void;
    gameMode: string;
    setGameMode: (mode: string) => void;
    editMode: boolean;
    setEditMode: (mode: boolean) => void;
    titleFont: string;
    setTitleFont: (font: string) => void;
    bodyFont: string;
    setBodyFont: (font: string) => void;
    onReset: () => void;
    onClear: () => void;
    onShuffle: () => void;
    allCaps: boolean;
    setAllCaps: (caps: boolean) => void;
    onPrint: () => void;
    canEdit?: boolean;
    onSave?: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
    size,
    setSize,
    gameMode,
    setGameMode,
    editMode,
    setEditMode,
    titleFont,
    setTitleFont,
    bodyFont,
    setBodyFont,
    onReset,
    onClear,
    onShuffle,
    allCaps,
    setAllCaps,
    onPrint,
    canEdit = true,
    onSave,
}) => {
    return (
        <div className="controls-panel glass-panel no-print">
            {/* Row 1: Grid size + Edit toggle */}
            <div className="controls-row">
                <div className="controls-group">
                    <span className="controls-label">Grid:</span>
                    {canEdit && [3, 4, 5].map((s) => (
                        <button
                            key={s}
                            onClick={() => setSize(s)}
                            className={`btn btn-grid ${size === s ? 'active' : ''}`}
                        >
                            {s}×{s}
                        </button>
                    ))}
                </div>

                {canEdit ? (
                    <button
                        onClick={() => setEditMode(!editMode)}
                        className={`btn btn-edit ${editMode ? 'editing' : 'playing'}`}
                    >
                        {editMode ? '✏️ Editing' : '🎮 Playing'}
                    </button>
                ) : (
                    <span className="btn btn-edit playing" style={{ opacity: 0.6, cursor: 'default' }}>
                        🎮 Playing
                    </span>
                )}
            </div>

            {/* Row 2: Win mode + Fonts */}
            <div className="controls-row">
                <div className="controls-group">
                    <span className="controls-label">Win:</span>
                    <select
                        value={gameMode}
                        onChange={(e) => setGameMode(e.target.value)}
                        className="mode-select"
                    >
                        <option value="any">Any Line</option>
                        <option value="blackout">Blackout</option>
                        <option value="row">Row Only</option>
                        <option value="column">Column Only</option>
                        <option value="diagonal">Diagonal Only</option>
                    </select>
                </div>

                <div className="controls-group">
                    <span className="controls-label">Title Font:</span>
                    <select
                        value={titleFont}
                        onChange={(e) => setTitleFont(e.target.value)}
                        className="mode-select font-select"
                        style={{ fontFamily: `'${titleFont}', sans-serif` }}
                    >
                        {FONT_OPTIONS.map((f) => (
                            <option key={f.value} value={f.value} style={{ fontFamily: `'${f.value}', sans-serif` }}>
                                {f.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="controls-group">
                    <span className="controls-label">Body Font:</span>
                    <select
                        value={bodyFont}
                        onChange={(e) => setBodyFont(e.target.value)}
                        className="mode-select font-select"
                        style={{ fontFamily: `'${bodyFont}', sans-serif` }}
                    >
                        {FONT_OPTIONS.map((f) => (
                            <option key={f.value} value={f.value} style={{ fontFamily: `'${f.value}', sans-serif` }}>
                                {f.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Row 3: Actions */}
            <div className="controls-row">
                <div className="controls-group">
                    {onSave && (
                        <button onClick={onSave} className="btn btn-save">
                            💾 Save
                        </button>
                    )}
                    <button onClick={onPrint} className="btn btn-print">
                        🖨️ Save PDF
                    </button>
                    {canEdit && (
                        <>
                            <button onClick={onShuffle} className="btn">
                                🔀 Shuffle
                            </button>
                            <button onClick={() => setAllCaps(!allCaps)} className={`btn btn-caps-toggle ${allCaps ? 'active' : ''}`} title={allCaps ? 'Switch to normal case' : 'Switch to ALL CAPS'}>
                                aA
                            </button>
                            <button onClick={onReset} className="btn btn-danger">
                                Reset Marks
                            </button>
                            <button onClick={onClear} className="btn btn-danger">
                                Clear All
                            </button>
                        </>
                    )}
                    {!canEdit && (
                        <button onClick={onReset} className="btn btn-danger">
                            Reset Marks
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
