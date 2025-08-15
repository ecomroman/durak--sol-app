// game.js - Durak Game Logic with PROPER Timer Management

// Card suits and ranks
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

// Game data
let gameData = {
    deck: [],
    playerHand: [],
    opponentHand: [],
    trumpSuit: null,
    trumpCard: null,
    battleArea: [],
    beatPile: [],
    currentTurn: 'player', // 'player' or 'opponent'
    gamePhase: 'attacking', // 'attacking', 'defending', 'taking'
    selectedCard: null,
    isGameOver: false,
    winner: null,
    lastAction: null, // Track last action for draw order
    timeoutLoss: false // Track if game ended due to timeout
};

// Multiplayer mode
let isHost = false;

// Initialize a new deck
function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ rank, suit, value: RANK_VALUES[rank] });
        }
    }
    return deck;
}

// Shuffle deck using Fisher-Yates algorithm
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Deal initial cards
function dealInitialCards() {
    gameData.deck = shuffleDeck(createDeck());
    
    console.log('Dealing cards, deck size:', gameData.deck.length);
    
    // Deal 6 cards to each player
    for (let i = 0; i < 6; i++) {
        gameData.playerHand.push(gameData.deck.pop());
        gameData.opponentHand.push(gameData.deck.pop());
    }
    
    // Set trump card (bottom of deck)
    gameData.trumpCard = gameData.deck[0];
    gameData.trumpSuit = gameData.trumpCard.suit;
    
    console.log('Trump card set:', gameData.trumpCard);
    console.log('Trump suit:', gameData.trumpSuit);
    
    // Sort hands by value
    sortHand(gameData.playerHand);
    sortHand(gameData.opponentHand);
    
    console.log('Player hand:', gameData.playerHand.length, 'cards');
    console.log('Opponent hand:', gameData.opponentHand.length, 'cards');
}

// Sort hand by card value and suit
function sortHand(hand) {
    hand.sort((a, b) => {
        if (a.suit === gameData.trumpSuit && b.suit !== gameData.trumpSuit) return 1;
        if (a.suit !== gameData.trumpSuit && b.suit === gameData.trumpSuit) return -1;
        if (a.value !== b.value) return a.value - b.value;
        return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    });
}

// Draw cards from deck to fill hands
function drawCards() {
    // IMPORTANT: The person who attacked draws first
    // In beatCards scenario, the previous defender becomes the new attacker
    // In takeCards scenario, the attacker remains the same
    
    let firstDrawer, secondDrawer;
    
    // Determine who draws first based on the last action
    if (gameData.lastAction === 'beat') {
        // After beating, the previous defender (now attacker) draws first
        firstDrawer = gameData.currentTurn === 'player' ? gameData.playerHand : gameData.opponentHand;
        secondDrawer = gameData.currentTurn === 'player' ? gameData.opponentHand : gameData.playerHand;
    } else {
        // After taking or normal play, attacker draws first
        firstDrawer = gameData.currentTurn === 'player' ? gameData.playerHand : gameData.opponentHand;
        secondDrawer = gameData.currentTurn === 'player' ? gameData.opponentHand : gameData.playerHand;
    }
    
    // Fill first drawer's hand to 6 cards
    while (firstDrawer.length < 6 && gameData.deck.length > 0) {
        firstDrawer.push(gameData.deck.pop());
    }
    
    // Fill second drawer's hand to 6 cards
    while (secondDrawer.length < 6 && gameData.deck.length > 0) {
        secondDrawer.push(gameData.deck.pop());
    }
    
    // Sort hands
    sortHand(gameData.playerHand);
    sortHand(gameData.opponentHand);
}

// Check if a card can beat another card
function canBeat(attackCard, defenseCard) {
    if (!attackCard || !defenseCard) return false;
    
    // Same suit, higher value
    if (attackCard.suit === defenseCard.suit) {
        return defenseCard.value > attackCard.value;
    }
    
    // Trump beats non-trump
    if (defenseCard.suit === gameData.trumpSuit && attackCard.suit !== gameData.trumpSuit) {
        return true;
    }
    
    return false;
}

