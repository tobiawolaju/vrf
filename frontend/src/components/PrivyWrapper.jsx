import { PrivyProvider } from '@privy-io/react-auth';
import { monadChain } from '../utils/chains';
import { mainnet } from 'viem/chains';

// In a production environment, this should be in process.env.VITE_PRIVY_APP_ID
// But for immediate ease of use given file access restrictions, we use the ID provided.
const PRIVY_APP_ID = 'cmdmvsh7k0184jl0imavr5w91';

export default function PrivyWrapper({ children }) {
    return (
        <PrivyProvider
            appId={PRIVY_APP_ID}
            config={{
                supportedChains: [monadChain, mainnet],
                loginMethods: ['twitter'],
                embeddedWallets: {
                    createOnLogin: 'users-without-wallets',
                    noPromptOnSignature: true, // Avoids the "connecting" popup
                },
                appearance: {
                    theme: 'dark',
                    accentColor: '#6366f1',
                    showWalletLoginFirst: false,
                },
            }}
        >
            {children}
        </PrivyProvider>
    );
}
