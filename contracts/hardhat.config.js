import "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";
dotenv.config();

const { PRIVATE_KEY, MONAD_MAINNET_RPC_URL } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
export default {
    solidity: "0.8.19",
    networks: {
        monadMainnet: {
            url: MONAD_MAINNET_RPC_URL || "https://rpc-mainnet.monadinfra.com",
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
        },
    },
};
