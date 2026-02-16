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
    titleFont: string;
    setTitleFont: (font: string) => void;
    bodyFont: string;
    setBodyFont: (font: string) => void;
    onShuffle: () => void;
    onClear: () => void;
    allCaps: boolean;
    setAllCaps: (caps: boolean) => void;
    onPrint: () => void;
    hideWinMode?: boolean;
    totalRounds?: number;
    setTotalRounds?: (rounds: number) => void;
}

export const Controls: React.FC<ControlsProps> = ({
    size,
    setSize,
    gameMode,
    setGameMode,
    titleFont,
    setTitleFont,
    bodyFont,
    setBodyFont,
    onShuffle,
    onClear,
    allCaps,
    setAllCaps,
    onPrint,
    hideWinMode = false,
    totalRounds,
    setTotalRounds,
}) => {
    return (
        <div className="controls-panel glass-panel no-print">
            {/* Row 1: Grid size */}
            <div className="controls-row">
                <div className="controls-group">
                    <span className="controls-label">Grid:</span>
                    {[3, 4, 5].map((s) => (
                        <button
                            key={s}
                            onClick={() => setSize(s)}
                            className={`btn btn-grid ${size === s ? 'active' : ''}`}
                        >
                            {s}×{s}
                        </button>
                    ))}
                </div>

                {!hideWinMode && (
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
                )}

                {!hideWinMode && setTotalRounds && (
                    <div className="controls-group">
                        <span className="controls-label">Rounds:</span>
                        <select
                            value={totalRounds || 1}
                            onChange={(e) => setTotalRounds(Number(e.target.value))}
                            className="mode-select"
                        >
                            {[1, 2, 3, 5, 10].map(n => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Row 2: Fonts */}
            <div className="controls-row">
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
                    <button onClick={onPrint} className="btn btn-print">
                        🖨️ Save PDF
                    </button>
                    <button onClick={onShuffle} className="btn">
                        🔀 Shuffle
                    </button>
                    <button onClick={() => setAllCaps(!allCaps)} className={`btn btn-caps-toggle ${allCaps ? 'active' : ''}`} title={allCaps ? 'Normal case' : 'ALL CAPS'}>
                        aA
                    </button>
                    <button onClick={onClear} className="btn btn-danger">
                        Clear All
                    </button>
                </div>
            </div>
        </div>
    );
};