// Get valid cards for current action
function getValidCards(hand, action) {
    const validCards = [];
    
    if (!hand || hand.length === 0) {
        console.log('No cards in hand');
        return validCards;
    }
    
    if (action === 'attack' || action === 'attacking') {
        if (gameData.battleArea.length === 0) {
            // First attack - any card is valid
            console.log('First attack - all cards valid');
            return hand;
        } else {
            // Follow-up attack - only cards with ranks already on table
            const ranksOnTable = new Set();
            gameData.battleArea.forEach(pair => {
                if (pair.attack) ranksOnTable.add(pair.attack.rank);
                if (pair.defense) ranksOnTable.add(pair.defense.rank);
            });
            
            for (const card of hand) {
                if (ranksOnTable.has(card.rank)) {
                    validCards.push(card);
                }
            }
            console.log('Follow-up attack - ranks on table:', Array.from(ranksOnTable));
        }
    } else if (action === 'defend' || action === 'defending') {
        // Find undefended attack
        const undefendedAttack = gameData.battleArea.find(pair => !pair.defense);
        if (undefendedAttack) {
            for (const card of hand) {
                if (canBeat(undefendedAttack.attack, card)) {
                    validCards.push(card);
                }
            }
        }
    }
    
    return validCards;
}

// Handle card selection
function selectCard(cardElement, cardIndex) {
    console.log('Card selected:', cardIndex);
    
    // Check if game is over
    if (gameData.isGameOver) {
        console.log('Game is over, cannot select cards');
        return;
    }
    
    // Determine which hand to use based on perspective
    const isMyPhase = (isHost && gameData.currentTurn === 'player') || 
                      (!isHost && gameData.currentTurn === 'opponent');
    const hand = isHost ? gameData.playerHand : gameData.opponentHand;
    const card = hand[cardIndex];
    
    if (!card) {
        console.log('No card at index:', cardIndex);
        return;
    }
    
    console.log('Selected card:', card, 'Phase:', gameData.gamePhase, 'isMyPhase:', isMyPhase);
    
    // For attacking phase, check if it's my turn to attack
    if (gameData.gamePhase === 'attacking' && !isMyPhase) {
        window.showGameStatus("It's not your turn to attack", 'error');
        return;
    }
    
    // For defending phase, check if it's my turn to defend
    if (gameData.gamePhase === 'defending' && isMyPhase) {
        window.showGameStatus("It's not your turn to defend", 'error');
        return;
    }
    
    console.log('Checking valid cards for phase:', gameData.gamePhase);
    const validCards = getValidCards(hand, gameData.gamePhase);
    console.log('Valid cards:', validCards);
    
    const isValid = validCards.some(c => c.rank === card.rank && c.suit === card.suit);
    
    if (!isValid) {
        window.showGameStatus('Invalid card selection', 'error');
        return;
    }
    
    // Toggle selection
    if (gameData.selectedCard === cardIndex) {
        gameData.selectedCard = null;
        cardElement.classList.remove('selected');
    } else {
        // Remove previous selection
        document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
        gameData.selectedCard = cardIndex;
        cardElement.classList.add('selected');
    }
    
    // Auto-play for attack/defense
    if (gameData.selectedCard !== null) {
        if (gameData.gamePhase === 'attacking') {
            playAttack();
        } else if (gameData.gamePhase === 'defending') {
            playDefense();
        }
    }
}

// Play attack card
function playAttack() {
    if (gameData.selectedCard === null || gameData.isGameOver) return;
    
    const hand = isHost ? gameData.playerHand : gameData.opponentHand;
    const card = hand[gameData.selectedCard];
    
    console.log('🔥 ATTACK: Playing attack with card:', card);
    console.log('🔥 ATTACK: Current turn before:', gameData.currentTurn, 'Phase before:', gameData.gamePhase);
    
    // Add to battle area
    gameData.battleArea.push({ attack: card, defense: null });
    
    // Remove from hand
    hand.splice(gameData.selectedCard, 1);
    gameData.selectedCard = null;
    
    // CRITICAL FIX: Force phase switch to defending
    gameData.gamePhase = 'defending';
    console.log('🔥 ATTACK: FORCED gamePhase to defending - new phase:', gameData.gamePhase);
    
    console.log('🔥 ATTACK: After attack - turn:', gameData.currentTurn, 'phase:', gameData.gamePhase);
    
    // Update display first
    updateGameDisplay();
    
    // CRITICAL: Timer switches to defender (who needs to act next)
    console.log('🔥 ATTACK: Timer should now switch to DEFENDER');
    switchTimerToActivePlayer('Attack played - timer switches to defender');
    
    // Send the move with CORRECT phase
    if (window.sendGameMove) {
        console.log('🔥 ATTACK: Sending move with phase:', gameData.gamePhase);
        window.sendGameMove({
            type: 'attack',
            card: card,
            gameData: gameData // This will have the correct 'defending' phase
        });
    }
    
    // Check if defender has valid moves
    const defenderHand = isHost ? gameData.opponentHand : gameData.playerHand;
    const validDefenses = getValidCards(defenderHand, 'defending');
    
    if (validDefenses.length === 0) {
        window.showGameStatus('No valid defense - must take cards');
    }
}

