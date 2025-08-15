// wallet.js - Solana Wallet and Smart Contract Integration (Buffer-free)

// Global variables
let wallet = null;
let connection = null;

// Helper function to convert string to Uint8Array (replaces Buffer.from)
function stringToUint8Array(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}

// Helper function to convert hex string to Uint8Array
function hexToUint8Array(hex) {
    const result = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        result[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return result;
}

// Initialize Solana connection
async function initializeSolana() {
    try {
        if (typeof solanaWeb3 === 'undefined') {
            throw new Error('Solana Web3.js not loaded');
        }
        
        connection = new solanaWeb3.Connection(RPC_ENDPOINT, 'confirmed');
        console.log('Solana connection initialized');
        
        // Check if Phantom is installed
        if (window.solana && window.solana.isPhantom) {
            console.log('Phantom wallet detected');
        } else {
            showStatus('Please install Phantom wallet', 'error');
        }
    } catch (error) {
        console.error('Failed to initialize Solana:', error);
        showStatus('Failed to connect to Solana network', 'error');
    }
}

// Connect wallet
async function connectWallet() {
    try {
        showStatus('Connecting wallet...', 'info');
        
        if (!window.solana || !window.solana.isPhantom) {
            throw new Error('Phantom wallet not found. Please install Phantom.');
        }
        
        const resp = await window.solana.connect();
        wallet = window.solana;
        
        console.log('Wallet connected:', resp.publicKey.toString());
        
        // Get balance
        const balance = await connection.getBalance(resp.publicKey);
        const solBalance = balance / solanaWeb3.LAMPORTS_PER_SOL;
        
        // Update wallet info in lobby
        updateWalletDisplay(resp.publicKey.toString(), solBalance);
        
        // Update top bar (for in-game display)
        const topBarAddress = document.getElementById('walletAddress');
        const topBarBalance = document.getElementById('walletBalance');
        
        if (topBarAddress) {
            topBarAddress.textContent = 
                resp.publicKey.toString().slice(0, 4) + '...' + 
                resp.publicKey.toString().slice(-4);
        }
        
        if (topBarBalance) {
            topBarBalance.textContent = `${solBalance.toFixed(3)} SOL`;
        }
        
        showStatus('Wallet connected successfully!', 'success');
        
    } catch (err) {
        console.error('Failed to connect wallet:', err);
        showStatus(`Failed to connect wallet: ${err.message}`, 'error');
    }
}

// Update wallet display in lobby
function updateWalletDisplay(publicKey, balance) {
    // Hide connect button
    const connectBtn = document.getElementById('connectWallet');
    if (connectBtn) {
        connectBtn.style.display = 'none';
    }
    
    // Show wallet info
    const walletInfo = document.getElementById('walletInfo');
    if (walletInfo) {
        walletInfo.style.display = 'block';
    }
    
    // Update address display
    const addressDisplay = document.getElementById('walletAddressDisplay');
    if (addressDisplay) {
        addressDisplay.textContent = 
            publicKey.slice(0, 8) + '...' + publicKey.slice(-8);
    }
    
    // Update balance display
    const balanceDisplay = document.getElementById('walletBalanceDisplay');
    if (balanceDisplay) {
        balanceDisplay.textContent = `${balance.toFixed(3)} SOL`;
    }
    
    // Show game options
    const gameOptions = document.getElementById('gameOptions');
    if (gameOptions) {
        gameOptions.style.display = 'flex';
    }
}

// Disconnect wallet
async function disconnectWallet() {
    try {
        if (wallet && wallet.disconnect) {
            await wallet.disconnect();
        }
        
        wallet = null;
        
        // Reset UI
        resetWalletDisplay();
        
        showStatus('Wallet disconnected', 'info');
        
    } catch (error) {
        console.error('Error disconnecting wallet:', error);
        showStatus('Error disconnecting wallet', 'error');
    }
}

// Reset wallet display
function resetWalletDisplay() {
    // Show connect button
    const connectBtn = document.getElementById('connectWallet');
    if (connectBtn) {
        connectBtn.style.display = 'block';
    }
    
    // Hide wallet info
    const walletInfo = document.getElementById('walletInfo');
    if (walletInfo) {
        walletInfo.style.display = 'none';
    }
    
    // Hide game options
    const gameOptions = document.getElementById('gameOptions');
    if (gameOptions) {
        gameOptions.style.display = 'none';
    }
    
    // Reset displays
    const addressDisplay = document.getElementById('walletAddressDisplay');
    if (addressDisplay) {
        addressDisplay.textContent = 'Not connected';
    }
    
    const balanceDisplay = document.getElementById('walletBalanceDisplay');
    if (balanceDisplay) {
        balanceDisplay.textContent = '0.000 SOL';
    }
}

// Check wallet connection status
async function checkWalletConnection() {
    try {
        if (window.solana && window.solana.isConnected) {
            wallet = window.solana;
            const balance = await connection.getBalance(wallet.publicKey);
            const solBalance = balance / solanaWeb3.LAMPORTS_PER_SOL;
            
            updateWalletDisplay(wallet.publicKey.toString(), solBalance);
            return true;
        }
    } catch (error) {
        console.error('Error checking wallet connection:', error);
    }
    
    return false;
}

// Make game deposit - FIXED to use escrow instead of treasury
async function makeGameDeposit(isHost) {
    if (!wallet || !connection) {
        throw new Error('Wallet not connected');
    }
    
    showStatus(`Depositing ${TOTAL_DEPOSIT} SOL...`, 'info');
    
    try {
        // Get escrow wallet from current game session
        let escrowAddress;
        if (window.currentGameSession && window.currentGameSession.escrowWallet) {
            escrowAddress = window.currentGameSession.escrowWallet;
            console.log('Using escrow wallet:', escrowAddress);
        } else {
            // Fallback to treasury if no escrow (shouldn't happen)
            escrowAddress = TREASURY_WALLET;
            console.log('Fallback to treasury wallet:', escrowAddress);
        }
        
        // SOL transfer to escrow (not treasury)
        const transferInstruction = solanaWeb3.SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: new solanaWeb3.PublicKey(escrowAddress),
            lamports: Math.floor(TOTAL_DEPOSIT * solanaWeb3.LAMPORTS_PER_SOL),
        });
        
        const transaction = new solanaWeb3.Transaction().add(transferInstruction);
        
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        const signedTransaction = await wallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());
        
        await connection.confirmTransaction(signature, 'confirmed');
        
        console.log('Deposit confirmed:', signature);
        console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        showStatus('Deposit confirmed!', 'success');
        
        // Update balance display
        const newBalance = await connection.getBalance(wallet.publicKey);
        const newSolBalance = newBalance / solanaWeb3.LAMPORTS_PER_SOL;
        
        const balanceDisplay = document.getElementById('walletBalanceDisplay');
        if (balanceDisplay) {
            balanceDisplay.textContent = `${newSolBalance.toFixed(3)} SOL`;
        }
        
        const topBarBalance = document.getElementById('walletBalance');
        if (topBarBalance) {
            topBarBalance.textContent = `${newSolBalance.toFixed(3)} SOL`;
        }
        
        return signature;
        
    } catch (error) {
        console.error('Deposit failed:', error);
        
        let errorMessage = 'Transaction failed';
        if (error.message.includes('insufficient funds') || error.message.includes('insufficient lamports')) {
            errorMessage = 'Insufficient SOL balance';
        } else if (error.message.includes('User rejected')) {
            errorMessage = 'Transaction cancelled by user';
        } else if (error.message.includes('blockhash not found')) {
            errorMessage = 'Network congestion. Please try again.';
        }
        
        showStatus(errorMessage, 'error');
        throw error;
    }
}

