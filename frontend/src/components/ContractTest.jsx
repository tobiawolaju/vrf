import { useAccount, useWriteContract, useReadContract, useSwitchChain, useChainId } from 'wagmi';
import { monadMainnet } from '../utils/chains';
import './ContractTest.css';

// Contract details
const CONTRACT_ADDRESS = '0xaa3F5Cf26403F0EF88ef7fF34Bb015ab76783E86';
const CONTRACT_ABI = [
    {
        inputs: [],
        name: 'increment',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'count',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getCount',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
];

export default function ContractTest() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain, isPending: isSwitching } = useSwitchChain();

    const { data: count, refetch: refetchCount, isLoading: isLoadingCount } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getCount',
        chainId: monadMainnet.id,
    });

    const { writeContract, isPending, isSuccess, isError, error, data: hash } = useWriteContract();

    const isOnMonad = chainId === monadMainnet.id;

    const handleIncrement = async () => {
        if (!isOnMonad) {
            switchChain({ chainId: monadMainnet.id });
            return;
        }

        writeContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'increment',
        });
    };

    if (!isConnected) {
        return (
            <div className="contract-test">
                <p>Connect wallet to test contract</p>
            </div>
        );
    }

    return (
        <div className="contract-test">
            <h3>📜 Contract Test</h3>
            <p className="contract-address">
                Contract: {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}
            </p>

            <div className="chain-status">
                {isOnMonad ? (
                    <span className="chain-badge connected">✓ Monad</span>
                ) : (
                    <button
                        className="btn-switch-chain"
                        onClick={() => switchChain({ chainId: monadMainnet.id })}
                        disabled={isSwitching}
                    >
                        {isSwitching ? 'Switching...' : 'Switch to Monad'}
                    </button>
                )}
            </div>

            <div className="count-display">
                <span className="count-label">Current Count:</span>
                <span className="count-value">
                    {isLoadingCount ? '...' : count?.toString() ?? 'N/A'}
                </span>
                <button className="btn-refresh" onClick={() => refetchCount()} title="Refresh">
                    🔄
                </button>
            </div>

            <button
                className="btn-increment"
                onClick={handleIncrement}
                disabled={isPending || isSwitching}
            >
                {isPending ? 'Confirming...' : isSwitching ? 'Switch Chain First' : 'Increment Counter'}
            </button>

            {isSuccess && hash && (
                <div className="tx-success">
                    ✅ TX: {hash.slice(0, 10)}...{hash.slice(-8)}
                </div>
            )}

            {isError && (
                <div className="tx-error">
                    ❌ {error?.message?.slice(0, 100) || 'Transaction failed'}
                </div>
            )}
        </div>
    );
}
