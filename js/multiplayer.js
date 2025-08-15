// multiplayer.js - Multiplayer Game Management with REAL Escrow Payouts

// Game session data
let currentGameSession = null;
let pollingInterval = null;
let isGameStarted = false;

// Show status helper (use from wallet.js if available, otherwise basic implementation)
function showStatus(message, type = 'info') {
    if (window.walletFunctions && window.walletFunctions.showStatus) {
        window.walletFunctions.showStatus(message, type);
    } else if (window.showGameStatus) {
        window.showGameStatus(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

// Generate random game code
function generateGameCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < GAME_CODE_LENGTH; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Create escrow keypair for game
function createEscrowKeypair() {
    if (typeof solanaWeb3 === 'undefined') {
        console.error('Solana Web3 not loaded');
        return null;
    }
    
    const keypair = solanaWeb3.Keypair.generate();
    return {
        publicKey: keypair.publicKey,
        secretKey: Array.from(keypair.secretKey),
        keypair: keypair
    };
}

// Show create game modal
function showCreateGame() {
    hideModals();
    document.getElementById('createGameModal').style.display = 'flex';
}

// Show join game modal
function showJoinGame() {
    hideModals();
    document.getElementById('joinGameModal').style.display = 'flex';
}

// Hide all modals
function hideModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// Cancel game
function cancelGame() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    
    if (currentGameSession && currentGameSession.code) {
        localStorage.removeItem(`game_${currentGameSession.code}`);
    }
    
    currentGameSession = null;
    isGameStarted = false;
    hideModals();
    
    if (window.resetToLobby) {
        window.resetToLobby();
    }
}

// Create new game
async function createNewGame() {
    try {
        // Disable button to prevent double-clicks
        const createBtn = event.target;
        if (createBtn) {
            createBtn.disabled = true;
        }
        
        if (!wallet) {
            showStatus('Please connect wallet first', 'error');
            if (createBtn) createBtn.disabled = false;
            return;
        }
        
        // Check if already creating a game
        if (window.creatingGame) {
            console.log('Already creating a game, please wait...');
            return;
        }
        
        window.creatingGame = true;
        showStatus('Creating game...', 'info');
        
        // Add small delay to prevent rapid clicks
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Generate game code and escrow
        const gameCode = generateGameCode();
        const escrowData = createEscrowKeypair();
        
        if (!escrowData) {
            throw new Error('Failed to create escrow keypair');
        }
        
        // Create game session
        currentGameSession = {
            code: gameCode,
            host: wallet.publicKey.toString(),
            guest: null,
            escrowWallet: escrowData.publicKey.toString(),
            escrowSecret: escrowData.secretKey,
            escrowKeypair: escrowData.keypair, // Keep in memory for host
            hostDeposited: false,
            guestDeposited: false,
            gameStarted: false,
            createdAt: Date.now()
        };
        
        // Save to localStorage WITH escrow data for both players to access
        localStorage.setItem(`game_${gameCode}`, JSON.stringify({
            ...currentGameSession,
            escrowKeypair: undefined, // Don't store the actual keypair object
            escrowSecretKey: escrowData.secretKey // But store the secret key for reconstruction
        }));
        
        // Make sure global reference is available
        window.currentGameSession = currentGameSession;
        
        // Make deposit with retry logic
        let depositSuccess = false;
        let retries = 0;
        const maxRetries = 3;
        
        while (!depositSuccess && retries < maxRetries) {
            try {
                await window.walletFunctions.makeGameDeposit(true);
                depositSuccess = true;
                currentGameSession.hostDeposited = true;
                
                // Update localStorage
                localStorage.setItem(`game_${gameCode}`, JSON.stringify({
                    ...currentGameSession,
                    escrowKeypair: undefined,
                    escrowSecretKey: escrowData.secretKey
                }));
                
                // Show waiting room
                hideModals();
                document.getElementById('waitingRoom').style.display = 'flex';
                document.getElementById('gameCodeDisplay').textContent = gameCode;
                
                // Start polling for guest
                startHostPolling();
                
            } catch (error) {
                retries++;
                console.error(`Deposit attempt ${retries} failed:`, error);
                
                if (error.message.includes('already been processed') && retries < maxRetries) {
                    showStatus(`Transaction issue, retrying... (${retries}/${maxRetries})`, 'info');
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else if (retries >= maxRetries) {
                    throw error;
                } else {
                    throw error;
                }
            }
        }
        
    } catch (error) {
        console.error('Failed to create game:', error);
        
        // Clean up on failure
        if (currentGameSession && currentGameSession.code) {
            localStorage.removeItem(`game_${currentGameSession.code}`);
        }
        currentGameSession = null;
        
        showStatus(`Failed to create game: ${error.message}`, 'error');
        
        // Re-enable button on error
        const createBtn = document.querySelector('.btn-deposit[onclick*="createNewGame"]');
        if (createBtn) createBtn.disabled = false;
    } finally {
        window.creatingGame = false;
    }
}

// Join existing game
async function joinExistingGame() {
    try {
        if (!wallet) {
            showStatus('Please connect wallet first', 'error');
            return;
        }
        
        const gameCodeInput = document.getElementById('gameCodeInput');
        const gameCode = gameCodeInput.value.toUpperCase().trim();
        
        if (!gameCode || gameCode.length !== GAME_CODE_LENGTH) {
            showStatus('Please enter a valid game code', 'error');
            return;
        }
        
        showStatus('Joining game...', 'info');
        
        // Check if game exists
        const gameData = localStorage.getItem(`game_${gameCode}`);
        if (!gameData) {
            showStatus('Game not found', 'error');
            return;
        }
        
        currentGameSession = JSON.parse(gameData);
        
        // CRITICAL: Reconstruct escrow keypair from secret key for guest
        if (currentGameSession.escrowSecretKey) {
            console.log('🔑 Reconstructing escrow keypair for guest...');
            const secretKeyArray = new Uint8Array(currentGameSession.escrowSecretKey);
            currentGameSession.escrowKeypair = solanaWeb3.Keypair.fromSecretKey(secretKeyArray);
            console.log('✅ Escrow keypair reconstructed');
        }
        
        // Make sure global reference is available
        window.currentGameSession = currentGameSession;
        
        // Check if game is full
        if (currentGameSession.guest) {
            showStatus('Game is already full', 'error');
            return;
        }
        
        // Update guest info
        currentGameSession.guest = wallet.publicKey.toString();
        
        // Make deposit
        try {
            await window.walletFunctions.makeGameDeposit(false);
            currentGameSession.guestDeposited = true;
            
            // Update localStorage
            localStorage.setItem(`game_${gameCode}`, JSON.stringify({
                ...currentGameSession,
                escrowKeypair: undefined,
                escrowSecretKey: currentGameSession.escrowSecretKey
            }));
            
            // Start the game
            hideModals();
            startMultiplayerGame(false);
            
        } catch (error) {
            console.error('Deposit failed:', error);
            currentGameSession.guest = null;
            currentGameSession.guestDeposited = false;
            localStorage.setItem(`game_${gameCode}`, JSON.stringify({
                ...currentGameSession,
                escrowKeypair: undefined,
                escrowSecretKey: currentGameSession.escrowSecretKey
            }));
            throw error;
        }
        
    } catch (error) {
        console.error('Failed to join game:', error);
        showStatus(`Failed to join game: ${error.message}`, 'error');
    }
}

// Start host polling
function startHostPolling() {
    pollingInterval = setInterval(() => {
        if (!currentGameSession || !currentGameSession.code) {
            clearInterval(pollingInterval);
            return;
        }
        
        // Check localStorage for updates
        const gameData = localStorage.getItem(`game_${currentGameSession.code}`);
        if (gameData) {
            const updatedSession = JSON.parse(gameData);
            
            // Check if guest joined
            if (updatedSession.guest && !currentGameSession.guest) {
                currentGameSession.guest = updatedSession.guest;
                currentGameSession.guestDeposited = updatedSession.guestDeposited;
                
                // Update UI
                const opponentInfo = document.getElementById('opponentJoinedInfo');
                if (opponentInfo) {
                    opponentInfo.style.display = 'block';
                }
                
                showStatus('Opponent joined!', 'success');
                
                // Check if both deposited
                if (currentGameSession.hostDeposited && currentGameSession.guestDeposited) {
                    clearInterval(pollingInterval);
                    setTimeout(() => {
                        startMultiplayerGame(true);
                    }, 2000);
                }
            }
        }
    }, POLLING_INTERVAL);
}

// Start multiplayer game
function startMultiplayerGame(isHost) {
    if (isGameStarted) return;
    
    console.log('Starting multiplayer game, isHost:', isHost);
    
    isGameStarted = true;
    currentGameSession.gameStarted = true;
    
    // Make sure escrow keypair is available for both players
    if (!currentGameSession.escrowKeypair && currentGameSession.escrowSecretKey) {
        console.log('🔑 Reconstructing escrow keypair...');
        const secretKeyArray = new Uint8Array(currentGameSession.escrowSecretKey);
        currentGameSession.escrowKeypair = solanaWeb3.Keypair.fromSecretKey(secretKeyArray);
        console.log('✅ Escrow keypair reconstructed for game');
    }
    
    // Update localStorage
    if (currentGameSession.code) {
        localStorage.setItem(`game_${currentGameSession.code}`, JSON.stringify({
            ...currentGameSession,
            escrowKeypair: undefined,
            escrowSecretKey: currentGameSession.escrowSecretKey
        }));
    }
    
    // Set multiplayer mode
    window.isMultiplayer = true;
    window.isHost = isHost;
    window.currentGameSession = currentGameSession; // Make sure it's globally available
    
    if (window.setMultiplayerMode) {
        window.setMultiplayerMode(isHost);
    }
    
    // Hide modals and show game
    hideModals();
    
    // Start the game - this sets gameState to 'playing'
    if (window.startGame) {
        window.startGame();
    }
    
    // Make sure gameState is set
    window.gameState = 'playing';
    
    // Start game sync polling
    startGameSyncPolling();
    
    // Initialize game state (host only)
    if (isHost && window.enterGameMode) {
        console.log('Host initializing game...');
        setTimeout(() => {
            window.enterGameMode();
        }, 1000);
    } else if (!isHost) {
        // For guest, ensure timer container is visible
        console.log('Guest waiting for game state...');
        const timerContainer = document.querySelector('.timer-container');
        if (timerContainer) {
            timerContainer.style.display = 'block';
        }
        
        // Show waiting indicator in timer
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            timerEl.textContent = '⏳';
            timerEl.style.color = '#94a3b8';
            timerEl.style.fontSize = '24px';
        }
    }
}

// Game state synchronization
let lastGameState = null;

function startGameSyncPolling() {
    // Clear any existing polling
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    pollingInterval = setInterval(() => {
        if (!currentGameSession || !currentGameSession.code) {
            clearInterval(pollingInterval);
            return;
        }
        
        // Get current game state from localStorage
        const gameStateKey = `gameState_${currentGameSession.code}`;
        const storedState = localStorage.getItem(gameStateKey);
        
        if (storedState) {
            const parsedState = JSON.parse(storedState);
            
            // Check if state has changed
            if (JSON.stringify(parsedState) !== JSON.stringify(lastGameState)) {
                lastGameState = parsedState;
                
                // Update game if we didn't send this update
                if (parsedState.sender !== wallet.publicKey.toString()) {
                    // Handle timeout forfeit
                    if (parsedState.lastMove && parsedState.lastMove.type === 'timeout') {
                        console.log('Received timeout forfeit from opponent');
                        if (window.updateMultiplayerGameState) {
                            window.updateMultiplayerGameState(parsedState.gameData);
                        }
                    } else if (window.updateMultiplayerGameState) {
                        window.updateMultiplayerGameState(parsedState.gameData);
                    }
                }
            }
        }
    }, 500); // Faster polling for game moves
}

// Send game move with timer sync
function sendGameMove(move) {
    if (!currentGameSession || !currentGameSession.code) {
        console.error('No active game session');
        return;
    }
    
    console.log('Sending game move:', move);
    
    const gameStateKey = `gameState_${currentGameSession.code}`;
    const gameState = {
        gameData: move.gameData || window.gameData,
        lastMove: move,
        sender: wallet.publicKey.toString(),
        timestamp: Date.now(),
        currentTurn: move.gameData ? move.gameData.currentTurn : window.gameData.currentTurn,
        gamePhase: move.gameData ? move.gameData.gamePhase : window.gameData.gamePhase
    };
    
    localStorage.setItem(gameStateKey, JSON.stringify(gameState));
    lastGameState = gameState;
    
    console.log('Game state saved with turn info:', gameState.currentTurn, gameState.gamePhase);
}

// Check if it's my turn (deprecated - use isActivePlayer instead)
function isMyTurn() {
    if (!window.gameData) return false;
    
    const isHostTurn = window.gameData.currentTurn === 'player';
    const myTurn = (window.isHost && isHostTurn) || (!window.isHost && !isHostTurn);
    
    console.log('isMyTurn check - isHost:', window.isHost, 'currentTurn:', window.gameData.currentTurn, 'isHostTurn:', isHostTurn, 'myTurn:', myTurn);
    
    return myTurn;
}

// Get my hand based on perspective
function getMyHand() {
    if (!window.gameData) return [];
    return window.isHost ? window.gameData.playerHand : window.gameData.opponentHand;
}

// REAL ESCROW PAYOUT SYSTEM
async function handleGameEnd(isWinner) {
    console.log('=== HANDLE GAME END ===');
    console.log('Is winner:', isWinner);
    console.log('My wallet:', wallet.publicKey.toString());
    console.log('Escrow available:', !!currentGameSession?.escrowKeypair);
    
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    
    return new Promise(async (resolve, reject) => {
        try {
            if (isWinner) {
                console.log('🎉 I WON! Processing REAL payout from escrow...');
                
                try {
                    showStatus('You won! Processing payout from escrow...', 'success');
                    
                    // REAL PAYOUT: From escrow to winner
                    const myWalletAddress = wallet.publicKey.toString();
                    const payoutTx = await window.walletFunctions.payoutToWinner(myWalletAddress);
                    
                    if (payoutTx) {
                        console.log('✅ REAL payout successful:', payoutTx);
                        showStatus(`✅ Payout completed! TX: ${payoutTx}`, 'success');
                    } else {
                        console.log('⚠️ Payout returned null');
                    }
                    
                    resolve(payoutTx);
                    
                } catch (payoutError) {
                    console.error('❌ Real payout failed:', payoutError);
                    showStatus('Payout failed: ' + payoutError.message, 'error');
                    resolve(null);
                }
                
            } else {
                console.log('😞 I lost. No payout for me.');
                showStatus('Game ended - opponent won', 'info');
                resolve(null);
            }
            
            // Clean up game data after a delay
            setTimeout(() => {
                if (currentGameSession && currentGameSession.code) {
                    console.log('🧹 Cleaning up game data...');
                    localStorage.removeItem(`game_${currentGameSession.code}`);
                    localStorage.removeItem(`gameState_${currentGameSession.code}`);
                    localStorage.removeItem(`gameEnd_${currentGameSession.code}`);
                    localStorage.removeItem(`payout_${currentGameSession.code}`);
                }
            }, 10000); // Wait 10 seconds before cleanup
            
            isGameStarted = false;
            window.isMultiplayer = false;
            
        } catch (error) {
            console.error('❌ Error in handleGameEnd:', error);
            reject(error);
        }
    });
}

// Export functions
window.showCreateGame = showCreateGame;
window.showJoinGame = showJoinGame;
window.hideModals = hideModals;
window.createNewGame = createNewGame;
window.joinExistingGame = joinExistingGame;
window.cancelGame = cancelGame;
window.sendGameMove = sendGameMove;
window.isMyTurn = isMyTurn;
window.getMyHand = getMyHand;
window.handleGameEnd = handleGameEnd; // ← This now handles REAL escrow payouts!
window.currentGameSession = currentGameSession;

// Also ensure these are available globally
window.updateMultiplayerGameState = window.updateMultiplayerGameState || function(gameData) {
    console.log('updateMultiplayerGameState called with:', gameData);
};