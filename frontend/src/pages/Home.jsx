import React, { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom } from 'viem';
import { monadMainnet } from '../utils/chains';
import './Home.css';

const CONTRACT_ABI = [
    {
        inputs: [],
        name: 'increment',
        outputs: [],
        edh      stateMutability: 'nonpayable',
        type: 'function',
    },
];

const CONTRACT_ADDRESS = '0x4d2B7a429734348e0010d5cFB5B71D5cA99b86Ca';

const Home = ({
    startDelay,
    setStartDelay,
    createGame,
    setView,
    login,
    fullLogout,
    authenticated,
    user,
}) => {
    const [showSettings, setShowSettings] = useState(false);
    const { wallets } = useWallets();

    const handleIncrement = async () => {
        const wallet = wallets.find(w => w.walletClientType === 'privy') || wallets[0];
        if (!wallet) return alert('no wallet');

        await wallet.switchChain(monadMainnet.id);
        const provider = await wallet.getEthereumProvider();

        const wc = createWalletClient({
            account: wallet.address,
            chain: monadMainnet,
            transport: custom(provider),
        });

        await wc.writeContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'increment',
        });
    };

    const playerName =
        user?.twitter?.username ||
        user?.wallet?.address?.slice(0, 8) ||
        user?.email?.address?.split('@')[0] ||
        'player';

    const avatar =
        user?.twitter?.profilePictureUrl ||
        user?.google?.profilePictureUrl ||
        user?.github?.profilePictureUrl ||
        '🙂';

    return (
        <div className="home-container">
            {authenticated && (
                <div className="player-ticket">
                    <div className="ticket-avatar">
                        {avatar.startsWith('http') ? <img src={avatar} /> : avatar}
                    </div>
                    <div className="ticket-info">
                        <span>@{playerName}</span>
                    </div>
                    <button className="logout-mini" onClick={fullLogout}>✕</button>
                </div>
            )}

            <h1 className="home-title">MonkeyHand</h1>

            {!authenticated ? (
                <button className="btn-login-huge" onClick={login}>
                    CONNECT TO PLAY
                </button>
            ) : (
                <>
                    <div className="home-menu">
                        <div className="menu-card primary" onClick={createGame}>
                            🎲 CREATE MATCH
                        </div>
                        <div className="menu-card join" onClick={() => setView('join')}>
                            🎫 JOIN MATCH
                        </div>
                    </div>

                    <div className="home-bottom-bar">
                        <button onClick={() => setView('leaderboard')}>🏆</button>
                        <button onClick={() => setView('deck')}>🎴</button>
                        <button onClick={handleIncrement}>⚡</button>
                    </div>
                </>
            )}
        </div>
    );
};

export default Home;
