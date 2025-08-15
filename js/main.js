// main.js - App Initialization and UI Handlers with FIXED Timer Logic

// Game state
let gameState = 'lobby';
window.gameState = gameState; // Make globally accessible

let timeLeft = 30;
let timerInterval = null;

// Timer functions
function startTimer() {
    console.log('=== START TIMER CALLED ===');
    
    // Clear any existing timer first
    if (window.timerInterval) {
        console.log('Clearing existing timer');
        clearInterval(window.timerInterval);
        window.timerInterval = null;
    }
    
    // Only start timer if game is actually playing
    if (gameState !== 'playing') {
        console.log('Not starting timer - gameState is:', gameState);
        return;
    }
    
    timeLeft = 30; // FIXED: was TURN_TIME_LIMIT || 30, but TURN_TIME_LIMIT is undefined
    console.log('Timer started with', timeLeft, 'seconds');
    updateTimerDisplay();
    
    // Show timer container when starting
    const timerContainer = document.querySelector('.timer-container');
    if (timerContainer) {
        timerContainer.style.display = 'block';
    }

    window.timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        console.log('Timer tick:', timeLeft);
        
        if (timeLeft <= 0) {
            console.log('TIMER EXPIRED!');
            clearInterval(window.timerInterval);
            window.timerInterval = null;
            
            // Check if it's the active player's turn
            const isActive = window.isActivePlayer && window.isActivePlayer();
            console.log('Is active player?', isActive);
            
            if (window.isMultiplayer && isActive) {
                console.log('Calling handleTimeOut for active player');
                handleTimeOut();
            }
        }
    }, 1000);
}

function resetGameTimer() {
    console.log('=== RESET GAME TIMER CALLED ===');
    
    if (window.timerInterval) {
        clearInterval(window.timerInterval);
        window.timerInterval = null;
    }
    
    // Check who should have the timer now
    const isActive = window.isActivePlayer && window.isActivePlayer();
    console.log('After reset - is active player?', isActive);
    
    // Only restart if it's the active player's turn and game is playing
    if (gameState === 'playing' && isActive) {
        console.log('Restarting timer for active player');
        startTimer();
    } else {
        console.log('Not restarting timer - either not playing or not active');
        // Show waiting indicator for non-active player
        const timerEl = document.getElementById('timer');
        if (timerEl && !isActive && gameState === 'playing') {
            timerEl.textContent = '⏳';
            timerEl.style.color = '#94a3b8';
            timerEl.style.animation = 'none';
        }
    }
}

function stopGameTimer() {
    console.log('=== STOP GAME TIMER CALLED ===');
    
    if (window.timerInterval) {
        clearInterval(window.timerInterval);
        window.timerInterval = null;
    }
    
    // Hide timer container when stopping
    const timerContainer = document.querySelector('.timer-container');
    if (timerContainer) {
        timerContainer.style.display = 'none';
    }
    
    // Reset time left
    timeLeft = 30; // FIXED: was TURN_TIME_LIMIT || 30, but TURN_TIME_LIMIT is undefined
}

function updateTimerDisplay() {
    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.textContent = timeLeft;
        
        // Change color based on time left
        if (timeLeft <= 5) {
            timerEl.style.color = '#ff0000';
            timerEl.style.animation = 'pulse 0.5s infinite';
        } else if (timeLeft <= 10) {
            timerEl.style.color = '#ff6b6b';
            timerEl.style.animation = 'none';
        } else {
            timerEl.style.color = 'white';
            timerEl.style.animation = 'none';
        }
    }
}