// Play defense card
function playDefense() {
    if (gameData.selectedCard === null || gameData.isGameOver) return;
    
    const hand = isHost ? gameData.playerHand : gameData.opponentHand;
    const card = hand[gameData.selectedCard];
    
    console.log('🛡️ DEFEND: Playing defense with card:', card);
    console.log('🛡️ DEFEND: Current turn before:', gameData.currentTurn, 'Phase before:', gameData.gamePhase);
    
    // Find undefended attack
    const undefendedPair = gameData.battleArea.find(pair => !pair.defense);
    if (!undefendedPair) return;
    
    // Add defense
    undefendedPair.defense = card;
    
    // Remove from hand
    hand.splice(gameData.selectedCard, 1);
    gameData.selectedCard = null;
    
    // Check if all attacks are defended
    const allDefended = gameData.battleArea.every(pair => pair.defense);
    
    if (allDefended) {
        // All defended - back to attacking phase (attacker can continue or pass)
        gameData.gamePhase = 'attacking';
        window.showGameStatus('All attacks defended!');
        
        console.log('🛡️ DEFEND: All defended - timer switches back to ATTACKER');
        switchTimerToActivePlayer('All attacks defended - timer back to attacker');
        
        // Check if attacker can continue
        const attackerHand = isHost ? gameData.playerHand : gameData.opponentHand;
        const validAttacks = getValidCards(attackerHand, 'attack');
        
        if (validAttacks.length === 0 || gameData.battleArea.length >= 6) {
            // Must beat the cards
            window.showGameStatus('No more attacks - cards will be beaten');
        }
    } else {
        // Still in defending phase - timer stays with defender for next attack
        console.log('🛡️ DEFEND: Not all defended - timer stays with DEFENDER');
        switchTimerToActivePlayer('Defense played - timer stays with defender');
    }
    
    console.log('🛡️ DEFEND: After defense - turn:', gameData.currentTurn, 'phase:', gameData.gamePhase);
    
    // Update display
    updateGameDisplay();
    
    // Send the move
    if (window.sendGameMove) {
        window.sendGameMove({
            type: 'defend',
            card: card,
            gameData: gameData
        });
    }
}

// Take all cards from battle area
function takeCards() {
    if (gameData.isGameOver) return;
    
    console.log('📥 TAKE: Take cards called - phase:', gameData.gamePhase, 'turn:', gameData.currentTurn, 'isHost:', isHost);
    
    // Check if there are cards to take
    if (gameData.battleArea.length === 0) {
        console.log('No cards to take');
        return;
    }
    
    // For taking cards, the defender can always take when defending
    const isDefending = gameData.gamePhase === 'defending';
    if (!isDefending) {
        console.log('Cannot take - not in defending phase');
        return;
    }
    
    // Determine who is the defender (taker)
    let takerHand, takerName;
    if (gameData.currentTurn === 'player') {
        // Player is attacking, so opponent is defending
        if (isHost) {
            takerHand = gameData.opponentHand;
            takerName = 'Opponent';
        } else {
            takerHand = gameData.opponentHand;
            takerName = 'You';
        }
    } else {
        // Opponent is attacking, so player is defending
        if (isHost) {
            takerHand = gameData.playerHand;
            takerName = 'You';
        } else {
            takerHand = gameData.playerHand;
            takerName = 'Opponent';
        }
    }
    
    console.log('📥 TAKE: Defender taking cards - taker:', takerName);
    
    // Add all cards from battle area to taker's hand
    let cardsAdded = 0;
    gameData.battleArea.forEach(pair => {
        if (pair.attack) {
            takerHand.push(pair.attack);
            cardsAdded++;
        }
        if (pair.defense) {
            takerHand.push(pair.defense);
            cardsAdded++;
        }
    });
    
    // Clear battle area
    gameData.battleArea = [];
    
    // Sort the taker's hand
    sortHand(takerHand);
    
    // Set last action
    gameData.lastAction = 'take';
    
    // Draw cards to refill hands (attacker draws first)
    drawCards();
    
    // IMPORTANT: Turn stays with the attacker when defender takes
    // Only change phase back to attacking
    gameData.gamePhase = 'attacking';
    
    console.log('📥 TAKE: After take - turn stays with ATTACKER:', gameData.currentTurn);
    
    window.showGameStatus(`${takerName} took ${cardsAdded} card${cardsAdded > 1 ? 's' : ''} - ${gameData.currentTurn === 'player' ? 'Your' : "Opponent's"} turn continues`);
    
    // Update display
    updateGameDisplay();
    
    // CRITICAL: Timer stays with attacker who continues their turn
    console.log('📥 TAKE: Timer stays with ATTACKER who continues');
    switchTimerToActivePlayer('Cards taken - attacker continues');
    
    // Check for game over
    checkGameOver();
    
    // Send the move
    if (window.sendGameMove) {
        window.sendGameMove({
            type: 'take',
            gameData: gameData
        });
    }
}

