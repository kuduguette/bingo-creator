import { useState, useEffect, useCallback, useRef } from 'react';
import { BingoBoard, type CellData } from './components/BingoBoard';
import { Controls } from './components/Controls';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { RoomPanel } from './components/RoomPanel';
import { MyCards } from './components/MyCards';
import { GameHistory } from './components/GameHistory';
import { AuthModal } from './components/AuthModal';
import { useMultiplayer, type CellContent, type RoomSettings } from './hooks/useMultiplayer';
import { useAuth } from './hooks/useAuth';
import { checkWin, type BingoGrid } from './utils/winLogic';
import confetti from 'canvas-confetti';
import './styles/index.css';

function App() {
  const [size, setSize] = useState(5);
  const [cells, setCells] = useState<CellData[]>([]);
  const [editMode, setEditMode] = useState(true);
  const [entries, setEntries] = useState('');
  const [gameMode, setGameMode] = useState('any');
  const [hasWon, setHasWon] = useState(false);
  const [cardTitle, setCardTitle] = useState('My Bingo Card');
  const [subtitle, setSubtitle] = useState('');
  const [titleFont, setTitleFont] = useState('Inter');
  const [bodyFont, setBodyFont] = useState('Inter');
  const [allCaps, setAllCaps] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Auth
  const {
    user, isLoggedIn, login, signup, logout,
    savedCards, gameHistory,
    fetchCards, saveCard, loadCard, deleteCard,
    fetchGames, saveGameResult
  } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [appView, setAppView] = useState<'main' | 'my-cards' | 'game-history'>('main');

  // Multiplayer — lobby is the default home view
  const [view, setView] = useState<'lobby' | 'room'>('lobby');
  const [urlRoomCode, setUrlRoomCode] = useState<string | null>(null);
  const {
    isConnected,
    roomCode,
    players,
    gameStarted,
    isHost,
    createRoom,
    joinRoom,
    updateRoomSettings,
    socket,
    declareWin,
    startGame,
    onShuffledCard,
    onRoomSettings
  } = useMultiplayer();

  // Parse comma-separated entries into trimmed array
  const parsedEntries = entries.split(',').map(e => e.trim()).filter(e => e.length > 0);

  // A card is "complete" when there are enough entries
  const isCardComplete = parsedEntries.length >= size * size;

  // Only the host can edit the card
  const canEdit = isHost;

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

  const winDismissedRef = useRef(false);

  // Check URL for ?room= parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setUrlRoomCode(roomParam.toUpperCase());
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Register the shuffled card handler (server sends unique board to each player)
  useEffect(() => {
    onShuffledCard((contents: CellContent[]) => {
      setCells(() => {
        return contents.map((c, i) => ({
          id: i,
          text: c.text,
          image: c.image,
          marked: false
        }));
      });
      setHasWon(false);
      winDismissedRef.current = false;
    });
  }, [onShuffledCard]);

  // Register the room settings handler (joiner receives host's settings)
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
    });
  }, [onRoomSettings]);

  // Auto-transition to room view when room is created/joined
  useEffect(() => {
    if (roomCode && view === 'lobby') {
      setView('room');
    }
  }, [roomCode, view]);

  // When gameStarted changes, switch to play mode
  useEffect(() => {
    if (gameStarted && editMode) {
      setEditMode(false);
    }
  }, [gameStarted, editMode]);

  // Theme toggle
  useEffect(() => {
    document.documentElement.classList.toggle('dark-theme', darkMode);
  }, [darkMode]);

  // Handle edit mode toggle — generate board when switching to play (local only)
  const handleSetEditMode = useCallback((val: boolean) => {
    if (!val && editMode && !roomCode) {
      generateBoard();
    }
    setEditMode(val);
  }, [editMode, generateBoard, roomCode]);

  // Initialize cells when size changes
  useEffect(() => {
    if (!editMode && cells.length !== size * size && !roomCode) {
      generateBoard();
    }
    setHasWon(false);
    winDismissedRef.current = false;
  }, [size]);

  // Host syncs settings to server whenever they change
  useEffect(() => {
    if (!roomCode || !isHost || !isConnected) return;
    updateRoomSettings({
      size,
      gameMode,
      cardTitle,
      subtitle,
      titleFont,
      bodyFont,
      allCaps,
      entries
    });
  }, [size, gameMode, cardTitle, subtitle, titleFont, bodyFont, allCaps, entries, roomCode, isHost, isConnected, updateRoomSettings]);

  // Check win condition
  useEffect(() => {
    if (editMode || hasWon || winDismissedRef.current) return;

    const grid: BingoGrid = [];
    for (let i = 0; i < size; i++) {
      const row = cells.slice(i * size, (i + 1) * size).map((c) => c.marked);
      grid.push(row);
    }

    const mode = gameMode as 'row' | 'column' | 'diagonal' | 'blackout' | 'any';

    if (checkWin(grid, mode)) {
      setHasWon(true);
      triggerWin();
      const myName = players.find(p => p.id === socket?.id)?.name || 'Unknown';
      if (roomCode) {
        declareWin(mode, myName);
        if (isLoggedIn) {
          saveGameResult({
            roomCode,
            cardTitle,
            players: players.map(p => ({ name: p.name })),
            winnerName: myName,
            winType: mode
          });
        }
      }
    }
  }, [cells, editMode, gameMode, size, hasWon, roomCode, declareWin, players, socket, isLoggedIn, saveGameResult, cardTitle]);

  const triggerWin = useCallback(() => {
    const fire = () => {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#22d3ee', '#818cf8', '#34d399', '#60a5fa'],
      });
    };
    fire();
    setTimeout(fire, 300);
    setTimeout(fire, 600);
  }, []);

  const handleCellToggle = (id: number) => {
    if (hasWon) return;
    setCells((prev) =>
      prev.map((c) => (c.id === id ? { ...c, marked: !c.marked } : c))
    );
  };

  const handleCellUpdate = (id: number, text: string, image: string | null) => {
    setCells((prev) =>
      prev.map((c) => (c.id === id ? { ...c, text, image } : c))
    );
  };

  const resetMarks = () => {
    setCells((prev) => prev.map((c) => ({ ...c, marked: false })));
    setHasWon(false);
    winDismissedRef.current = false;
  };

  const clearAll = () => {
    if (window.confirm('Clear all entries? This cannot be undone.')) {
      setEntries('');
      setCells([]);
      setHasWon(false);
      winDismissedRef.current = false;
    }
  };

  const shuffleCells = () => {
    generateBoard();
  };

  const dismissWin = () => {
    setHasWon(false);
    winDismissedRef.current = true;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLeaveRoom = () => {
    window.location.href = window.location.pathname;
  };

  const handleStartGame = () => {
    startGame();
  };

  return (
    <div className="app-container">
      <div className="app-header no-print">
        {/* Left: Auth */}
        <div className="header-left">
          {isLoggedIn ? (
            <div className="user-menu">
              <div className="user-avatar" title={user?.username}>
                {user?.username.charAt(0).toUpperCase()}
              </div>
              <div className="user-dropdown">
                <div className="user-dropdown-inner">
                  <div className="user-dropdown-name">{user?.username}</div>
                  <div className="user-dropdown-email">{user?.email}</div>
                  <hr className="user-dropdown-divider" />
                  <button className="user-dropdown-item" onClick={() => { setAppView('my-cards'); fetchCards(); }}>
                    📂 My Cards
                  </button>
                  <button className="user-dropdown-item" onClick={() => { setAppView('game-history'); fetchGames(); }}>
                    📜 Game History
                  </button>
                  <hr className="user-dropdown-divider" />
                  <button className="user-dropdown-item user-dropdown-logout" onClick={logout}>
                    🚪 Log Out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button className="auth-btn" onClick={() => setShowAuthModal(true)}>
              👤 Sign In
            </button>
          )}
        </div>

        <h1 className="app-title">Bingify</h1>

        {/* Right: Room status or back */}
        <div className="header-right">
          {view === 'room' && roomCode && (
            <button
              className="multiplayer-btn connected"
              onClick={handleLeaveRoom}
            >
              <span className="multiplayer-status">
                <span className="pulse-dot" />
                {roomCode}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onLogin={login}
          onSignup={signup}
        />
      )}

      {/* Views */}
      {appView === 'my-cards' ? (
        <MyCards
          cards={savedCards}
          onLoad={async (cardId) => {
            const card = await loadCard(cardId);
            if (card) {
              setSize(card.size);
              setGameMode(card.game_mode);
              setCardTitle(card.title);
              setSubtitle(card.subtitle || '');
              setTitleFont(card.title_font || 'Inter');
              setBodyFont(card.body_font || 'Inter');
              setAllCaps(!!card.all_caps);
              setEntries(card.cells.map((c: any) => c.text).filter((t: string) => t).join(', '));
              setEditMode(true);
              setAppView('main');
              setView('room'); // go to room view with loaded card if in room
            }
          }}
          onDelete={deleteCard}
          onBack={() => setAppView('main')}
        />
      ) : appView === 'game-history' ? (
        <GameHistory
          games={gameHistory}
          onBack={() => setAppView('main')}
        />
      ) : view === 'lobby' ? (
        <MultiplayerLobby
          onCreateRoom={(name: string) => {
            createRoom(name);
          }}
          onJoinRoom={joinRoom}
          isConnected={isConnected}
          urlRoomCode={urlRoomCode}
        />
      ) : (
        <>
          {/* Room Panel (floating) */}
          {roomCode && (
            <RoomPanel
              roomCode={roomCode}
              players={players}
              isHost={isHost}
              gameStarted={gameStarted}
              isConnected={isConnected}
              onStartGame={handleStartGame}
              onLeave={handleLeaveRoom}
            />
          )}

          {isHost ? (
            /* ===== HOST VIEW: Full editor ===== */
            <>
              <Controls
                size={size}
                setSize={setSize}
                gameMode={gameMode}
                setGameMode={setGameMode}
                editMode={editMode}
                setEditMode={handleSetEditMode}
                titleFont={titleFont}
                setTitleFont={setTitleFont}
                bodyFont={bodyFont}
                setBodyFont={setBodyFont}
                onReset={resetMarks}
                onClear={clearAll}
                onShuffle={shuffleCells}
                allCaps={allCaps}
                setAllCaps={setAllCaps}
                onPrint={handlePrint}
                canEdit={canEdit}
                onSave={isLoggedIn ? () => {
                  saveCard({
                    title: cardTitle,
                    subtitle,
                    size,
                    gameMode,
                    cells: parsedEntries.map((text, i) => ({ id: i, text, image: null })),
                    titleFont,
                    bodyFont,
                    allCaps
                  }).then(() => alert('Card saved!')).catch(e => alert(e.message));
                } : undefined}
              />

              {/* Printable Area */}
              <div className="printable-area" style={{ textTransform: allCaps && !editMode ? 'uppercase' : 'none' }}>
                <div className="card-title-row">
                  <input
                    className="card-title-input"
                    type="text"
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    placeholder="Enter card title..."
                    style={{ fontFamily: `'${titleFont}', sans-serif`, textTransform: allCaps && !editMode ? 'uppercase' : 'none' }}
                  />
                  <input
                    className="card-subtitle-input"
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Author / subtitle..."
                    style={{ fontFamily: `'${titleFont}', sans-serif`, textTransform: allCaps && !editMode ? 'uppercase' : 'none' }}
                  />
                </div>

                {editMode ? (
                  <div className="entries-editor">
                    <textarea
                      className="entries-textarea"
                      value={entries}
                      onChange={(e) => setEntries(e.target.value)}
                      placeholder="Enter bingo entries separated by commas, e.g.: Free Space, Dancing, Singing, Laughing, Cooking, Reading, Running..."
                      style={{ fontFamily: `'${bodyFont}', sans-serif` }}
                    />
                    <div className="entries-presets">
                      <span className="presets-label">Presets:</span>
                      {([
                        ['🔢 Numbers 1-75', 'Number Bingo', 'Classic 1-75', Array.from({ length: 75 }, (_, i) => String(i + 1)).join(', ')],
                        ['🐾 Animals', 'Animal Bingo', 'Wildlife Edition', 'Dog, Cat, Elephant, Lion, Tiger, Bear, Eagle, Dolphin, Penguin, Giraffe, Zebra, Monkey, Panda, Koala, Fox, Wolf, Rabbit, Deer, Horse, Owl, Parrot, Shark, Whale, Turtle, Snake, Frog, Butterfly, Bee, Ant, Octopus'],
                        ['🍕 Foods', 'Foodie Bingo', 'Tasty Edition', 'Pizza, Sushi, Tacos, Pasta, Burger, Ice Cream, Chocolate, Salad, Steak, Ramen, Curry, Pancakes, Waffles, Nachos, Soup, Sandwich, Hot Dog, Popcorn, Donuts, Cookies, Cake, Pie, Breadsticks, Fried Rice, Mac & Cheese, Spring Rolls, Falafel, Meatballs, Fish & Chips, Lasagna'],
                        ['🎭 Activities', 'Activity Bingo', 'Fun & Games', 'Dancing, Singing, Swimming, Hiking, Reading, Cooking, Painting, Gaming, Running, Yoga, Cycling, Surfing, Skiing, Gardening, Fishing, Camping, Knitting, Photography, Bowling, Karaoke, Baking, Skating, Climbing, Kayaking, Meditating, Juggling, Stargazing, Traveling, Volunteering, Writing'],
                        ['😊 Emotions', 'Feelings Bingo', 'Express Yourself', 'Happy, Sad, Excited, Nervous, Surprised, Angry, Grateful, Hopeful, Proud, Embarrassed, Confused, Jealous, Calm, Anxious, Amused, Bored, Content, Curious, Determined, Fearful, Inspired, Lonely, Nostalgic, Overwhelmed, Peaceful, Relieved, Shy, Silly, Thoughtful, Brave']
                      ] as [string, string, string, string][]).map(([label, title, sub, preset]) => (
                        <button
                          key={label}
                          className="preset-btn"
                          onClick={() => { setEntries(preset); setCardTitle(title); setSubtitle(sub); }}
                          title={`Load ${label} preset`}
                        >
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
                ) : (
                  <BingoBoard
                    size={size}
                    cells={cells}
                    editMode={false}
                    onCellToggle={handleCellToggle}
                    onCellUpdate={handleCellUpdate}
                    fontFamily={bodyFont}
                  />
                )}
              </div>

              <p className="tip-text no-print">
                {editMode
                  ? `✏️ Type entries separated by commas. You need at least ${size * size} for a ${size}×${size} board.`
                  : '🎮 Click a square to mark it. Get BINGO to win!'}
              </p>
            </>
          ) : (
            /* ===== JOINER VIEW: Waiting or playing ===== */
            <>
              {!gameStarted ? (
                <div className="joiner-waiting">
                  <div className="joiner-waiting-inner">
                    <div className="joiner-waiting-icon">⏳</div>
                    <h2>Waiting for Host</h2>
                    <p>The room host is setting up the bingo card.<br />Your board will appear when the game starts!</p>
                    <div className="joiner-info">
                      <div className="joiner-info-item">
                        <strong>Card:</strong> {cardTitle || 'Not set yet'}
                      </div>
                      <div className="joiner-info-item">
                        <strong>Entries:</strong> {parsedEntries.length} / {size * size} needed
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="printable-area" style={{ textTransform: allCaps ? 'uppercase' : 'none' }}>
                    <div className="card-title-row">
                      <div className="card-title-input" style={{ fontFamily: `'${titleFont}', sans-serif` }}>
                        {cardTitle}
                      </div>
                      {subtitle && (
                        <div className="card-subtitle-input" style={{ fontFamily: `'${titleFont}', sans-serif` }}>
                          {subtitle}
                        </div>
                      )}
                    </div>
                    <BingoBoard
                      size={size}
                      cells={cells}
                      editMode={false}
                      onCellToggle={handleCellToggle}
                      onCellUpdate={handleCellUpdate}
                      fontFamily={bodyFont}
                    />
                  </div>
                  <p className="tip-text no-print">
                    🎮 Click a square to mark it. Get BINGO to win!
                  </p>
                </>
              )}
            </>
          )}

          {/* Win Banner */}
          {hasWon && (
            <div className="win-banner" onClick={dismissWin}>
              <div className="win-banner-content" onClick={(e) => e.stopPropagation()}>
                <h2>🎉 BINGO!</h2>
                <p>You got a {gameMode === 'blackout' ? 'Blackout' : gameMode === 'any' ? 'Line' : gameMode}!</p>
                <button className="btn" onClick={dismissWin}>
                  Keep Playing
                </button>
              </div>
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
