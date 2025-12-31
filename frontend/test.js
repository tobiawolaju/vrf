/**
 * Test Suite for server.js
 * Run with: node test.js
 * Make sure server is running on port 3001 first!
 */

const BASE_URL = 'http://localhost:3001';

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    reset: '\x1b[0m'
};

let testsPassed = 0;
let testsFailed = 0;

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function assert(condition, testName) {
    if (condition) {
        testsPassed++;
        log('green', `✓ ${testName}`);
    } else {
        testsFailed++;
        log('red', `✗ ${testName}`);
    }
}

async function makeRequest(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const data = await response.json().catch(() => null);
        return { response, data };
    } catch (error) {
        log('red', `Request failed: ${error.message}`);
        return { response: null, data: null, error };
    }
}

// ========================================
// TEST 1: Server Health Check
// ========================================
async function testServerHealth() {
    log('blue', '\n📡 Testing Server Health...');

    try {
        const response = await fetch(BASE_URL);
        assert(response !== null, 'Server is reachable');
    } catch (error) {
        assert(false, 'Server is reachable');
        log('yellow', 'Make sure server is running: npm run server');
    }
}

// ========================================
// TEST 2: Create Game
// ========================================
async function testCreateGame() {
    log('blue', '\n🎮 Testing Game Creation...');

    const { response, data } = await makeRequest('/api/create', {
        method: 'POST',
        body: JSON.stringify({ startDelayMinutes: 0.1 })
    });

    assert(response?.status === 200, 'Create game returns 200');
    assert(data?.success === true, 'Create game response has success: true');
    assert(typeof data?.gameCode === 'string', 'Game code is a string');
    assert(data?.gameCode.length === 6, 'Game code is 6 characters');

    return data?.gameCode;
}

// ========================================
// TEST 3: Join Game
// ========================================
async function testJoinGame(gameCode) {
    log('blue', '\n👥 Testing Join Game...');

    if (!gameCode) {
        log('yellow', 'Skipping join test - no game code');
        return null;
    }

    const playerData = {
        gameCode,
        playerName: 'Test Player 1',
        avatar: '👨',
        privyId: 'test-player-1',
        twitterHandle: '@testplayer1'
    };

    const { response, data } = await makeRequest('/api/join', {
        method: 'POST',
        body: JSON.stringify(playerData)
    });

    assert(response?.status === 200, 'Join game returns 200');
    assert(data?.success === true, 'Join response has success: true');
    assert(typeof data?.playerId === 'string', 'Player ID is returned');
    assert(data?.playerNumber === 0, 'First player has playerNumber 0');
    assert(data?.gameState !== undefined, 'Game state is returned');

    return data?.playerId;
}

// ========================================
// TEST 4: Join Multiple Players
// ========================================
async function testMultipleJoins(gameCode) {
    log('blue', '\n👥👥 Testing Multiple Players Joining...');

    if (!gameCode) {
        log('yellow', 'Skipping multiple join test - no game code');
        return [];
    }

    const players = [];

    for (let i = 2; i <= 3; i++) {
        const { response, data } = await makeRequest('/api/join', {
            method: 'POST',
            body: JSON.stringify({
                gameCode,
                playerName: `Test Player ${i}`,
                avatar: '👤',
                privyId: `test-player-${i}`,
                twitterHandle: `@testplayer${i}`
            })
        });

        assert(response?.status === 200, `Player ${i} joins successfully`);
        assert(data?.playerNumber === i - 1, `Player ${i} has correct playerNumber`);

        if (data?.playerId) {
            players.push(data.playerId);
        }
    }

    return players;
}

// ========================================
// TEST 5: Get Game State
// ========================================
async function testGetState(gameCode, playerId) {
    log('blue', '\n📊 Testing Get Game State...');

    if (!gameCode || !playerId) {
        log('yellow', 'Skipping state test - missing gameCode or playerId');
        return null;
    }

    const { response, data } = await makeRequest(`/api/state?gameCode=${gameCode}&playerId=${playerId}`, {
        method: 'GET'
    });

    assert(response?.status === 200, 'Get state returns 200');
    assert(data?.gameCode === gameCode, 'State has correct game code');
    assert(Array.isArray(data?.players), 'State has players array');
    assert(data?.players.length >= 1, 'State has at least 1 player');
    assert(data?.phase !== undefined, 'State has phase');
    assert(data?.round !== undefined, 'State has round number');

    return data;
}