// Beat cards (successful defense)
function beatCards() {
    if (gameData.isGameOver) return;
    
    console.log('✅ BEAT: Beat cards called - phase:', gameData.gamePhase);
    
    // Check if battle area has cards
    if (gameData.battleArea.length === 0) {
        console.log('No cards to beat');
        return;
    }
    
    // Check all attacks are defended
    const allDefended = gameData.battleArea.every(pair => pair.defense);
    
    if (!allDefended) {
        console.log('Cannot beat - not all attacks defended');
        return;
    }
    
    console.log('✅ BEAT: Beating cards... Turn before:', gameData.currentTurn);
    
    // Move all cards to beat pile
    gameData.battleArea.forEach(pair => {
        gameData.beatPile.push(pair.attack);
        if (pair.defense) {
            gameData.beatPile.push(pair.defense);
        }
    });
    
    // Clear battle area
    gameData.battleArea = [];
    
    // Set last action
    gameData.lastAction = 'beat';
    
    // CRITICAL: Switch turns - defender becomes new attacker
    gameData.currentTurn = gameData.currentTurn === 'player' ? 'opponent' : 'player';
    gameData.gamePhase = 'attacking';
    
    console.log('✅ BEAT: After beat - NEW attacker:', gameData.currentTurn);
    
    // Draw cards (new attacker draws first)
    drawCards();
    
    window.showGameStatus('Cards beaten! Turn switches.');
    
    // Update display
    updateGameDisplay();
    
    // CRITICAL: Timer switches to NEW attacker
    console.log('✅ BEAT: Timer switches to NEW attacker');
    switchTimerToActivePlayer('Cards beaten - turn switches');
    
    // Check for game over
    checkGameOver();
    
    // Send the move
    if (window.sendGameMove) {
        window.sendGameMove({
            type: 'beat',
            gameData: gameData
        });
    }
}

// Pass attack (attacker chooses not to continue)
function passAttack() {
    if (gameData.isGameOver) return;
    
    // Check if it's the attacker's turn to pass
    const isMyPhase = (isHost && gameData.currentTurn === 'player') || 
                      (!isHost && gameData.currentTurn === 'opponent');
    
    if (!isMyPhase || gameData.gamePhase !== 'attacking' || gameData.battleArea.length === 0) {
        console.log('Cannot pass - not attacking phase or no cards played');
        return;
    }
    
    console.log('⏩ PASS: Passing attack...');
    
    // Check if all attacks are defended
    const allDefended = gameData.battleArea.every(pair => pair.defense);
    
    if (allDefended) {
        // All defended - beat the cards
        beatCards();
    } else {
        // Not all defended - defender must take
        console.log('⏩ PASS: Not all attacks defended - forcing defender to take');
        
        // Force defender to take the cards
        const defenderHand = isHost ? gameData.opponentHand : gameData.playerHand;
        
        // Add all cards to defender's hand
        gameData.battleArea.forEach(pair => {
            defenderHand.push(pair.attack);
            if (pair.defense) {
                defenderHand.push(pair.defense);
            }
        });
        
        // Clear battle area
        gameData.battleArea = [];
        
        // Sort hand
        sortHand(defenderHand);
        
        // Draw cards
        drawCards();
        
        // Attacker keeps the turn
        gameData.gamePhase = 'attacking';
        
        window.showGameStatus('Defender must take undefended cards');
        
        // Update display
        updateGameDisplay();
        
        // Timer stays with attacker
        console.log('⏩ PASS: Timer stays with ATTACKER who continues');
        switchTimerToActivePlayer('Pass attack - attacker continues');
        
        // Check for game over
        checkGameOver();
        
        // Send the move
        if (window.sendGameMove) {
            window.sendGameMove({
                type: 'pass',
                gameData: gameData
            });
        }
    }
}

// CRITICAL FUNCTION: Switch timer to whoever needs to act next
function switchTimerToActivePlayer(reason) {
    console.log('⏰ SWITCH TIMER:', reason);
    console.log('⏰ Current turn:', gameData.currentTurn, 'Phase:', gameData.gamePhase);
    console.log('⏰ isHost:', isHost);
    
    // CRITICAL: Check who should be active NOW
    const isActiveNow = window.isActivePlayer && window.isActivePlayer();
    console.log('⏰ After switch - isActivePlayer:', isActiveNow);
    
    if (isActiveNow) {
        // I need to act - start my timer
        console.log('⏰ STARTING timer for me (active player)');
        if (window.resetGameTimer) {
            window.resetGameTimer();
        }
    } else {
        // Not my turn - stop timer and show waiting
        console.log('⏰ STOPPING timer for me (not active)');
        if (window.timerInterval) {
            clearInterval(window.timerInterval);
            window.timerInterval = null;
        }
        
        // Show waiting indicator
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            timerEl.textContent = '⏳';
            timerEl.style.color = '#94a3b8';
            timerEl.style.animation = 'none';
            timerEl.style.fontSize = '24px';
            console.log('⏰ Showing waiting indicator');
        }
    }
}

