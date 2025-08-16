// multiplayer.js - Multiplayer Game Management with Firebase

// Game session data
let currentGameSession = null;
let gameListener = null;
let gameStateListener = null;
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
async function cancelGame() {
    console.log('🚫 Canceling game...');
    
    // Stop Firebase listeners
    if (gameListener) {
        gameListener();
        gameListener = null;
    }
    
    if (gameStateListener) {
        gameStateListener();
        gameStateListener = null;
    }
    
    // Clean up Firebase data
    if (currentGameSession && currentGameSession.code) {
        try {
            await FirebaseDB.cleanupGame(currentGameSession.code);
            console.log('🧹 Game cleaned up from Firebase');
        } catch (error) {
            console.error('Error cleaning up game:', error);
        }
    }
    
    currentGameSession = null;
    isGameStarted = false;
    hideModals();
    
    if (window.resetToLobby) {
        window.resetToLobby();
    }
}

// Create new game - FIREBASE VERSION
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
        
        // Check if Firebase is ready
        if (!window.FirebaseDB) {
            showStatus('Firebase not ready. Please refresh and try again.', 'error');
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
            escrowKeypair: escrowData.keypair,
            hostDeposited: false,
            guestDeposited: false,
            gameStarted: false,
            createdAt: Date.now()
        };
        
        // Save to Firebase (not localStorage!)
        const success = await FirebaseDB.saveGame(gameCode, {
            ...currentGameSession,
            escrowKeypair: undefined, // Don't store keypair object
            escrowSecretKey: escrowData.secretKey // Store secret key for reconstruction
        });
        
        if (!success) {
            throw new Error('Failed to save game to Firebase');
        }
        
        console.log('🎮 Game created in Firebase:', gameCode);
        
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
                
                // Update Firebase with deposit status
                await FirebaseDB.saveGame(gameCode, {
                    ...currentGameSession,
                    escrowKeypair: undefined,
                    escrowSecretKey: escrowData.secretKey
                });
                
                // Show waiting room
                hideModals();
                document.getElementById('waitingRoom').style.display = 'flex';
                document.getElementById('gameCodeDisplay').textContent = gameCode;
                
                // Start listening for opponent
                startHostListening(gameCode);
                
            } catch (error) {
                retries++;
                console.error(`Deposit attempt ${retries} failed:`, error);
                
                if (error.message.includes('already been processed') && retries < maxRetries) {
                    showStatus(`Transaction issue, retrying... (${retries}/${maxRetries})`, 'info');
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
            await FirebaseDB.cleanupGame(currentGameSession.code);
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

// Join existing game - FIREBASE VERSION
async function joinExistingGame() {
    try {
        if (!wallet) {
            showStatus('Please connect wallet first', 'error');
            return;
        }
        
        // Check if Firebase is ready
        if (!window.FirebaseDB) {
            showStatus('Firebase not ready. Please refresh and try again.', 'error');
            return;
        }
        
        const gameCodeInput = document.getElementById('gameCodeInput');
        const gameCode = gameCodeInput.value.toUpperCase().trim();
        
        if (!gameCode || gameCode.length !== GAME_CODE_LENGTH) {
            showStatus('Please enter a valid game code', 'error');
            return;
        }
        
        showStatus('Looking for game...', 'info');
        
        // Get game from Firebase (not localStorage!)
        const gameData = await FirebaseDB.getGame(gameCode);
        if (!gameData) {
            showStatus('Game not found', 'error');
            return;
        }
        
        console.log('🎮 Found game in Firebase:', gameCode);
        currentGameSession = gameData;
        
        // Reconstruct escrow keypair from secret key
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
            showStatus('Joining game and depositing...', 'info');
            
            await window.walletFunctions.makeGameDeposit(false);
            currentGameSession.guestDeposited = true;
            
            // Update Firebase with guest info
            await FirebaseDB.saveGame(gameCode, {
                ...currentGameSession,
                escrowKeypair: undefined,
                escrowSecretKey: currentGameSession.escrowSecretKey
            });
            
            console.log('🎮 Guest joined game in Firebase');
            
            // Start the game
            hideModals();
            startMultiplayerGame(false);
            
        } catch (error) {
            console.error('Deposit failed:', error);
            currentGameSession.guest = null;
            currentGameSession.guestDeposited = false;
            
            // Update Firebase to remove guest
            await FirebaseDB.saveGame(gameCode, {
                ...currentGameSession,
                escrowKeypair: undefined,
                escrowSecretKey: currentGameSession.escrowSecretKey
            });
            
            throw error;
        }
        
    } catch (error) {
        console.error('Failed to join game:', error);
        showStatus(`Failed to join game: ${error.message}`, 'error');
    }
}

// Start host listening - FIREBASE VERSION
function startHostListening(gameCode) {
    console.log('🎧 Host listening for opponent on Firebase...');
    
    // Listen for real-time updates to the game
    gameListener = FirebaseDB.listenToGame(gameCode, (updatedGameData) => {
        console.log('🔄 Game data updated:', updatedGameData);
        
        // Check if guest joined
        if (updatedGameData.guest && !currentGameSession.guest) {
            console.log('🎮 Opponent joined!');
            
            currentGameSession.guest = updatedGameData.guest;
            currentGameSession.guestDeposited = updatedGameData.guestDeposited;
            
            // Update UI
            const opponentInfo = document.getElementById('opponentJoinedInfo');
            if (opponentInfo) {
                opponentInfo.style.display = 'block';
            }
            
            showStatus('Opponent joined!', 'success');
            
            // Check if both deposited
            if (currentGameSession.hostDeposited && currentGameSession.guestDeposited) {
                console.log('🚀 Both players deposited - starting game!');
                
                // Stop listening to game creation
                if (gameListener) {
                    gameListener();
                    gameListener = null;
                }
                
                setTimeout(() => {
                    startMultiplayerGame(true);
                }, 2000);
            }
        }
    });
}

// Start multiplayer game - FIREBASE VERSION
function startMultiplayerGame(isHost) {
    if (isGameStarted) return;
    
    console.log('🎮 Starting Firebase multiplayer game, isHost:', isHost);
    
    isGameStarted = true;
    currentGameSession.gameStarted = true;
    
    // Make sure escrow keypair is available for both players
    if (!currentGameSession.escrowKeypair && currentGameSession.escrowSecretKey) {
        console.log('🔑 Reconstructing escrow keypair...');
        const secretKeyArray = new Uint8Array(currentGameSession.escrowSecretKey);
        currentGameSession.escrowKeypair = solanaWeb3.Keypair.fromSecretKey(secretKeyArray);
        console.log('✅ Escrow keypair reconstructed for game');
    }
    
    // Update Firebase with game started status
    FirebaseDB.saveGame(currentGameSession.code, {
        ...currentGameSession,
        escrowKeypair: undefined,
        escrowSecretKey: currentGameSession.escrowSecretKey
    });
    
    // Set multiplayer mode
    window.isMultiplayer = true;
    window.isHost = isHost;
    window.currentGameSession = currentGameSession;
    
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
    
    // Start Firebase game sync
    startFirebaseGameSync();
    
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

// Firebase game state synchronization
function startFirebaseGameSync() {
    console.log('🔄 Starting Firebase game sync...');
    
    // Listen for real-time game state changes
    gameStateListener = FirebaseDB.listenToGameState(currentGameSession.code, (gameState) => {
        console.log('🔄 Game state changed from Firebase');
        
        // Update game if we didn't send this update
        if (gameState.sender !== wallet.publicKey.toString()) {
            console.log('📥 Received game state from opponent');
            
            // Handle timeout forfeit
            if (gameState.lastMove && gameState.lastMove.type === 'timeout') {
                console.log('⏰ Received timeout forfeit from opponent');
                if (window.updateMultiplayerGameState) {
                    window.updateMultiplayerGameState(gameState.gameData);
                }
            } else if (window.updateMultiplayerGameState) {
                window.updateMultiplayerGameState(gameState.gameData);
            }
        }
    });
}

// Send game move with Firebase
async function sendGameMove(move) {
    if (!currentGameSession || !currentGameSession.code) {
        console.error('No active game session');
        return;
    }
    
    console.log('📤 Sending game move to Firebase:', move.type || 'move');
    
    const gameState = {
        gameData: move.gameData || window.gameData,
        lastMove: move,
        sender: wallet.publicKey.toString(),
        timestamp: Date.now(),
        currentTurn: move.gameData ? move.gameData.currentTurn : window.gameData?.currentTurn,
        gamePhase: move.gameData ? move.gameData.gamePhase : window.gameData?.gamePhase
    };
    
    try {
        await FirebaseDB.updateGameState(currentGameSession.code, gameState);
        console.log('✅ Game move sent to Firebase');
    } catch (error) {
        console.error('❌ Failed to send game move:', error);
    }
}

// Check if it's my turn (deprecated - use isActivePlayer instead)
function isMyTurn() {
    if (!window.gameData) return false;
    
    const isHostTurn = window.gameData.currentTurn === 'player';
    const myTurn = (window.isHost && isHostTurn) || (!window.isHost && !isHostTurn);
    
    console.log('isMyTurn check - isHost:', window.isHost, 'currentTurn:', window.gameData.currentTurn, 'myTurn:', myTurn);
    
    return myTurn;
}

// Get my hand based on perspective
function getMyHand() {
    if (!window.gameData) return [];
    return window.isHost ? window.gameData.playerHand : window.gameData.opponentHand;
}

// REAL FIREBASE PAYOUT SYSTEM
async function handleGameEnd(isWinner) {
    console.log('🏁 FIREBASE GAME END - Is winner:', isWinner);
    console.log('My wallet:', wallet.publicKey.toString());
    console.log('Escrow available:', !!currentGameSession?.escrowKeypair);
    
    // Stop Firebase listeners
    if (gameListener) {
        gameListener();
        gameListener = null;
    }
    
    if (gameStateListener) {
        gameStateListener();
        gameStateListener = null;
    }
    
    return new Promise(async (resolve, reject) => {
        try {
            if (isWinner) {
                console.log('🎉 I WON! Processing REAL Firebase payout...');
                
                try {
                    showStatus('You won! Processing payout from escrow...', 'success');
                    
                    // REAL PAYOUT: From escrow to winner
                    const myWalletAddress = wallet.publicKey.toString();
                    const payoutTx = await window.walletFunctions.payoutToWinner(myWalletAddress);
                    
                    if (payoutTx) {
                        console.log('✅ REAL Firebase payout successful:', payoutTx);
                        showStatus(`✅ Payout completed! TX: ${payoutTx}`, 'success');
                    } else {
                        console.log('⚠️ Payout returned null');
                    }
                    
                    resolve(payoutTx);
                    
                } catch (payoutError) {
                    console.error('❌ Firebase payout failed:', payoutError);
                    showStatus('Payout failed: ' + payoutError.message, 'error');
                    resolve(null);
                }
                
            } else {
                console.log('😞 I lost. No payout for me.');
                showStatus('Game ended - opponent won', 'info');
                resolve(null);
            }
            
            // Clean up Firebase data after delay
            setTimeout(async () => {
                if (currentGameSession && currentGameSession.code) {
                    console.log('🧹 Cleaning up Firebase game data...');
                    await FirebaseDB.cleanupGame(currentGameSession.code);
                }
            }, 10000); // Wait 10 seconds before cleanup
            
            isGameStarted = false;
            window.isMultiplayer = false;
            
        } catch (error) {
            console.error('❌ Error in Firebase handleGameEnd:', error);
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
window.handleGameEnd = handleGameEnd;
window.currentGameSession = currentGameSession;

// Also ensure these are available globally
window.updateMultiplayerGameState = window.updateMultiplayerGameState || function(gameData) {
    console.log('updateMultiplayerGameState called with:', gameData);
};

console.log('🎮 Firebase multiplayer.js loaded successfully');