// js/firebase.js - Firebase Configuration and Database Functions

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAlyA30dmUf0offjWdwz3Q8w4VhLGyz0GA",
    authDomain: "durak-sol-app.firebaseapp.com",
    databaseURL: "https://durak-sol-app-default-rtdb.firebaseio.com/",
    projectId: "durak-sol-app",
    storageBucket: "durak-sol-app.firebasestorage.app",
    messagingSenderId: "24579219358",
    appId: "1:24579219358:web:5910eca9f37af46401c08f"
  };
  
  // Initialize Firebase
  const app = firebase.initializeApp(firebaseConfig);
  const database = firebase.database();
  
  console.log('🔥 Firebase initialized successfully');
  
  // Database helper functions
  const FirebaseDB = {
    // Save game to Firebase instead of localStorage
    saveGame: async function(gameCode, gameData) {
      try {
        await database.ref(`games/${gameCode}`).set({
          ...gameData,
          lastUpdated: Date.now()
        });
        console.log('🎮 Game saved to Firebase:', gameCode);
        return true;
      } catch (error) {
        console.error('❌ Error saving game to Firebase:', error);
        return false;
      }
    },
  
    // Get game from Firebase instead of localStorage
    getGame: async function(gameCode) {
      try {
        const snapshot = await database.ref(`games/${gameCode}`).once('value');
        const gameData = snapshot.val();
        console.log('🎮 Game loaded from Firebase:', gameCode, gameData ? 'Found' : 'Not found');
        return gameData;
      } catch (error) {
        console.error('❌ Error loading game from Firebase:', error);
        return null;
      }
    },
  
    // Update game state (for multiplayer sync)
    updateGameState: async function(gameCode, gameState) {
      try {
        await database.ref(`gameStates/${gameCode}`).set({
          ...gameState,
          timestamp: Date.now()
        });
        console.log('🔄 Game state updated in Firebase:', gameCode);
        return true;
      } catch (error) {
        console.error('❌ Error updating game state:', error);
        return false;
      }
    },
  
    // Listen for game state changes (replaces polling)
    listenToGameState: function(gameCode, callback) {
      const gameStateRef = database.ref(`gameStates/${gameCode}`);
      
      // Listen for changes
      gameStateRef.on('value', (snapshot) => {
        const gameState = snapshot.val();
        if (gameState) {
          console.log('🔄 Game state changed:', gameCode);
          callback(gameState);
        }
      });
      
      // Return unsubscribe function
      return () => {
        gameStateRef.off();
        console.log('🔇 Stopped listening to game state:', gameCode);
      };
    },
  
    // Listen for game updates (when someone joins)
    listenToGame: function(gameCode, callback) {
      const gameRef = database.ref(`games/${gameCode}`);
      
      // Listen for changes
      gameRef.on('value', (snapshot) => {
        const gameData = snapshot.val();
        if (gameData) {
          console.log('🎮 Game data changed:', gameCode);
          callback(gameData);
        }
      });
      
      // Return unsubscribe function
      return () => {
        gameRef.off();
        console.log('🔇 Stopped listening to game:', gameCode);
      };
    },
  
    // Clean up old games (optional)
    cleanupGame: async function(gameCode) {
      try {
        await database.ref(`games/${gameCode}`).remove();
        await database.ref(`gameStates/${gameCode}`).remove();
        console.log('🧹 Game cleaned up from Firebase:', gameCode);
        return true;
      } catch (error) {
        console.error('❌ Error cleaning up game:', error);
        return false;
      }
    },
  
    // Test Firebase connection
    testConnection: async function() {
      try {
        await database.ref('test').set({
          timestamp: Date.now(),
          message: 'Firebase connection test'
        });
        console.log('✅ Firebase connection test successful');
        
        // Clean up test
        await database.ref('test').remove();
        return true;
      } catch (error) {
        console.error('❌ Firebase connection test failed:', error);
        return false;
      }
    }
  };
  
  // Make FirebaseDB available globally
  window.FirebaseDB = FirebaseDB;
  
  // Test connection on load
  FirebaseDB.testConnection().then(success => {
    if (success) {
      console.log('🚀 Firebase ready for multiplayer gaming!');
    } else {
      console.error('🔥 Firebase connection issues - check console');
    }
  });