// Check if game is over
function checkGameOver() {
    // Don't check if already game over
    if (gameData.isGameOver) return;
    
    // Game ends when deck is empty and someone has no cards
    if (gameData.deck.length === 0) {
        if (gameData.playerHand.length === 0) {
            gameData.isGameOver = true;
            gameData.winner = 'player';
            
            // Send game over state to other player BEFORE showing end screen
            if (window.sendGameMove) {
                window.sendGameMove({
                    type: 'gameOver',
                    winner: 'player',
                    gameData: gameData
                });
            }
            
            // Small delay to ensure other player receives the update
            setTimeout(() => {
                endGame('Player 1 wins!');
            }, 100);
            
        } else if (gameData.opponentHand.length === 0) {
            gameData.isGameOver = true;
            gameData.winner = 'opponent';
            
            // Send game over state to other player BEFORE showing end screen
            if (window.sendGameMove) {
                window.sendGameMove({
                    type: 'gameOver',
                    winner: 'opponent',
                    gameData: gameData
                });
            }
            
            // Small delay to ensure other player receives the update
            setTimeout(() => {
                endGame('Player 2 wins!');
            }, 100);
        }
    }
}

// End game with simple victory screen
function endGame(message) {
    console.log('Game ended:', message, 'Winner:', gameData.winner, 'isHost:', isHost);
    
    // Stop timer
    if (window.stopGameTimer) {
        window.stopGameTimer();
    }
    
    // Clear any intervals
    if (window.timerInterval) {
        clearInterval(window.timerInterval);
        window.timerInterval = null;
    }
    
    // Check if this was a timeout loss
    if (gameData.timeoutLoss) {
        // Use the timeout-specific end screen
        const isWinner = (gameData.winner === 'player' && isHost) || (gameData.winner === 'opponent' && !isHost);
        if (window.endGameWithTimeout) {
            window.endGameWithTimeout(isWinner);
        }
        return;
    }
    
    // Determine winner
    let isWinner = false;
    let winnerText = '';
    
    if (gameData.winner === 'player') {
        isWinner = isHost;
        winnerText = isHost ? 'You won 0.198 SOL!' : 'Opponent won 0.198 SOL';
    } else {
        isWinner = !isHost;
        winnerText = !isHost ? 'You won 0.198 SOL!' : 'Opponent won 0.198 SOL';
    }
    
    // Create victory screen dynamically
    const existingScreen = document.getElementById('gameOverScreen');
    if (existingScreen) {
        existingScreen.remove();
    }
    
    const victoryDiv = document.createElement('div');
    victoryDiv.id = 'gameOverScreen';
    victoryDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1e3c72 0%, #2a4e7c 100%);
        border: 3px solid #4a5568;
        border-radius: 20px;
        padding: 40px;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
        min-width: 400px;
    `;
    
    let content = `
        <h1 style="color: ${isWinner ? '#ffd700' : '#ef4444'}; font-size: 36px; margin-bottom: 20px;">
            ${isWinner ? '🎉 Victory!' : '😢 Defeat'}
        </h1>
        <p style="color: white; font-size: 24px; margin-bottom: 20px;">
            Game Finished!
        </p>
        <p style="color: ${isWinner ? '#4ade80' : '#94a3b8'}; font-size: 20px; margin-bottom: 30px;">
            ${winnerText}
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
    
    victoryDiv.innerHTML = content;
    document.body.appendChild(victoryDiv);
    
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

// Update game display with PROPER timer switching
function updateGameDisplay() {
    console.log('🎮 UPDATE DISPLAY: isHost:', isHost, 'turn:', gameData.currentTurn, 'phase:', gameData.gamePhase);
    
    // Don't update if game is over
    if (gameData.isGameOver) {
        console.log('Game is over, skipping display update');
        return;
    }
    
    // Update deck count
    const deckCount = document.getElementById('deckCount');
    if (deckCount && gameData.deck) {
        deckCount.textContent = gameData.deck.length;
    }
    
    // Update trump display
    const deckAndTrump = document.querySelector('.deck-and-trump');
    if (deckAndTrump && gameData.trumpSuit) {
        let trumpDisplay = document.getElementById('trumpDisplay');
        if (!trumpDisplay) {
            trumpDisplay = document.createElement('div');
            trumpDisplay.id = 'trumpDisplay';
            trumpDisplay.style.cssText = `
                background: rgba(0, 0, 0, 0.5);
                padding: 8px 15px;
                border-radius: 10px;
                font-size: 20px;
                font-weight: bold;
                margin-top: 10px;
                text-align: center;
            `;
            deckAndTrump.appendChild(trumpDisplay);
        }
        trumpDisplay.innerHTML = `Trump: <span style="color: ${gameData.trumpSuit === '♥' || gameData.trumpSuit === '♦' ? '#ef4444' : '#fff'}; font-size: 24px;">${gameData.trumpSuit}</span>`;
    }
    
    // Hide the trump card element
    const trumpCardEl = document.getElementById('trumpCard');
    if (trumpCardEl) {
        trumpCardEl.style.display = 'none';
    }
    
    // Update beat pile
    const beatPileEl = document.getElementById('beatPile');
    const beatPileCount = document.getElementById('beatPileCount');
    if (beatPileEl && beatPileCount) {
        beatPileEl.style.display = gameData.beatPile && gameData.beatPile.length > 0 ? 'flex' : 'none';
        beatPileCount.textContent = gameData.beatPile ? gameData.beatPile.length : 0;
    }
    
    // Update hands based on player perspective
    if (window.isHost !== undefined) {
        if (isHost) {
            updateHand('playerHand', gameData.playerHand, gameData.currentTurn === 'player');
            updateHand('opponentHand', gameData.opponentHand, gameData.currentTurn === 'opponent', true);
        } else {
            updateHand('playerHand', gameData.opponentHand, gameData.currentTurn === 'opponent');
            updateHand('opponentHand', gameData.playerHand, gameData.currentTurn === 'player', true);
        }
    }
    
    // Update battle area
    updateBattleArea();
    
    // Update action buttons
    updateActionButtons();
    
    // Update game status
    updateGameStatus();
    
    // CRITICAL: Timer management - show timer for whoever needs to act
    const timerContainer = document.querySelector('.timer-container');
    const timerEl = document.getElementById('timer');
    
    // Force timer container to be visible during game
    if (timerContainer && window.gameState === 'playing') {
        timerContainer.style.display = 'block';
    }
    
    // Timer logic for multiplayer - show timer for active player only
    if (window.isMultiplayer && window.gameState === 'playing') {
        const isActiveNow = window.isActivePlayer && window.isActivePlayer();
        
        console.log('🎮 DISPLAY: Timer check - isActiveNow:', isActiveNow);
        
        if (isActiveNow) {
            // I need to act - ensure timer is running
            if (!window.timerInterval && timerEl) {
                console.log('🎮 DISPLAY: Starting timer for active player');
                if (window.startTimer) {
                    window.startTimer();
                }
            }
        } else {
            // Not my turn - stop timer and show waiting
            if (window.timerInterval) {
                console.log('🎮 DISPLAY: Stopping timer - not active');
                clearInterval(window.timerInterval);
                window.timerInterval = null;
            }
            
            // Show waiting indicator
            if (timerEl) {
                timerEl.textContent = '⏳';
                timerEl.style.color = '#94a3b8';
                timerEl.style.animation = 'none';
                timerEl.style.fontSize = '24px';
            }
        }
    }
}

// ... (rest of the functions remain the same: updateHand, updateBattleArea, updateActionButtons, etc.)

// Update hand display
function updateHand(elementId, hand, isActive, hideCards = false) {
    const handEl = document.getElementById(elementId);
    if (!handEl) return;
    
    handEl.innerHTML = '';
    
    hand.forEach((card, index) => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        
        if (hideCards) {
            cardEl.classList.add('face-down');
        } else {
            cardEl.textContent = card.rank + card.suit;
            cardEl.classList.add(card.suit === '♥' || card.suit === '♦' ? 'red' : 'black');
            
            // Check if this is the player's hand
            const isPlayerHand = elementId === 'playerHand';
            
            if (isPlayerHand) {
                // Determine if player should be able to play
                const isMyPhase = (isHost && gameData.currentTurn === 'player') || 
                                  (!isHost && gameData.currentTurn === 'opponent');
                
                let canPlay = false;
                if (gameData.gamePhase === 'attacking' && isMyPhase) {
                    canPlay = true; // Attacker can play
                } else if (gameData.gamePhase === 'defending' && !isMyPhase) {
                    canPlay = true; // Defender can play
                }
                
                if (canPlay) {
                    const validCards = getValidCards(hand, gameData.gamePhase);
                    const isValid = validCards.some(c => c.rank === card.rank && c.suit === card.suit);
                    
                    if (isValid) {
                        cardEl.classList.add('playable');
                        cardEl.style.cursor = 'pointer';
                        cardEl.onclick = () => {
                            console.log('Card clicked:', index);
                            selectCard(cardEl, index);
                        };
                    }
                }
            }
        }
        
        handEl.appendChild(cardEl);
    });
}

