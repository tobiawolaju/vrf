require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MONAD_MAINNET_RPC = process.env.MONAD_MAINNET_RPC_URL;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.24",
    networks: {
        monadMainnet: {
            url: MONAD_MAINNET_RPC || "",
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
        },
    },
};
