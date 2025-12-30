import Dropdown from '../components/Dropdown';
import SetupCard from '../components/SetupCard';
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




// Placeholder - User needs to update after deployment
const CONTRACT_ADDRESS = "0x4d2B7a429734348e0010d5cFB5B71D5cA99b86Ca";
//test
const Home = ({ startDelay, setStartDelay, createGame, setView, login, logout, authenticated, user }) => {
    const { wallets } = useWallets();

    const handleIncrement = async () => {
        try {
            const wallet = wallets.find((w) => w.walletClientType === 'privy');
            if (!wallet) {
                alert("No Privy wallet found. Please ensure you are logged in with an embedded wallet.");
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
        <SetupCard title="🎲 Last Die Standing">
            {!authenticated ? (
                <div className="home-buttons">
                    <p className="login-prompt">Please log in to play</p>
                    <button className="btn-primary" onClick={login}>Log In / Sign Up</button>
                </div>
            ) : (
                <>
                    <div className="user-profile">
                        <div className="user-avatar">{avatar.length > 2 ? <img src={avatar} alt="pfp" /> : avatar}</div>
                        <div className="user-info">
                            <span className="user-name">@{playerName}</span>
                            <div className="user-wallets">
                                {ethWallet && (
                                    <div className="wallet-tag eth" title="Monad Wallet">
                                        <span className="wallet-icon">M</span>
                                        <span className="wallet-address">{ethWallet.slice(0, 6)}...{ethWallet.slice(-4)}</span>
                                        <button
                                            className="btn-copy"
                                            onClick={() => {
                                                navigator.clipboard.writeText(ethWallet);
                                                // Optional: minimal feedback could be added here or just rely on user knowing
                                            }}
                                            title="Copy Address"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: 'inherit' }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button className="btn-logout" onClick={logout} title="Logout">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                            </svg>
                        </button>
                    </div>

                    <div className="home-settings">
                        <label>
                            Match Start Delay
                            <Dropdown
                                options={delayOptions}
                                value={startDelay}
                                onChange={(val) => setStartDelay(val)}
                            />
                        </label>
                    </div>
                    <div className="home-buttons">
                        <button className="btn-primary" onClick={createGame}>Create New Match</button>
                        <button className="btn-secondary" onClick={() => setView('join')}>Join Existing Match</button>
                        <div className="divider" style={{
                            height: '1px',
                            background: 'rgba(255,255,255,0.1)',
                            margin: '10px 0'
                        }} />
                        <button
                            className="btn-accent"
                            style={{
                                background: 'var(--accent-color)',
                                color: 'black',
                                boxShadow: '0 4px 0 #b08d00'
                            }}
                            onClick={handleIncrement}
                        >
                            Test Contract Increment
                        </button>
                    </div>
                </>
            )}
        </SetupCard>
    );
};

export default Home;
