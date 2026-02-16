import { Router } from 'express';
import { authenticateToken } from './auth.js';
import db from './db.js';

const router = Router();

// All routes here require authentication
router.use(authenticateToken);

// ── GET /api/cards ──────────────────────────────────────────────────

router.get('/cards', (req, res) => {
    const cards = db.prepare(
        'SELECT id, title, subtitle, size, game_mode, title_font, body_font, all_caps, created_at, updated_at FROM saved_cards WHERE user_id = ? ORDER BY updated_at DESC'
    ).all(req.user.id);

    res.json({ cards });
});

// ── GET /api/cards/:id ──────────────────────────────────────────────

router.get('/cards/:id', (req, res) => {
    const card = db.prepare(
        'SELECT * FROM saved_cards WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!card) {
        return res.status(404).json({ error: 'Card not found' });
    }

    res.json({ card: { ...card, cells: JSON.parse(card.cells_json) } });
});

// ── POST /api/cards ─────────────────────────────────────────────────

router.post('/cards', (req, res) => {
    const { title, subtitle, size, gameMode, cells, titleFont, bodyFont, allCaps } = req.body;

    if (!cells || !Array.isArray(cells)) {
        return res.status(400).json({ error: 'Cells data is required' });
    }

    const result = db.prepare(
        `INSERT INTO saved_cards (user_id, title, subtitle, size, game_mode, cells_json, title_font, body_font, all_caps)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        req.user.id,
        title || 'My Bingo Card',
        subtitle || '',
        size || 5,
        gameMode || 'any',
        JSON.stringify(cells),
        titleFont || 'Inter',
        bodyFont || 'Inter',
        allCaps ? 1 : 0
    );

    res.status(201).json({
        card: {
            id: result.lastInsertRowid,
            title: title || 'My Bingo Card',
            subtitle: subtitle || '',
            size: size || 5
        }
    });
});

// ── PUT /api/cards/:id ──────────────────────────────────────────────

router.put('/cards/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM saved_cards WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
        return res.status(404).json({ error: 'Card not found' });
    }

    const { title, subtitle, size, gameMode, cells, titleFont, bodyFont, allCaps } = req.body;

    db.prepare(
        `UPDATE saved_cards SET title = ?, subtitle = ?, size = ?, game_mode = ?, cells_json = ?, title_font = ?, body_font = ?, all_caps = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`
    ).run(
        title || 'My Bingo Card',
        subtitle || '',
        size || 5,
        gameMode || 'any',
        JSON.stringify(cells || []),
        titleFont || 'Inter',
        bodyFont || 'Inter',
        allCaps ? 1 : 0,
        req.params.id,
        req.user.id
    );

    res.json({ success: true });
});

// ── DELETE /api/cards/:id ───────────────────────────────────────────

router.delete('/cards/:id', (req, res) => {
    const result = db.prepare('DELETE FROM saved_cards WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) {
        return res.status(404).json({ error: 'Card not found' });
    }
    res.json({ success: true });
});

// ── GET /api/games ──────────────────────────────────────────────────

router.get('/games', (req, res) => {
    const games = db.prepare(
        'SELECT * FROM game_history WHERE user_id = ? ORDER BY played_at DESC LIMIT 50'
    ).all(req.user.id);

    res.json({
        games: games.map(g => ({
            ...g,
            players: g.players_json ? JSON.parse(g.players_json) : []
        }))
    });
});

// ── POST /api/games (called internally by server) ───────────────────

router.post('/games', (req, res) => {
    const { roomCode, cardTitle, players, winnerName, winType } = req.body;

    db.prepare(
        `INSERT INTO game_history (user_id, room_code, card_title, players_json, winner_name, win_type)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
        req.user.id,
        roomCode || null,
        cardTitle || null,
        JSON.stringify(players || []),
        winnerName || null,
        winType || null
    );

    res.status(201).json({ success: true });
});

export default router;
