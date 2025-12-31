const hre = require("hardhat");

async function main() {
    console.log("Deploying DiceRoller...");

    // --- CONFIGURATION ---
    // Switchboard Address on Monad Testnet/Mainnet
    // IMPORTANT: You MUST update these with actual values from Switchboard documentation
    const SWITCHBOARD_ADDRESS = process.env.SWITCHBOARD_ADDRESS || "0x0000000000000000000000000000000000000000"; // Placeholder
    const QUEUE_ID = process.env.QUEUE_ID || "0x0000000000000000000000000000000000000000000000000000000000000000"; // Placeholder

    if (!process.env.SWITCHBOARD_ADDRESS) {
        console.warn("⚠️  WARNING: SWITCHBOARD_ADDRESS not set in .env. Using placeholder.");
    }

    const DiceRoller = await hre.ethers.getContractFactory("DiceRoller");
    const contract = await DiceRoller.deploy(SWITCHBOARD_ADDRESS, QUEUE_ID);

    await contract.waitForDeployment();

    const address = await contract.getAddress();

    console.log(`🎲 DiceRoller deployed to: ${address}`);
    console.log(`   Switchboard: ${SWITCHBOARD_ADDRESS}`);
    console.log(`   Queue ID: ${QUEUE_ID}`);

    // Verify?
    // await hre.run("verify:verify", { ... })
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