// FIXED: Real payout transaction from escrow to winner
async function payoutToWinner(winnerAddress) {
    console.log('🎯 REAL PAYOUT START:');
    console.log('- Winner address:', winnerAddress);
    console.log('- My wallet:', wallet ? wallet.publicKey.toString() : 'null');
    
    // Only the winner should call this function
    if (!wallet || !winnerAddress) {
        console.log('❌ No wallet or winner address');
        return null;
    }
    
    const myAddress = wallet.publicKey.toString();
    const isWinner = myAddress === winnerAddress;
    
    console.log('- Am I the winner?', isWinner);
    
    if (!isWinner) {
        console.log('✅ I am not the winner - no payout for me');
        showStatus('Game ended - opponent won', 'info');
        return null;
    }
    
    console.log('🎉 I am the winner - processing REAL payout from escrow...');
    
    // Check if we have escrow data
    if (!window.currentGameSession || !window.currentGameSession.escrowKeypair) {
        console.log('❌ No escrow keypair available');
        showStatus('No escrow account available - contact support', 'error');
        return null;
    }
    
    try {
        showStatus('Processing winner payout from escrow...', 'info');
        
        const escrowKeypair = window.currentGameSession.escrowKeypair;
        
        // Check escrow balance
        const escrowBalance = await connection.getBalance(escrowKeypair.publicKey);
        const escrowSolBalance = escrowBalance / solanaWeb3.LAMPORTS_PER_SOL;
        
        console.log('📦 Escrow balance:', escrowSolBalance, 'SOL');
        console.log('💰 Need to pay:', WINNER_PAYOUT, 'SOL');
        
        if (escrowBalance < WINNER_PAYOUT * solanaWeb3.LAMPORTS_PER_SOL) {
            throw new Error(`Insufficient escrow balance: ${escrowSolBalance.toFixed(3)} SOL (need ${WINNER_PAYOUT} SOL)`);
        }
        
        // Get fresh blockhash
        console.log('🔄 Getting blockhash...');
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        console.log('✅ Got blockhash');
        
        // Calculate exact payout amount (winner gets both entry fees)
        const payoutLamports = Math.floor(WINNER_PAYOUT * solanaWeb3.LAMPORTS_PER_SOL);
        console.log('💸 Paying out:', payoutLamports, 'lamports');
        
        // Create payout transaction FROM escrow TO winner
        const transaction = new solanaWeb3.Transaction({
            recentBlockhash: blockhash,
            feePayer: escrowKeypair.publicKey // Escrow pays the fees
        }).add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: escrowKeypair.publicKey,  // FROM escrow
                toPubkey: new solanaWeb3.PublicKey(winnerAddress), // TO winner
                lamports: payoutLamports
            })
        );
        
        console.log('✍️ Signing transaction with escrow keypair...');
        // Sign with escrow keypair (this is allowed since we created the escrow)
        transaction.partialSign(escrowKeypair);
        console.log('✅ Transaction signed');
        
        // Send transaction
        console.log('🚀 Sending payout transaction...');
        const signature = await connection.sendRawTransaction(
            transaction.serialize(),
            {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 3
            }
        );
        
        console.log('📤 Transaction sent:', signature);
        
        // Wait for confirmation with timeout
        console.log('⏳ Waiting for confirmation...');
        const confirmation = await Promise.race([
            connection.confirmTransaction({
                signature: signature,
                blockhash: blockhash,
                lastValidBlockHeight: lastValidBlockHeight
            }, 'confirmed'),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Confirmation timeout')), 30000)
            )
        ]);
        
        if (confirmation.value && confirmation.value.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }
        
        console.log('🎉 REAL PAYOUT SUCCESS!');
        console.log('- Transaction signature:', signature);
        console.log('- Explorer: https://solscan.io/tx/' + signature + '?cluster=devnet');
        
        showStatus(`🎉 Payout completed! You received ${WINNER_PAYOUT} SOL`, 'success');
        
        // Update balance display after payout
        setTimeout(async () => {
            try {
                const newBalance = await connection.getBalance(wallet.publicKey);
                const newSolBalance = newBalance / solanaWeb3.LAMPORTS_PER_SOL;
                
                const balanceDisplay = document.getElementById('walletBalanceDisplay');
                if (balanceDisplay) {
                    balanceDisplay.textContent = `${newSolBalance.toFixed(3)} SOL`;
                }
                
                const topBarBalance = document.getElementById('walletBalance');
                if (topBarBalance) {
                    topBarBalance.textContent = `${newSolBalance.toFixed(3)} SOL`;
                }
                
                console.log('💰 Updated balance:', newSolBalance.toFixed(3), 'SOL');
            } catch (balanceError) {
                console.log('⚠️ Failed to update balance display:', balanceError.message);
            }
        }, 3000);
        
        return signature;
        
    } catch (error) {
        console.error('❌ REAL PAYOUT FAILED:', error);
        
        let errorMessage = 'Payout failed';
        if (error.message.includes('insufficient funds') || error.message.includes('insufficient lamports')) {
            errorMessage = 'Insufficient escrow balance for payout';
        } else if (error.message.includes('Confirmation timeout')) {
            errorMessage = 'Payout sent but confirmation timed out - check explorer';
        } else if (error.message.includes('blockhash not found')) {
            errorMessage = 'Network issue - payout failed';
        } else {
            errorMessage = `Payout failed: ${error.message}`;
        }
        
        showStatus(errorMessage, 'error');
        throw error;
    }
}

