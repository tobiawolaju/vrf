import React, { useState } from 'react';
import Dropdown from '../components/Dropdown';
import { useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom } from 'viem';
import { monadMainnet } from '../utils/chains';
import './Home.css';

// Minimal ABI for SimpleCounter
const CONTRACT_ABI = [
    {
        "inputs": [],
        "name": "increment",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "count",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];


// Placeholder vvv - User needs to update after deployment
const CONTRACT_ADDRESS = "0x4d2B7a429734348e0010d5cFB5B71D5cA99b86Ca";
//test
const Home = ({ startDelay, setStartDelay, createGame, setView, login, onLogout, authenticated, user }) => {
    const [showSettings, setShowSettings] = useState(false);
    const { wallets } = useWallets();

    const handleIncrement = async () => {
        try {
            // Fallback: Use Privy wallet if found, otherwise use ANY connected wallet (e.g. MetaMask)
            const wallet = wallets.find((w) => w.walletClientType === 'privy') || wallets[0];

            if (!wallet) {
                alert("No connected wallet found. Please login or connect a wallet.");
                return;
            }

            // Switch to Monad Mainnet if necessary
            await wallet.switchChain(monadMainnet.id);

            const provider = await wallet.getEthereumProvider();
            const walletClient = createWalletClient({
                account: wallet.address,
                chain: monadMainnet,
                transport: custom(provider)
            });

            console.log("Requesting increment transaction...");
            const hash = await walletClient.writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'increment',
            });

            console.log("Transaction hash:", hash);
            alert(`Transaction sent! Hash: ${hash}`);
        } catch (error) {
            console.error("Contract interaction failed:", error);
            alert(`Error: ${error.message}`);
        }
    };
    const delayOptions = [
        { value: 1, label: '1 Minute' },
        { value: 30, label: '30 Minutes' },
        { value: 60, label: '1 Hour' }
    ];

    // Extraction logic similar to App.jsx/WaitingRoom
    const playerName = user?.twitter?.username || user?.wallet?.address?.slice(0, 8) || user?.email?.address?.split('@')[0] || 'Player';
    const avatar = user?.twitter?.profilePictureUrl ||
        user?.google?.profilePictureUrl ||
        user?.github?.profilePictureUrl ||
        user?.linkedAccounts?.find(acc => acc.profilePictureUrl)?.profilePictureUrl ||
        '😊';

    // Find wallets
    const ethWallet = user?.linkedAccounts?.find(acc => acc.type === 'wallet' && acc.chainType === 'ethereum')?.address;
    const solWallet = user?.linkedAccounts?.find(acc => acc.type === 'wallet' && acc.chainType === 'solana')?.address;

    return (
        <div className="home-container">
            {/* Player Ticket (Top Right) */}
            {authenticated && (
                <div className="player-ticket">
                    <div className="ticket-avatar">
                        {avatar.length > 2 ? <img src={avatar} alt="pfp" /> : avatar}
                    </div>
                    <div className="ticket-info">
                        <span className="ticket-name">@{playerName}</span>
                        {ethWallet && <span className="ticket-wallet">{ethWallet.slice(0, 4)}...{ethWallet.slice(-4)}</span>}
                    </div>
                    <button className="logout-mini" onClick={onLogout} title="Logout">✕</button>
                </div>
            )}

            {/* Main Title */}
            <h1 className="home-title">MonkeyHand</h1>

            {!authenticated ? (
                <div className="login-container">
                    <button className="btn-login-huge" onClick={login}>
                        CONNECT TO PLAY
                    </button>
                </div>
            ) : (
                <>
                    <div className="home-menu">
                        {/* CREATE MATCH CARD */}
                        <div className="menu-card primary" onClick={createGame}>
                            <div className="icon">🎲</div>
                            <h2>CREATE<br />MATCH</h2>

                            {/* Timer Trigger Chip */}
                            <div className="timer-chip" onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}>
                                ⏱️ {delayOptions.find(o => o.value === startDelay)?.label || 'Delay'}
                            </div>
                        </div>

                        {/* JOIN MATCH CARD */}
                        <div className="menu-card join" onClick={() => setView('join')}>
                            <div className="icon">🎫</div>
                            <h2>JOIN<br />MATCH</h2>
                            <div className="label">Enter code</div>
                        </div>
                    </div>

                    <div className="home-bottom-bar">
                        <button className="icon-btn" onClick={() => setView('leaderboard')}>
                            🏆 LEADERBOARD
                        </button>
                        <button className="icon-btn" onClick={() => setView('deck')}>
                            🎴 DECK
                        </button>
                        <button className="icon-btn" onClick={handleIncrement}>
                            ⚡ TEST CONTRACT
                        </button>
                    </div>

                    {/* SETTINGS MODAL */}
                    {showSettings && (
                        <div className="settings-modal" onClick={() => setShowSettings(false)}>
                            <div className="settings-content" onClick={e => e.stopPropagation()}>
                                <h2>Match Delay</h2>
                                <div className="settings-options">
                                    {delayOptions.map(opt => (
                                        <button
                                            key={opt.value}
                                            className={`btn-option ${startDelay === opt.value ? 'selected' : ''}`}
                                            onClick={() => { setStartDelay(opt.value); setShowSettings(false); }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <button className="btn-close-modal" onClick={() => setShowSettings(false)}>
                                    CLOSE
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Home;