// Update battle area display
function updateBattleArea() {
    const battleAreaEl = document.getElementById('battleArea');
    if (!battleAreaEl) return;
    
    battleAreaEl.innerHTML = '';
    
    if (gameData.battleArea.length === 0) {
        const statusEl = document.createElement('div');
        statusEl.className = 'game-status';
        statusEl.id = 'gameStatus';
        battleAreaEl.appendChild(statusEl);
        return;
    }
    
    gameData.battleArea.forEach(pair => {
        const pairEl = document.createElement('div');
        pairEl.className = 'attack-pair';
        
        // Attack card
        const attackEl = document.createElement('div');
        attackEl.className = `card attack-card ${pair.attack.suit === '♥' || pair.attack.suit === '♦' ? 'red' : 'black'}`;
        attackEl.textContent = pair.attack.rank + pair.attack.suit;
        pairEl.appendChild(attackEl);
        
        // Defense card (if exists)
        if (pair.defense) {
            const defenseEl = document.createElement('div');
            defenseEl.className = `card defense-card ${pair.defense.suit === '♥' || pair.defense.suit === '♦' ? 'red' : 'black'}`;
            defenseEl.textContent = pair.defense.rank + pair.defense.suit;
            pairEl.appendChild(defenseEl);
        }
        
        battleAreaEl.appendChild(pairEl);
    });
}