function handleTimeOut() {
    console.log('=== HANDLE TIMEOUT CALLED ===');
    
    if (gameState !== 'playing') {
        console.log('Not handling timeout - game not playing');
        return;
    }
    
    // Prevent multiple timeouts
    if (window.handlingTimeout) { // FIXED: removed gameData dependency
        console.log('Already handling timeout');
        return;
    }
    
    window.handlingTimeout = true;
    
    console.log('TIMER EXPIRED - PLAYER FORFEITS!');
    console.log('Current player (isHost):', window.isHost);
    
    // Stop any running timers
    stopGameTimer();
    
    // Determine winner based on who ran out of time
    let forfeitWinner;
    if (window.isHost) {
        // Host ran out of time, opponent wins
        forfeitWinner = 'opponent';
        console.log('Host forfeits - opponent wins');
    } else {
        // Guest ran out of time, host wins
        forfeitWinner = 'player';
        console.log('Guest forfeits - host (player) wins');
    }
    
    // Update game data
    if (window.gameData) {
        window.gameData.isGameOver = true;
        window.gameData.winner = forfeitWinner;
        window.gameData.timeoutLoss = true;
        window.gameData.loserAddress = window.wallet ? window.wallet.publicKey.toString() : '';
        
        console.log('Game data updated - winner:', forfeitWinner);
    }
    
    // Send timeout forfeit to other player
    if (window.sendGameMove) {
        console.log('Sending timeout forfeit to opponent');
        window.sendGameMove({
            type: 'timeout',
            winner: forfeitWinner,
            gameData: window.gameData
        });
    }
    
    // Show timeout loss screen
    setTimeout(() => {
        window.handlingTimeout = false;
        console.log('Showing timeout end screen - player lost');
        endGameWithTimeout(false); // Current player lost
    }, 500);
}

// New function for timeout game end
function endGameWithTimeout(isWinner) {
    console.log('=== END GAME WITH TIMEOUT ===');
    console.log('Is winner?', isWinner);
    
    // Stop timer
    if (window.stopGameTimer) {
        window.stopGameTimer();
    }
    
    // Clear any intervals
    if (window.timerInterval) {
        clearInterval(window.timerInterval);
        window.timerInterval = null;
    }
    
    // Create timeout victory/defeat screen
    const existingScreen = document.getElementById('gameOverScreen');
    if (existingScreen) {
        existingScreen.remove();
    }
    
    const timeoutDiv = document.createElement('div');
    timeoutDiv.id = 'gameOverScreen';
    timeoutDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1e3c72 0%, #2a4e7c 100%);
        border: 3px solid ${isWinner ? '#ffd700' : '#ef4444'};
        border-radius: 20px;
        padding: 40px;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
        min-width: 400px;
    `;
    
    let content = `
        <h1 style="color: ${isWinner ? '#ffd700' : '#ef4444'}; font-size: 36px; margin-bottom: 20px;">
            ${isWinner ? '🎉 Victory!' : '⏰ Time Out!'}
        </h1>
        <p style="color: white; font-size: 24px; margin-bottom: 20px;">
            ${isWinner ? 'Opponent ran out of time!' : 'You ran out of time!'}
        </p>
        <p style="color: ${isWinner ? '#4ade80' : '#94a3b8'}; font-size: 20px; margin-bottom: 30px;">
            ${isWinner ? 'You won 0.198 SOL!' : 'You lost the game'}
        </p>
    `;
    
    // Add payout section for winner
    if (isWinner && window.isMultiplayer) {
        content += `
            <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 20px; margin: 20px 0;">
                <p id="payoutStatusText" style="color: #fbbf24; font-size: 18px; margin-bottom: 15px;">
                    ⏳ Processing payout...
                </p>
                <div id="txLinkContainer" style="display: none;">
                    <a id="txLink" href="#" target="_blank" style="
                        display: inline-block;
                        background: #4ecdc4;
                        color: #000;
                        padding: 10px 20px;
                        border-radius: 8px;
                        text-decoration: none;
                        font-weight: 600;
                        margin-top: 10px;
                    ">View Transaction on Solscan →</a>
                </div>
            </div>
        `;
    }
    
    content += `
        <button id="returnLobbyBtn" style="
            background: #ff6b6b;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 18px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            margin-top: 20px;
        " onclick="window.returnToLobbyFromGame()">
            Return to Lobby
        </button>
    `;
    
    timeoutDiv.innerHTML = content;
    document.body.appendChild(timeoutDiv);
    
    // Handle payout for winner
    if (isWinner && window.isMultiplayer && window.handleGameEnd) {
        window.handleGameEnd(true).then((txSignature) => {
            const statusText = document.getElementById('payoutStatusText');
            const txLinkContainer = document.getElementById('txLinkContainer');
            const txLink = document.getElementById('txLink');
            
            if (txSignature) {
                if (statusText) {
                    statusText.textContent = '✅ Payout confirmed!';
                    statusText.style.color = '#4ade80';
                }
                
                if (txLinkContainer && txLink) {
                    txLink.href = `https://solscan.io/tx/${txSignature}?cluster=devnet`;
                    txLinkContainer.style.display = 'block';
                }
            }
        }).catch((error) => {
            const statusText = document.getElementById('payoutStatusText');
            if (statusText) {
                statusText.textContent = '❌ Payout failed';
                statusText.style.color = '#ef4444';
            }
        });
    }
}

