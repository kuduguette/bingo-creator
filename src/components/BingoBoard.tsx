import React from 'react';
import { BingoCell } from './BingoCell';

export interface CellData {
    id: number;
    text: string;
    image: string | null;
    marked: boolean;
}

interface BingoBoardProps {
    size: number;
    cells: CellData[];
    editMode: boolean;
    onCellToggle: (id: number) => void;
    onCellUpdate: (id: number, text: string, image: string | null) => void;
    fontFamily: string;
    calledEntries?: string[];
}

export const BingoBoard: React.FC<BingoBoardProps> = ({
    size,
    cells,
    editMode,
    onCellToggle,
    onCellUpdate,
    fontFamily,
    calledEntries = [],
}) => {
    return (
        <div
            className="bingo-board glass-panel"
            style={{
                gridTemplateColumns: `repeat(${size}, 1fr)`,
                fontFamily: `'${fontFamily}', sans-serif`,
            }}
        >
            {cells.map((cell) => (
                <BingoCell
                    key={cell.id}
                    {...cell}
                    editMode={editMode}
                    gridSize={size}
                    onToggle={onCellToggle}
                    onUpdate={onCellUpdate}
                    called={calledEntries.includes(cell.text)}
                />
            ))}
        </div>
    );
};
