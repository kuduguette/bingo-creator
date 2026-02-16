import { useState, useEffect, useCallback, useRef } from 'react';
import { BingoBoard, type CellData } from './components/BingoBoard';
import { Controls } from './components/Controls';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { RoomPanel } from './components/RoomPanel';
import { AuthModal } from './components/AuthModal';
import { MyCards } from './components/MyCards';
import { GameHistory } from './components/GameHistory';
import { useMultiplayer, type GameState, type CellContent } from './hooks/useMultiplayer';
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

  // Multiplayer
  const [view, setView] = useState<'local' | 'lobby' | 'room'>('local');
  const [urlRoomCode, setUrlRoomCode] = useState<string | null>(null);
  const {
    isConnected,
    roomCode,
    players,
    gameStarted,
    isHost,
    createRoom,
    joinRoom,
    updateGameState,
    socket,
    declareWin,
    startGame,
    onShuffledCard
  } = useMultiplayer();

  // Parse comma-separated entries into trimmed array
  const parsedEntries = entries.split(',').map(e => e.trim()).filter(e => e.length > 0);

  // A card is "complete" when there are enough entries
  const isCardComplete = parsedEntries.length >= size * size;

  // Can only go online when the card is complete AND we're in play mode
  const canGoOnline = isCardComplete && !editMode;

  // Only the host (or local/solo play) can edit the card
  const canEdit = !roomCode || isHost;

  // Generate a random board from entries
  const generateBoard = useCallback((entryList?: string[]) => {
    const pool = entryList || parsedEntries;
    if (pool.length < size * size) return;

    // Fisher-Yates shuffle the full pool, then take the first size*size
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
      setView('lobby');
      // Clean the URL without refresh
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Register the shuffled card handler
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

  // Auto-transition to room view when room is created/joined
  useEffect(() => {
    if (roomCode && view === 'lobby') {
      setView('room');
    }
  }, [roomCode, view]);

  // When gameStarted changes, switch to play mode and generate board
  useEffect(() => {
    if (gameStarted && editMode) {
      setEditMode(false);
      generateBoard();
    }
  }, [gameStarted, editMode, generateBoard]);

  // Theme toggle
  useEffect(() => {
    document.documentElement.classList.toggle('dark-theme', darkMode);
  }, [darkMode]);

  // Handle edit mode toggle — generate board when switching to play
  const handleSetEditMode = useCallback((val: boolean) => {
    if (!val && editMode) {
      // Switching from edit → play: generate board
      generateBoard();
    }
    setEditMode(val);
  }, [editMode, generateBoard]);

  // Initialize cells when size changes (only when in play mode)
  useEffect(() => {
    if (!editMode && cells.length !== size * size) {
      generateBoard();
    }
    setHasWon(false);
    winDismissedRef.current = false;
  }, [size]);

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
        // Log to game history if logged in
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

  // Sync Game State to others when editing
  useEffect(() => {
    if (roomCode && isConnected && !editMode) {
      return;
    }

    if (roomCode && isConnected && editMode) {
      const state: GameState = {
        size,
        gameMode,
        cardTitle,
        subtitle,
        titleFont,
        bodyFont,
        allCaps,
        cellContents: cells.map(c => ({ id: c.id, text: c.text, image: c.image }))
      };
      updateGameState(state);
    }
  }, [size, gameMode, cardTitle, subtitle, titleFont, bodyFont, allCaps, cells, roomCode, isConnected, editMode, updateGameState]);

  // Listen for Game State updates
  useEffect(() => {
    if (!socket) return;

    socket.on('game_state_update', (state: GameState) => {
      if (document.activeElement?.tagName === 'INPUT') return;

      setSize(state.size);
      setGameMode(state.gameMode);
      setCardTitle(state.cardTitle);
      setSubtitle(state.subtitle);
      setTitleFont(state.titleFont);
      setBodyFont(state.bodyFont);
      setAllCaps(state.allCaps);

      setCells(prev => {
        const newCells = Array.from({ length: state.size * state.size }, (_, i) => {
          const content = state.cellContents.find(c => c.id === i);
          const existing = prev.find(p => p.id === i);
          return {
            id: i,
            text: content?.text || '',
            image: content?.image || null,
            marked: existing?.marked || false
          };
        });
        return newCells;
      });
    });

    return () => {
      socket.off('game_state_update');
    };
  }, [socket]);

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
    // Reload to reset socket state cleanly
    window.location.href = window.location.pathname;
  };

  const handleStartGame = () => {
    startGame();
  };

  // Determine what multiplayer button shows
  const getMultiplayerButton = () => {
    if (view === 'lobby') {
      return (
        <button
          className="multiplayer-btn"
          onClick={() => setView('local')}
        >
          <span className="multiplayer-btn-icon">←</span>
          Back
        </button>
      );
    }
    if (view === 'room' || roomCode) {
      return (
        <button
          className="multiplayer-btn connected"
          onClick={() => setView('lobby')}
        >
          <span className="multiplayer-status">
            <span className="pulse-dot" />
            {roomCode}
          </span>
        </button>
      );
    }
    return (
      <button
        className="multiplayer-btn"
        onClick={() => setView('lobby')}
        disabled={!canGoOnline}
        title={
          editMode
            ? 'Switch to Play mode first'
            : !isCardComplete
              ? 'Fill in all bingo cells first'
              : 'Play online with friends'
        }
        style={{ opacity: canGoOnline ? 1 : 0.5 }}
      >
        <span className="multiplayer-btn-icon">🌐</span>
        Play Online
      </button>
    );
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

        <h1 className="app-title">Bingo Creator</h1>

        {/* Right: Multiplayer */}
        <div className="header-right">
          {appView === 'main' && getMultiplayerButton()}
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
              // Restore entries from cells
              setEntries(card.cells.map((c: any) => c.text).filter((t: string) => t).join(', '));
              setEditMode(true);
              setAppView('main');
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
            // Send entries as the card data for multiplayer
            const entryList = parsedEntries;
            createRoom(name, entryList.map((text, i) => ({ id: i, text, image: null })));
          }}
          onJoinRoom={joinRoom}
          isConnected={isConnected}
          urlRoomCode={urlRoomCode}
        />
      ) : (
        <>
          {/* Floating Room Panel when in a multiplayer room */}
          {roomCode && view === 'room' && (
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
            {/* Title + Subtitle */}
            <div className="card-title-row">
              <input
                className="card-title-input"
                type="text"
                value={cardTitle}
                onChange={(e) => setCardTitle(e.target.value)}
                placeholder="Enter card title..."
                readOnly={!canEdit}
                style={{ fontFamily: `'${titleFont}', sans-serif`, textTransform: allCaps && !editMode ? 'uppercase' : 'none' }}
              />
              <input
                className="card-subtitle-input"
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Author / subtitle..."
                readOnly={!canEdit}
                style={{ fontFamily: `'${titleFont}', sans-serif`, textTransform: allCaps && !editMode ? 'uppercase' : 'none' }}
              />
            </div>

            {editMode ? (
              /* ===== EDIT MODE: Comma-separated entries textarea ===== */
              <div className="entries-editor">
                <textarea
                  className="entries-textarea"
                  value={entries}
                  onChange={(e) => setEntries(e.target.value)}
                  placeholder="Enter bingo entries separated by commas, e.g.: Free Space, Dancing, Singing, Laughing, Cooking, Reading, Running..."
                  readOnly={!canEdit}
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
              /* ===== PLAY MODE: Bingo board ===== */
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