// CRITICAL FIX: Robust isActivePlayer function that handles state mismatches
window.isActivePlayer = function() {
    console.log('🎯 ROBUST isActivePlayer called');
    
    if (!window.gameData || !window.isMultiplayer) {
        console.log('🎯 ROBUST: No game data or not multiplayer');
        return false;
    }
    
    const battleArea = window.gameData.battleArea || [];
    const isHost = window.isHost;
    const currentTurn = window.gameData.currentTurn;
    const gamePhase = window.gameData.gamePhase;
    
    console.log('🎯 ROBUST: battleArea length:', battleArea.length);
    console.log('🎯 ROBUST: currentTurn:', currentTurn, 'isHost:', isHost);
    console.log('🎯 ROBUST: gamePhase:', gamePhase);
    
    // Check if there are visual cards on the battle area (DOM check)
    const battleAreaEl = document.getElementById('battleArea');
    const visualCards = battleAreaEl ? battleAreaEl.querySelectorAll('.attack-pair').length : 0;
    console.log('🎯 ROBUST: Visual cards on screen:', visualCards);
    
    // Use multiple indicators to determine who should be active
    let shouldBeActive = false;
    
    // Method 1: Use game phase (most reliable when working)
    if (gamePhase === 'defending') {
        // Someone needs to defend
        shouldBeActive = (currentTurn === 'player' && !isHost) || (currentTurn === 'opponent' && isHost);
        console.log('🎯 ROBUST: Phase=defending, shouldBeActive:', shouldBeActive);
    } 
    else if (gamePhase === 'attacking') {
        // Someone needs to attack
        shouldBeActive = (currentTurn === 'player' && isHost) || (currentTurn === 'opponent' && !isHost);
        console.log('🎯 ROBUST: Phase=attacking, shouldBeActive:', shouldBeActive);
    }
    
    // Method 2: Visual fallback - if there are cards on screen but battleArea is empty
    if (visualCards > 0 && battleArea.length === 0) {
        console.log('🎯 ROBUST: Visual/state mismatch detected! Using visual fallback');
        // If there are visual cards but state says no cards, assume defending phase
        shouldBeActive = (currentTurn === 'player' && !isHost) || (currentTurn === 'opponent' && isHost);
        console.log('🎯 ROBUST: Visual fallback shouldBeActive:', shouldBeActive);
    }
    
    // Method 3: Battle area fallback
    else if (battleArea.length > 0) {
        console.log('🎯 ROBUST: Using battleArea logic');
        shouldBeActive = (currentTurn === 'opponent' && !isHost) || (currentTurn === 'player' && isHost);
        console.log('🎯 ROBUST: BattleArea shouldBeActive:', shouldBeActive);
    }
    
    // Method 4: Last resort - check the "Take Cards" button visibility
    const takeBtn = document.getElementById('takeBtn');
    const takeBtnVisible = takeBtn && takeBtn.style.display !== 'none';
    if (takeBtnVisible) {
        console.log('🎯 ROBUST: Take button is visible - I should be defending!');
        shouldBeActive = true;
    }
    
    console.log('🎯 ROBUST: FINAL shouldBeActive:', shouldBeActive);
    return shouldBeActive;
};