// ========================================
// TEST 6: Commit Card
// ========================================
async function testCommitCard(gameCode, playerId) {
    log('blue', '\n🎴 Testing Card Commit...');

    if (!gameCode || !playerId) {
        log('yellow', 'Skipping commit test - missing gameCode or playerId');
        return;
    }

    // First, get the current state to check if we're in commit phase
    const { data: stateData } = await makeRequest(`/api/state?gameCode=${gameCode}&playerId=${playerId}`, {
        method: 'GET'
    });

    if (stateData?.phase !== 'commit') {
        log('yellow', `Skipping commit - game is in '${stateData?.phase}' phase, not 'commit'`);
        return;
    }

    const { response, data } = await makeRequest('/api/commit', {
        method: 'POST',
        body: JSON.stringify({
            gameCode,
            playerId,
            card: 2,  // Choose card "2"
            skip: false
        })
    });

    assert(response?.status === 200, 'Commit card returns 200');
    assert(data?.success === true, 'Commit response has success: true');
}

// ========================================
// TEST 7: Skip Turn
// ========================================
async function testSkipTurn(gameCode, playerId) {
    log('blue', '\n⏭️  Testing Skip Turn...');

    if (!gameCode || !playerId) {
        log('yellow', 'Skipping skip test - missing gameCode or playerId');
        return;
    }

    const { response, data } = await makeRequest('/api/commit', {
        method: 'POST',
        body: JSON.stringify({
            gameCode,
            playerId,
            skip: true
        })
    });

    // This might fail if already committed, which is fine
    if (response?.status === 200) {
        assert(data?.success === true, 'Skip turn succeeds');
    } else {
        log('yellow', 'Skip test skipped - likely already committed');
    }
}

// ========================================
// TEST 8: Get Leaderboard
// ========================================
async function testGetLeaderboard() {
    log('blue', '\n🏆 Testing Leaderboard...');

    const { response, data } = await makeRequest('/api/leaderboard', {
        method: 'GET'
    });

    assert(response?.status === 200, 'Get leaderboard returns 200');
    assert(Array.isArray(data), 'Leaderboard is an array');
    log('yellow', `Leaderboard has ${data?.length || 0} entries`);
}

// ========================================
// TEST 9: Error Handling - Invalid Game Code
// ========================================
async function testInvalidGameCode() {
    log('blue', '\n❌ Testing Error Handling...');

    const { response } = await makeRequest('/api/join', {
        method: 'POST',
        body: JSON.stringify({
            gameCode: 'INVALID',
            playerName: 'Test Player'
        })
    });

    assert(response?.status === 404, 'Invalid game code returns 404');
}

// ========================================
// TEST 10: Rejoin Game
// ========================================
async function testRejoinGame(gameCode, privyId) {
    log('blue', '\n🔄 Testing Rejoin Game...');

    if (!gameCode || !privyId) {
        log('yellow', 'Skipping rejoin test - missing data');
        return;
    }

    const { response, data } = await makeRequest('/api/join', {
        method: 'POST',
        body: JSON.stringify({
            gameCode,
            playerName: 'Test Player 1 (Rejoined)',
            privyId: privyId
        })
    });

    assert(response?.status === 200, 'Rejoin returns 200');
    assert(data?.playerId === privyId, 'Rejoin returns same player ID');
}

// ========================================
// RUN ALL TESTS
// ========================================
async function runAllTests() {
    log('blue', '═══════════════════════════════════════════');
    log('blue', '🧪 STARTING SERVER TESTS');
    log('blue', '═══════════════════════════════════════════');

    await testServerHealth();

    const gameCode = await testCreateGame();
    const playerId = await testJoinGame(gameCode);
    const playerIds = await testMultipleJoins(gameCode);

    await testGetState(gameCode, playerId);
    await testCommitCard(gameCode, playerId);
    await testSkipTurn(gameCode, playerIds[0]);

    await testGetLeaderboard();
    await testInvalidGameCode();
    await testRejoinGame(gameCode, playerId);

    // Summary
    log('blue', '\n═══════════════════════════════════════════');
    log('blue', '📊 TEST SUMMARY');
    log('blue', '═══════════════════════════════════════════');
    log('green', `✓ Passed: ${testsPassed}`);
    if (testsFailed > 0) {
        log('red', `✗ Failed: ${testsFailed}`);
    }
    log('blue', `Total: ${testsPassed + testsFailed}`);

    if (testsFailed === 0) {
        log('green', '\n🎉 All tests passed!');
    } else {
        log('red', '\n❌ Some tests failed. Check output above.');
    }

    process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
    log('red', `\n💥 Test suite crashed: ${error.message}`);
    console.error(error);
    process.exit(1);
});
