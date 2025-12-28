import { PrivyProvider } from '@privy-io/react-auth';

// In a production environment, this should be in process.env.VITE_PRIVY_APP_ID
// But for immediate ease of use given file access restrictions, we use the ID provided.
const PRIVY_APP_ID = 'cmdmvsh7k0184jl0imavr5w91';

export default function PrivyWrapper({ children }) {
    return (
        <PrivyProvider
            appId={PRIVY_APP_ID}
            config={{
                loginMethods: ['twitter'],
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