// Update action buttons
function updateActionButtons() {
    const takeBtn = document.getElementById('takeBtn');
    const beatBtn = document.getElementById('beatBtn');
    const passBtn = document.getElementById('passBtn');
    
    // Hide all buttons by default
    if (takeBtn) takeBtn.style.display = 'none';
    if (beatBtn) beatBtn.style.display = 'none';
    if (passBtn) passBtn.style.display = 'none';
    
    // Determine whose turn it is
    const isMyPhase = (isHost && gameData.currentTurn === 'player') || 
                      (!isHost && gameData.currentTurn === 'opponent');
    
    // Show appropriate buttons based on game state and player perspective
    if (gameData.gamePhase === 'defending') {
        // Check if I'm the defender
        const amDefending = !isMyPhase;
        
        if (amDefending && gameData.battleArea.length > 0) {
            // I'm defending and there are attacks - show take button
            if (takeBtn) {
                takeBtn.style.display = 'block';
            }
        }
        
        if (isMyPhase) {
            // I'm attacking and all attacks are defended - show beat button
            const allDefended = gameData.battleArea.length > 0 && 
                               gameData.battleArea.every(pair => pair.defense);
            if (allDefended && beatBtn) {
                beatBtn.style.display = 'block';
            }
        }
    } else if (gameData.gamePhase === 'attacking') {
        if (isMyPhase && gameData.battleArea.length > 0) {
            // I'm attacking and have played cards - show pass button
            if (passBtn) {
                passBtn.style.display = 'block';
            }
        }
    }
}

// Update game status message
function updateGameStatus() {
    let status = '';
    
    if (gameData.isGameOver) {
        if (gameData.timeoutLoss) {
            status = 'Game ended - Time ran out!';
        } else {
            status = gameData.winner === 'player' ? 'Player 1 wins!' : 'Player 2 wins!';
        }
    } else {
        const isMyPhase = (isHost && gameData.currentTurn === 'player') || 
                          (!isHost && gameData.currentTurn === 'opponent');
        
        if (gameData.gamePhase === 'attacking') {
            if (isMyPhase) {
                status = 'Your turn: Attack (click any card)';
            } else {
                status = "Opponent's turn to attack";
            }
        } else if (gameData.gamePhase === 'defending') {
            if (!isMyPhase) {
                status = 'Your turn: Defend or Take';
            } else {
                status = "Opponent's turn to defend";
            }
        }
    }
    
    if (window.showGameStatus) {
        window.showGameStatus(status);
    }
}

// Enter game mode (start a new game)
function enterGameMode() {
    console.log('Entering game mode, isHost:', isHost);
    
    // Reset game data
    gameData = {
        deck: [],
        playerHand: [],
        opponentHand: [],
        trumpSuit: null,
        trumpCard: null,
        battleArea: [],
        beatPile: [],
        currentTurn: 'player',
        gamePhase: 'attacking',
        selectedCard: null,
        isGameOver: false,
        winner: null,
        lastAction: null,
        timeoutLoss: false
    };
    
    // Set global gameState
    window.gameState = 'playing';
    
    // Only host deals cards
    if (isHost) {
        console.log('Host dealing cards...');
        dealInitialCards();
        
        // Send initial game state
        if (window.sendGameMove) {
            console.log('Sending initial game state...');
            window.sendGameMove({
                type: 'init',
                gameData: gameData
            });
        }
        
        // Update display for host
        updateGameDisplay();
    } else {
        console.log('Guest waiting for game state...');
        // Guest waits for game state from host
    }
}

