// config.js - Configuration and Constants

// Solana Network Configuration
const NETWORK = 'devnet';
const RPC_ENDPOINT = 'https://api.devnet.solana.com';

// Smart Contract Configuration
const TREASURY_WALLET = "784d9YHJegmvQZokFNnax31Lbfn9r8QKVqFfCGVsb8A7";
const PROGRAM_ID = "H4Tj8wzHPScxsWuRcPP3jJ2T5GTZvBzXoz1eNFYwhBYP";

// Game Configuration
const ENTRY_FEE = 0.1; // SOL per player
const HOUSE_FEE = 0.002; // SOL per player
const TOTAL_DEPOSIT = ENTRY_FEE + HOUSE_FEE; // 0.102 SOL per player
const WINNER_PAYOUT = 0.2; // SOL (both entry fees combined)

const TOTAL_POT = 0.2; // SOL (0.1 from each player)
const TOTAL_HOUSE_FEES = 0.004; // SOL (0.002 from each player)

// Multiplayer Configuration
const GAME_CODE_LENGTH = 6;
const POLLING_INTERVAL = 2000; // milliseconds
const TURN_TIME_LIMIT = 30; // seconds

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        NETWORK,
        RPC_ENDPOINT,
        TREASURY_WALLET,
        PROGRAM_ID,
        ENTRY_FEE,
        HOUSE_FEE,
        TOTAL_DEPOSIT,
        WINNER_PAYOUT,
        TOTAL_POT,
        TOTAL_HOUSE_FEES,
        GAME_CODE_LENGTH,
        POLLING_INTERVAL,
        TURN_TIME_LIMIT
    };
}