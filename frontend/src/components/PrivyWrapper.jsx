import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'wagmi';
import { monadChain } from '../utils/chains';
import { mainnet } from 'viem/chains';

const PRIVY_APP_ID = 'cmdmvsh7k0184jl0imavr5w91';

// Configure wagmi
const wagmiConfig = createConfig({
    chains: [monadChain, mainnet],
    transports: {
        [monadChain.id]: http(monadChain.rpcUrls.default.http[0]),
        [mainnet.id]: http(),
    },
});

const queryClient = new QueryClient();

export default function PrivyWrapper({ children }) {
    return (
        <PrivyProvider
            appId={PRIVY_APP_ID}
            config={{
                supportedChains: [monadChain, mainnet],
                defaultChain: monadChain,
                loginMethods: ['twitter'],
                embeddedWallets: {
                    createOnLogin: 'users-without-wallets',
                },
                appearance: {
                    theme: 'dark',
                    accentColor: '#6366f1',
                    showWalletLoginFirst: false,
                },
            }}
        >
            <QueryClientProvider client={queryClient}>
                <WagmiProvider config={wagmiConfig}>
                    {children}
                </WagmiProvider>
            </QueryClientProvider>
        </PrivyProvider>
    );
}
