import Dropdown from '../components/Dropdown';
import SetupCard from '../components/SetupCard';
import { useWallets } from '@privy-io/react-auth';
import { encodeFunctionData } from 'viem';
import './Home.css';
import { monadChain } from '../utils/chains';

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
const CONTRACT_ADDRESS = "0xaa3F5Cf26403F0EF88ef7fF34Bb015ab76783E86";

// Define Monad Chain (Imported from utils/chains)

const Home = ({ startDelay, setStartDelay, createGame, setView, login, logout, authenticated, user }) => {
    const { wallets } = useWallets();

    const handleIncrement = async () => {
        try {
            // Find the correct wallet to use
            const wallet = wallets.find((w) => w.walletClientType === 'privy') || wallets.find(w => w.chainType === 'ethereum');
            if (!wallet) {
                alert("No compatible wallet found. Please login.");
                return;
            }

            // Attempt to Switch to Monad Chain, adding it if necessary
            try {
                await wallet.switchChain(monadChain.id);
            } catch (switchError) {
                console.warn("Retrying chain switch via provider (forcing add)...", switchError);
                try {
                    const provider = await wallet.getEthereumProvider();
                    await provider.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: `0x${monadChain.id.toString(16)}`,
                            chainName: monadChain.name,
                            nativeCurrency: monadChain.nativeCurrency,
                            rpcUrls: [monadChain.rpcUrls.default.http[0]],
                        }],
                    });
                    // Try switching again after adding
                    await wallet.switchChain(monadChain.id);
                } catch (addError) {
                    console.error("Failed to add/switch chain:", addError);
                    alert("Could not switch to Monad network. Please switch manually in your wallet.");
                    return; // Stop execution if we can't switch
                }
            }

            const provider = await wallet.getEthereumProvider();

            // Encode the function call data for 'increment()'
            const data = encodeFunctionData({
                abi: CONTRACT_ABI,
                functionName: 'increment',
            });

            console.log("Requesting increment transaction via eth_sendTransaction...");
            const hash = await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: wallet.address,
                    to: CONTRACT_ADDRESS,
                    data: data,
                }]
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
                                    <div className="wallet-tag eth">
                                        <span className="wallet-icon">Ξ</span>
                                        <span className="wallet-address">{ethWallet.slice(0, 6)}...{ethWallet.slice(-4)}</span>
                                    </div>
                                )}
                                {solWallet && (
                                    <div className="wallet-tag sol">
                                        <span className="wallet-icon">◎</span>
                                        <span className="wallet-address">{solWallet.slice(0, 4)}...{solWallet.slice(-4)}</span>
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