// FIXED: Payout from escrow (if using escrow system)
async function payoutFromEscrow(winnerAddress) {
    if (!window.currentGameSession || !window.currentGameSession.escrowKeypair) {
        throw new Error('No escrow account available');
    }
    
    try {
        console.log('📦 Processing escrow payout...');
        
        const escrowKeypair = window.currentGameSession.escrowKeypair;
        
        // Check escrow balance
        const escrowBalance = await connection.getBalance(escrowKeypair.publicKey);
        const escrowSolBalance = escrowBalance / solanaWeb3.LAMPORTS_PER_SOL;
        
        console.log('- Escrow balance:', escrowSolBalance, 'SOL');
        
        if (escrowBalance < WINNER_PAYOUT * solanaWeb3.LAMPORTS_PER_SOL) {
            throw new Error(`Insufficient escrow balance: ${escrowSolBalance} SOL`);
        }
        
        // Get fresh blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        
        // Create payout transaction FROM escrow TO winner
        const transaction = new solanaWeb3.Transaction({
            recentBlockhash: blockhash,
            feePayer: escrowKeypair.publicKey
        }).add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: escrowKeypair.publicKey,
                toPubkey: new solanaWeb3.PublicKey(winnerAddress),
                lamports: Math.floor(WINNER_PAYOUT * solanaWeb3.LAMPORTS_PER_SOL)
            })
        );
        
        // Sign with escrow keypair (not user wallet)
        transaction.partialSign(escrowKeypair);
        
        // Send transaction
        const signature = await connection.sendRawTransaction(
            transaction.serialize(),
            {
                skipPreflight: false,
                preflightCommitment: 'confirmed'
            }
        );
        
        // Confirm transaction
        const confirmation = await connection.confirmTransaction({
            signature: signature,
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight
        }, 'confirmed');
        
        if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }
        
        console.log('✅ Escrow payout confirmed:', signature);
        console.log(`- Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        
        showStatus(`Winner payout completed! ${WINNER_PAYOUT} SOL`, 'success');
        
        // Clean up escrow
        if (window.currentGameSession.code) {
            localStorage.removeItem(`game_${window.currentGameSession.code}`);
        }
        
        return signature;
        
    } catch (error) {
        console.error('❌ ESCROW PAYOUT FAILED:', error);
        throw error;
    }
}

// Show status message
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        statusEl.style.display = 'block';
        
        if (type !== 'error') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        } else {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 10000);
        }
    }
    
    // Also log to console
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Initialize on load
window.addEventListener('load', async () => {
    await initializeSolana();
    
    // Check if wallet is already connected
    setTimeout(async () => {
        await checkWalletConnection();
    }, 1000);
});

// Handle wallet events
if (window.solana) {
    window.solana.on('connect', () => {
        console.log('Wallet connected via event');
    });
    
    window.solana.on('disconnect', () => {
        console.log('Wallet disconnected via event');
        resetWalletDisplay();
    });
}

// Export wallet functions
window.walletFunctions = {
    connectWallet,
    disconnectWallet,
    makeGameDeposit,
    payoutToWinner,
    checkWalletConnection,
    showStatus
};