// Start game (for single player mode or after multiplayer setup)
function startGame() {
    try {
        console.log('=== STARTING GAME ===');
        
        document.getElementById('gameLobby').style.display = 'none';
        document.getElementById('gameBoard').style.display = 'block';
        gameState = 'playing';
        window.gameState = 'playing'; // Make sure it's globally set
        
        // Force timer container to be visible
        const timerContainer = document.querySelector('.timer-container');
        if (timerContainer) {
            timerContainer.style.display = 'block';
            console.log('Timer container forced visible on game start');
        }
        
        // Initialize timer display
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            timerEl.style.display = 'block';
            timerEl.style.fontSize = '24px';
            // Show waiting indicator initially
            if (window.isMultiplayer && !window.isHost) {
                timerEl.textContent = '⏳';
                timerEl.style.color = '#94a3b8';
            } else {
                timerEl.textContent = '30';
                timerEl.style.color = 'white';
            }
        }
        
        // Small delay to ensure DOM is ready
        setTimeout(() => {
            if (window.enterGameMode) {
                enterGameMode();
            }
            // Timer will be started by game logic when appropriate
        }, 100);
        
    } catch (error) {
        console.error('Error starting game:', error);
        showGameStatus('Failed to start game', 'error');
    }
}

// Enhanced game status display
function showGameStatus(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    const gameStatusEl = document.getElementById('gameStatus');
    
    // Update main game status in battle area
    if (gameStatusEl) {
        gameStatusEl.textContent = message;
    }
    
    // Show floating status message for important notifications
    if (statusEl && type !== 'info') {
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        statusEl.style.display = 'block';
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }
        // Keep error messages visible longer
        else if (type === 'error') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
    }
    
    console.log(`Game Status [${type}]: ${message}`);
}

// Enhanced error handling
function handleGameError(error, context = 'Game') {
    console.error(`${context} Error:`, error);
    
    const errorMessage = error.message || 'An unexpected error occurred';
    showGameStatus(`${context}: ${errorMessage}`, 'error');
    
    // Reset game state if critical error
    if (context === 'Critical') {
        setTimeout(() => {
            resetToLobby();
        }, 3000);
    }
}

// Reset to lobby
function resetToLobby() {
    try {
        console.log('=== RESETTING TO LOBBY ===');
        
        // Stop timer
        stopGameTimer();
        
        // Reset state
        gameState = 'lobby';
        window.gameState = gameState; // Update global
        
        // Clear timeout flag
        window.handlingTimeout = false;
        
        // Show lobby, hide game
        document.getElementById('gameBoard').style.display = 'none';
        document.getElementById('gameLobby').style.display = 'block';
        
        // Clear any modals
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
        
        // Clear status
        const statusEl = document.getElementById('statusMessage');
        if (statusEl) {
            statusEl.style.display = 'none';
        }
        
        showGameStatus('Returned to lobby', 'info');
        
    } catch (error) {
        console.error('Error resetting to lobby:', error);
    }
}

// Enhanced initialization
function initializeApp() {
    try {
        console.log('Initializing Durak Dapp...');
        
        // Verify required elements exist
        const requiredElements = [
            'gameLobby',
            'gameBoard',
            'timer',
            'gameStatus',
            'playerHand',
            'opponentHand',
            'battleArea'
        ];
        
        const missing = requiredElements.filter(id => !document.getElementById(id));
        if (missing.length > 0) {
            console.warn('Missing elements:', missing);
        }
        
        // Initialize timer display
        updateTimerDisplay();
        
        // Add CSS for timer animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        // Set initial state
        gameState = 'lobby';
        window.gameState = gameState;
        
        console.log('App initialized successfully');
        
    } catch (error) {
        handleGameError(error, 'Initialization');
    }
}

// Export functions for game.js and other modules
window.resetGameTimer = resetGameTimer;
window.stopGameTimer = stopGameTimer;
window.startTimer = startTimer;
window.showGameStatus = showGameStatus;
window.handleGameError = handleGameError;
window.resetToLobby = resetToLobby;
window.startGame = startGame;
window.endGameWithTimeout = endGameWithTimeout;
window.timerInterval = timerInterval; // Make sure it's globally accessible

// Initialize on load
window.addEventListener('load', initializeApp);

// Handle page unload (cleanup)
window.addEventListener('beforeunload', () => {
    stopGameTimer();
});

// Add global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    handleGameError(event.error, 'Critical');
});

// Add unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    handleGameError(new Error(event.reason), 'Promise');
    event.preventDefault();
});