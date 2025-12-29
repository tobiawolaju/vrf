import * as dotenv from 'dotenv';
dotenv.config();
console.log('RPC:', process.env.MONAD_MAINNET_RPC_URL);
console.log('PK exists:', !!process.env.PRIVATE_KEY);
