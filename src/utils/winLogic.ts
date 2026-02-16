export type BingoGrid = boolean[][];

export const checkWin = (grid: BingoGrid, mode: 'row' | 'column' | 'diagonal' | 'blackout' | 'any'): boolean => {
    const size = grid.length;
    if (size === 0) return false;

    // Helpers
    const checkRow = (r: number) => grid[r].every((cell) => cell);
    const checkCol = (c: number) => grid.every((row) => row[c]);
    const checkDiag1 = () => grid.every((row, i) => row[i]);
    const checkDiag2 = () => grid.every((row, i) => row[size - 1 - i]);

    const isRowWin = () => Array.from({ length: size }).some((_, i) => checkRow(i));
    const isColWin = () => Array.from({ length: size }).some((_, i) => checkCol(i));
    const isDiagWin = () => checkDiag1() || checkDiag2();
    const isBlackout = () => grid.every((row) => row.every((cell) => cell));

    switch (mode) {
        case 'row': return isRowWin();
        case 'column': return isColWin();
        case 'diagonal': return isDiagWin();
        case 'blackout': return isBlackout();
        case 'any': return isRowWin() || isColWin() || isDiagWin() || isBlackout();
        default: return false;
    }
};
