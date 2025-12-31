const hre = require("hardhat");

async function main() {
    console.log("Deploying DiceRoller to Monad...");

    // Monad Mainnet Switchboard Address
    // From docs: 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67
    const SWITCHBOARD_ADDRESS = process.env.SWITCHBOARD_ADDRESS || "0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67";

    // Decide queue based on network or env
    const isTestnet = network.name.includes("testnet") || network.config.chainId === 10143;

    // Queue IDs from SDK or Docs
    // Mainnet: 0x86807068432f186a147cf0b13a30067d386204ea9d6c8b04743ac2ef010b0752
    // Testnet: 0x... (Check docs, often different or implicit)
    // The user docs snippet showed:
    // bytes32 constant MAINNET_QUEUE = 0x86807068432f186a147cf0b13a30067d386204ea9d6c8b04743ac2ef010b0752;
    // bytes32 constant TESTNET_QUEUE = 0xc9477bfb5ff1012859f336cf98725680e7705ba2abece17188cfb28ca66ca5b0;

    const MAINNET_QUEUE = "0x86807068432f186a147cf0b13a30067d386204ea9d6c8b04743ac2ef010b0752";
    const TESTNET_QUEUE = "0xc9477bfb5ff1012859f336cf98725680e7705ba2abece17188cfb28ca66ca5b0";

    const queueId = isTestnet ? TESTNET_QUEUE : MAINNET_QUEUE;

    console.log(`Using Network: ${network.name} (${network.config.chainId})`);
    console.log(`Switchboard: ${SWITCHBOARD_ADDRESS}`);
    console.log(`Queue ID: ${queueId}`);

    const DiceRoller = await hre.ethers.getContractFactory("DiceRoller");
    const diceRoller = await DiceRoller.deploy(SWITCHBOARD_ADDRESS, queueId);

    await diceRoller.waitForDeployment();

    const address = await diceRoller.getAddress();
    console.log(`🎲 DiceRoller deployed to: ${address}`);

    // Save address for frontend/backend usage
    const fs = require('fs');
    fs.writeFileSync('deployed_address.txt', address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