// Handle multiplayer game state update
function updateMultiplayerGameState(newGameData) {
    console.log('🔄 MULTIPLAYER UPDATE: Updating game state from opponent');
    console.log('🔄 BEFORE UPDATE: turn =', gameData.currentTurn, 'phase =', gameData.gamePhase);
    console.log('🔄 NEW DATA: turn =', newGameData.currentTurn, 'phase =', newGameData.gamePhase);
    
    // Check if this is a game over update
    const wasGameOver = gameData.isGameOver;
    
    // CRITICAL: Update game data with new state
    gameData = newGameData;
    
    console.log('🔄 AFTER UPDATE: turn =', gameData.currentTurn, 'phase =', gameData.gamePhase);
    
    // Check for timeout loss
    if (!wasGameOver && gameData.isGameOver && gameData.timeoutLoss) {
        console.log('Game ended due to timeout from opponent');
        // Determine if current player won
        const isWinner = (gameData.winner === 'player' && isHost) || (gameData.winner === 'opponent' && !isHost);
        if (window.endGameWithTimeout) {
            window.endGameWithTimeout(isWinner);
        }
        return;
    }
    
    // Set the global gameState to playing when game data is received
    if (!window.gameState || window.gameState !== 'playing') {
        window.gameState = 'playing';
        console.log('🔄 Setting gameState to playing for guest');
        
        // Make sure timer container is visible
        const timerContainer = document.querySelector('.timer-container');
        if (timerContainer) {
            timerContainer.style.display = 'block';
            console.log('🔄 Timer container made visible');
        }
    }
    
    // CRITICAL: Update the display which will handle timer switching
    console.log('🔄 Calling updateGameDisplay with new phase:', gameData.gamePhase);
    updateGameDisplay();
    
    // CRITICAL: Force timer check after state update
    console.log('🔄 Forcing timer switch after multiplayer update');
    switchTimerToActivePlayer('Multiplayer state updated');
    
    // If this is the initial state and we're the guest, game has started
    if (!isHost && gameData.deck && gameData.deck.length > 0 && !wasGameOver) {
        console.log('Guest received initial game state');
        if (window.showGameStatus) {
            window.showGameStatus('Game started!', 'success');
        }
    }
    
    // Check if game just ended (non-timeout)
    if (!wasGameOver && gameData.isGameOver && !gameData.timeoutLoss) {
        console.log('Game over received from opponent');
        // Show end game screen for this player too
        const message = gameData.winner === 'player' ? 'Player 1 wins!' : 'Player 2 wins!';
        endGame(message);
    }
}

// Set multiplayer mode
function setMultiplayerMode(host) {
    isHost = host;
}

// Return to lobby from game
window.returnToLobbyFromGame = function() {
    // Remove game over screen
    const gameOverScreen = document.getElementById('gameOverScreen');
    if (gameOverScreen) {
        gameOverScreen.remove();
    }
    
    // Hide any other modals
    const victoryModal = document.getElementById('victoryModal');
    if (victoryModal) {
        victoryModal.style.display = 'none';
    }
    
    // Reset game state
    gameData = {
        deck: [],
        playerHand: [],
        opponentHand: [],
        trumpSuit: null,
        trumpCard: null,
        battleArea: [],
        beatPile: [],
        currentTurn: 'player',
        gamePhase: 'attacking',
        selectedCard: null,
        isGameOver: false,
        winner: null,
        lastAction: null,
        timeoutLoss: false
    };
    
    // Clear multiplayer flags
    window.isMultiplayer = false;
    window.isHost = false;
    
    // Reset to lobby
    window.gameState = 'lobby';
    document.getElementById('gameBoard').style.display = 'none';
    document.getElementById('gameLobby').style.display = 'block';
    
    // Clear any status messages
    const statusEl = document.getElementById('statusMessage');
    if (statusEl) {
        statusEl.style.display = 'none';
    }
};

// Helper function to get player's hand based on perspective
window.getMyHand = function() {
    return isHost ? gameData.playerHand : gameData.opponentHand;
};

// Export functions for use in other modules
window.gameData = gameData;
window.enterGameMode = enterGameMode;
window.selectCard = selectCard;
window.takeCards = takeCards;
window.beatCards = beatCards;
window.passAttack = passAttack;
window.updateMultiplayerGameState = updateMultiplayerGameState;
window.setMultiplayerMode = setMultiplayerMode;