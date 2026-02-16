import { useState, useEffect, useCallback, useRef } from 'react';
import { BingoBoard, type CellData } from './components/BingoBoard';
import { Controls } from './components/Controls';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { RoomPanel } from './components/RoomPanel';
import { ChatPanel } from './components/ChatPanel';
import { useMultiplayer, type CellContent, type RoomSettings } from './hooks/useMultiplayer';
import { checkWin, type BingoGrid } from './utils/winLogic';
import confetti from 'canvas-confetti';
import './styles/index.css';

function App() {
  const [size, setSize] = useState(5);
  const [cells, setCells] = useState<CellData[]>([]);
  const [entries, setEntries] = useState('');
  const [gameMode, setGameMode] = useState('any');
  const [hasWon, setHasWon] = useState(false);
  const [cardTitle, setCardTitle] = useState('My Bingo Card');
  const [subtitle, setSubtitle] = useState('');
  const [titleFont, setTitleFont] = useState('Inter');
  const [bodyFont, setBodyFont] = useState('Inter');
  const [allCaps, setAllCaps] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [totalRounds, setTotalRounds] = useState(1);
  const [callerEnabled, setCallerEnabled] = useState(false);

  // Views: lobby (home), room (multiplayer), printable (solo card maker)
  const [view, setView] = useState<'lobby' | 'room' | 'printable'>('lobby');
  const [urlRoomCode, setUrlRoomCode] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');

  // Bingo toast (broadcast notification)
  const [bingoToast, setBingoToast] = useState<{ name: string; type: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Multiplayer
  const {
    isConnected, roomCode, players, gameStarted, isHost, playerId,
    createRoom, joinRoom, updateRoomSettings, socket,
    declareWin, startGame, nextRound, sendMessage, messages,
    scores, currentRound, totalRounds: hookTotalRounds,
    latestScoreEvent, clearScoreEvent,
    calledEntries, currentCall, callerRemaining,
    nextCall, resetCalls,
    onShuffledCard, onRoomSettings
  } = useMultiplayer();

  const parsedEntries = entries.split(',').map(e => e.trim()).filter(e => e.length > 0);
  const isCardComplete = parsedEntries.length >= size * size;
  const winDismissedRef = useRef(false);

  // Generate a random board from entries
  const generateBoard = useCallback((entryList?: string[]) => {
    const pool = entryList || parsedEntries;
    if (pool.length < size * size) return;
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const picked = shuffled.slice(0, size * size);
    setCells(picked.map((text, i) => ({ id: i, text, image: null, marked: false })));
    setHasWon(false);
    winDismissedRef.current = false;
  }, [parsedEntries, size]);

  // URL room code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setUrlRoomCode(roomParam.toUpperCase());
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Shuffled card from server (new round or first start)
  useEffect(() => {
    onShuffledCard((contents: CellContent[]) => {
      setCells(contents.map((c, i) => ({
        id: i, text: c.text, image: c.image, marked: false
      })));
      setHasWon(false);
      winDismissedRef.current = false;
    });
  }, [onShuffledCard]);

  // Room settings from host
  useEffect(() => {
    onRoomSettings((settings: RoomSettings) => {
      setSize(settings.size);
      setGameMode(settings.gameMode);
      setCardTitle(settings.cardTitle);
      setSubtitle(settings.subtitle);
      setTitleFont(settings.titleFont);
      setBodyFont(settings.bodyFont);
      setAllCaps(settings.allCaps);
      setEntries(settings.entries);
      if (settings.totalRounds) setTotalRounds(settings.totalRounds);
      if (settings.callerEnabled !== undefined) setCallerEnabled(settings.callerEnabled);
    });
  }, [onRoomSettings]);

  // Auto-transition to room view
  useEffect(() => {
    if (roomCode && view === 'lobby') setView('room');
  }, [roomCode, view]);

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark-theme', darkMode);
  }, [darkMode]);

  // Host syncs settings (including totalRounds, callerEnabled)
  useEffect(() => {
    if (!roomCode || !isHost || !isConnected) return;
    updateRoomSettings({ size, gameMode, cardTitle, subtitle, titleFont, bodyFont, allCaps, entries, totalRounds, callerEnabled });
  }, [size, gameMode, cardTitle, subtitle, titleFont, bodyFont, allCaps, entries, totalRounds, callerEnabled, roomCode, isHost, isConnected, updateRoomSettings]);

  // Show bingo toast when someone scores
  useEffect(() => {
    if (!latestScoreEvent) return;
    const { playerName: scorerName, winType } = latestScoreEvent;
    setBingoToast({ name: scorerName, type: winType });

    // Auto-dismiss after 4 seconds
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setBingoToast(null);
      clearScoreEvent();
    }, 4000);

    // Confetti for everyone!
    const fire = () => confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#22d3ee', '#818cf8', '#34d399', '#f59e0b'] });
    fire(); setTimeout(fire, 250);

    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, [latestScoreEvent, clearScoreEvent]);

  // Check win condition
  useEffect(() => {
    if (hasWon || winDismissedRef.current || cells.length === 0) return;
    const grid: BingoGrid = [];
    for (let i = 0; i < size; i++) {
      grid.push(cells.slice(i * size, (i + 1) * size).map(c => c.marked));
    }
    const mode = gameMode as 'row' | 'column' | 'diagonal' | 'blackout' | 'any';
    if (checkWin(grid, mode)) {
      setHasWon(true);
      const myName = players.find(p => p.id === socket?.id)?.name || playerName || 'Unknown';
      if (roomCode) declareWin(mode, myName);
    }
  }, [cells, gameMode, size, hasWon, roomCode, declareWin, players, socket, playerName]);



  const handleCellToggle = (id: number) => {
    setCells(prev => prev.map(c => c.id === id ? { ...c, marked: !c.marked } : c));
  };

  const handleCellUpdate = (id: number, text: string, image: string | null) => {
    setCells(prev => prev.map(c => c.id === id ? { ...c, text, image } : c));
  };

  const resetMarks = () => {
    setCells(prev => prev.map(c => ({ ...c, marked: false })));
    setHasWon(false);
    winDismissedRef.current = false;
  };

  const clearAll = () => {
    if (window.confirm('Clear all entries?')) {
      setEntries(''); setCells([]); setHasWon(false); winDismissedRef.current = false;
    }
  };

  const dismissWin = () => { setHasWon(false); winDismissedRef.current = true; };
  const handleLeaveRoom = () => { window.location.href = window.location.pathname; };
  const handleStartGame = () => { startGame(); };
  const handleNextRound = () => { nextRound(); };

  const isLastRound = currentRound >= (hookTotalRounds || totalRounds);


  // Sort players by score for the scoreboard
  const sortedPlayers = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

  // Presets data
  const presets: [string, string, string, string][] = [
    ['🔢 Numbers 1-75', 'Number Bingo', 'Classic 1-75', Array.from({ length: 75 }, (_, i) => String(i + 1)).join(', ')],
    ['🐾 Animals', 'Animal Bingo', 'Wildlife Edition', 'Dog, Cat, Elephant, Lion, Tiger, Bear, Eagle, Dolphin, Penguin, Giraffe, Zebra, Monkey, Panda, Koala, Fox, Wolf, Rabbit, Deer, Horse, Owl, Parrot, Shark, Whale, Turtle, Snake, Frog, Butterfly, Bee, Ant, Octopus'],
    ['🍕 Foods', 'Foodie Bingo', 'Tasty Edition', 'Pizza, Sushi, Tacos, Pasta, Burger, Ice Cream, Chocolate, Salad, Steak, Ramen, Curry, Pancakes, Waffles, Nachos, Soup, Sandwich, Hot Dog, Popcorn, Donuts, Cookies, Cake, Pie, Breadsticks, Fried Rice, Mac & Cheese, Spring Rolls, Falafel, Meatballs, Fish & Chips, Lasagna'],
    ['🎭 Activities', 'Activity Bingo', 'Fun & Games', 'Dancing, Singing, Swimming, Hiking, Reading, Cooking, Painting, Gaming, Running, Yoga, Cycling, Surfing, Skiing, Gardening, Fishing, Camping, Knitting, Photography, Bowling, Karaoke, Baking, Skating, Climbing, Kayaking, Meditating, Juggling, Stargazing, Traveling, Volunteering, Writing'],
    ['😊 Emotions', 'Feelings Bingo', 'Express Yourself', 'Happy, Sad, Excited, Nervous, Surprised, Angry, Grateful, Hopeful, Proud, Embarrassed, Confused, Jealous, Calm, Anxious, Amused, Bored, Content, Curious, Determined, Fearful, Inspired, Lonely, Nostalgic, Overwhelmed, Peaceful, Relieved, Shy, Silly, Thoughtful, Brave']
  ];

  // Reusable JSX fragments
  const entriesEditorJSX = (
    <div className="entries-editor">
      <textarea
        className="entries-textarea"
        value={entries}
        onChange={(e) => setEntries(e.target.value)}
        placeholder="Enter bingo entries separated by commas, e.g.: Free Space, Dancing, Singing, Laughing..."
        style={{ fontFamily: `'${bodyFont}', sans-serif` }}
      />
      <div className="entries-presets">
        <span className="presets-label">Presets:</span>
        {presets.map(([label, title, sub, preset]) => (
          <button key={label} className="preset-btn" onClick={() => { setEntries(preset); setCardTitle(title); setSubtitle(sub); }}>
            {label}
          </button>
        ))}
      </div>
      <div className="entries-status">
        <span className={`entries-count ${isCardComplete ? 'enough' : 'not-enough'}`}>
          {parsedEntries.length} entr{parsedEntries.length === 1 ? 'y' : 'ies'}
        </span>
        <span className="entries-needed">
          {isCardComplete
            ? `✅ Ready! (need ${size * size}, have ${parsedEntries.length})`
            : `Need at least ${size * size} entries (${size * size - parsedEntries.length} more)`}
        </span>
      </div>
    </div>
  );

  const editableTitleJSX = (
    <div className="card-title-row">
      <input className="card-title-input" type="text" value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} placeholder="Card title..." style={{ fontFamily: `'${titleFont}', sans-serif`, textTransform: allCaps ? 'uppercase' : 'none' }} />
      <input className="card-subtitle-input" type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtitle..." style={{ fontFamily: `'${titleFont}', sans-serif`, textTransform: allCaps ? 'uppercase' : 'none' }} />
    </div>
  );

  const readonlyTitleJSX = (
    <div className="card-title-row">
      <div className="card-title-input" style={{ fontFamily: `'${titleFont}', sans-serif`, textTransform: allCaps ? 'uppercase' : 'none' }}>{cardTitle}</div>
      {subtitle && <div className="card-subtitle-input" style={{ fontFamily: `'${titleFont}', sans-serif`, textTransform: allCaps ? 'uppercase' : 'none' }}>{subtitle}</div>}
    </div>
  );

  // Scoreboard JSX (shown during game)
  const scoreboardJSX = gameStarted && players.length > 0 && (
    <div className="scoreboard no-print">
      <div className="scoreboard-header">
        <span>🏆 Scoreboard</span>
        <span className="scoreboard-round">Round {currentRound} / {hookTotalRounds || totalRounds}</span>
      </div>
      <div className="scoreboard-list">
        {sortedPlayers.map((p, idx) => (
          <div key={p.id} className={`scoreboard-row ${p.id === playerId ? 'scoreboard-me' : ''}`}>
            <span className="scoreboard-rank">{idx === 0 && (scores[p.id] || 0) > 0 ? '👑' : `#${idx + 1}`}</span>
            <span className="scoreboard-name">{p.name}{p.id === playerId ? ' (You)' : ''}</span>
            <span className="scoreboard-score">{scores[p.id] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <div className="app-header no-print">
        <div className="header-left">
          {view !== 'lobby' && (
            <button className="back-btn" onClick={view === 'room' ? handleLeaveRoom : () => setView('lobby')}>
              ← Back
            </button>
          )}
        </div>
        <h1 className="app-title">Bingify</h1>
        <div className="header-right">
          {view === 'room' && roomCode && (
            <button className="multiplayer-btn connected" onClick={handleLeaveRoom}>
              <span className="multiplayer-status"><span className="pulse-dot" />{roomCode}</span>
            </button>
          )}
        </div>
      </div>

      {/* ===== HOME / LOBBY ===== */}
      {view === 'lobby' && (
        <MultiplayerLobby
          onCreateRoom={(name: string) => { setPlayerName(name); createRoom(name); }}
          onJoinRoom={(roomId: string, name: string) => { setPlayerName(name); joinRoom(roomId, name); }}
          onPrintableCard={() => setView('printable')}
          isConnected={isConnected}
          urlRoomCode={urlRoomCode}
        />
      )}

      {/* ===== MULTIPLAYER ROOM ===== */}
      {view === 'room' && (
        <>
          {roomCode && (
            <RoomPanel
              roomCode={roomCode} players={players} isHost={isHost}
              gameStarted={gameStarted} isConnected={isConnected}
              onStartGame={handleStartGame} onLeave={handleLeaveRoom}
            />
          )}

          {/* Scoreboard (visible during game) */}
          {scoreboardJSX}

          {isHost && !gameStarted ? (
            <>
              <Controls
                size={size} setSize={setSize} gameMode={gameMode} setGameMode={setGameMode}
                titleFont={titleFont} setTitleFont={setTitleFont} bodyFont={bodyFont} setBodyFont={setBodyFont}
                onShuffle={() => generateBoard()} allCaps={allCaps} setAllCaps={setAllCaps}
                onPrint={() => window.print()} onClear={clearAll}
                totalRounds={totalRounds} setTotalRounds={setTotalRounds}
              />
              <div className="caller-toggle-row no-print">
                <label className="caller-toggle-label">
                  <input type="checkbox" checked={callerEnabled} onChange={(e) => setCallerEnabled(e.target.checked)} />
                  <span>🎙️ Enable Bingo Caller</span>
                  <span className="caller-toggle-hint">Randomly draws entries one at a time for calling out</span>
                </label>
              </div>
              <div className="printable-area">
                {editableTitleJSX}
                {entriesEditorJSX}
              </div>
              <p className="tip-text no-print">
                ✏️ Add at least {size * size} entries, then press Start Game in the room panel.
              </p>
            </>
          ) : !gameStarted ? (
            <div className="joiner-waiting">
              <div className="joiner-waiting-inner">
                <div className="joiner-waiting-icon">⏳</div>
                <h2>Waiting for Host</h2>
                <p>The host is setting up the bingo card.<br />Your board will appear when the game starts!</p>
                <div className="joiner-info">
                  <div className="joiner-info-item"><strong>Card:</strong> {cardTitle || 'Not set yet'}</div>
                  <div className="joiner-info-item"><strong>Entries:</strong> {parsedEntries.length} / {size * size} needed</div>
                  <div className="joiner-info-item"><strong>Rounds:</strong> {totalRounds}</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Caller Panel */}
              {callerEnabled && (
                <div className="caller-panel no-print">
                  <div className="caller-header">
                    <span>🎙️ Bingo Caller</span>
                    <span className="caller-count">{calledEntries.length} called · {callerRemaining} left</span>
                  </div>
                  {currentCall ? (
                    <div className="caller-current">
                      <div className="caller-current-label">Now calling:</div>
                      <div className="caller-current-entry">{currentCall}</div>
                    </div>
                  ) : (
                    <div className="caller-current">
                      <div className="caller-current-label">Press &quot;Next&quot; to draw an entry</div>
                    </div>
                  )}
                  {calledEntries.length > 0 && (
                    <div className="caller-history">
                      <div className="caller-history-label">Previously called:</div>
                      <div className="caller-history-list">
                        {[...calledEntries].reverse().slice(1).map((e, i) => (
                          <span key={i} className="caller-history-item">{e}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {isHost && (
                    <div className="caller-actions">
                      <button className="btn btn-caller-next" onClick={nextCall} disabled={callerRemaining === 0 && calledEntries.length > 0}>
                        🎲 Next
                      </button>
                      <button className="btn btn-caller-reset" onClick={resetCalls}>
                        🔄 Reset
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="printable-area" style={{ textTransform: allCaps ? 'uppercase' : 'none' }}>
                {readonlyTitleJSX}
                <BingoBoard size={size} cells={cells} editMode={false} onCellToggle={handleCellToggle} onCellUpdate={handleCellUpdate} fontFamily={bodyFont} calledEntries={callerEnabled ? calledEntries : []} />
              </div>
              <div className="game-controls no-print">
                <button onClick={resetMarks} className="btn btn-danger">Reset Marks</button>
                {isHost && !isLastRound && (
                  <button onClick={handleNextRound} className="btn btn-next-round">
                    ▶ Next Round ({currentRound + 1}/{hookTotalRounds || totalRounds})
                  </button>
                )}
              </div>
              <p className="tip-text no-print">
                🎮 Round {currentRound} of {hookTotalRounds || totalRounds} — Click a square to mark it!
              </p>
            </>
          )}

          {/* Bingo toast (broadcast) */}
          {bingoToast && (
            <div className="bingo-toast" onClick={() => setBingoToast(null)}>
              <div className="bingo-toast-content">
                <span className="bingo-toast-emoji">🎉</span>
                <span><strong>{bingoToast.name}</strong> got BINGO! ({bingoToast.type})</span>
              </div>
            </div>
          )}

          {/* Win banner for yourself */}
          {hasWon && (
            <div className="win-banner" onClick={dismissWin}>
              <div className="win-banner-content" onClick={(e) => e.stopPropagation()}>
                <h2>🎉 BINGO!</h2>
                <p>You got a {gameMode === 'blackout' ? 'Blackout' : gameMode === 'any' ? 'Line' : gameMode}!</p>
                <button className="btn" onClick={dismissWin}>Keep Playing</button>
              </div>
            </div>
          )}

          <ChatPanel
            messages={messages}
            onSend={(msg) => sendMessage(playerName, msg)}
            currentPlayerId={playerId}
          />
        </>
      )}

      {/* ===== PRINTABLE CARD CREATOR ===== */}
      {view === 'printable' && (
        <>
          <Controls
            size={size} setSize={setSize} gameMode={gameMode} setGameMode={setGameMode}
            titleFont={titleFont} setTitleFont={setTitleFont} bodyFont={bodyFont} setBodyFont={setBodyFont}
            onShuffle={() => generateBoard()} allCaps={allCaps} setAllCaps={setAllCaps}
            onPrint={() => window.print()} onClear={clearAll} hideWinMode
          />
          <div className="printable-area" style={{ textTransform: allCaps ? 'uppercase' : 'none' }}>
            {editableTitleJSX}
            {cells.length > 0 ? (
              <BingoBoard size={size} cells={cells} editMode={false} onCellToggle={handleCellToggle} onCellUpdate={handleCellUpdate} fontFamily={bodyFont} />
            ) : (
              entriesEditorJSX
            )}
          </div>
          {cells.length === 0 ? (
            <div className="printable-actions no-print">
              {isCardComplete && (
                <button className="btn btn-generate" onClick={() => generateBoard()}>
                  🎲 Generate Card
                </button>
              )}
              <p className="tip-text">
                ✏️ Add at least {size * size} entries for a {size}×{size} board, then generate!
              </p>
            </div>
          ) : (
            <div className="printable-actions no-print">
              <button className="btn" onClick={() => generateBoard()}>🔀 Shuffle</button>
              <button className="btn" onClick={() => setCells([])}>✏️ Edit Entries</button>
              <button className="btn btn-print" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
            </div>
          )}
        </>
      )}

      <button className="theme-toggle-btn no-print" onClick={() => setDarkMode(!darkMode)} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
        {darkMode ? '☀️' : '🌙'}
      </button>
    </div>
  );
}

export default App;
