const hre = require("hardhat");

async function main() {
    console.log("Deploying DiceRoller...");

    // --- CONFIGURATION ---
    // Switchboard Address on Monad Testnet (Example/Placeholder)
    // You MUST replace these with the actual official Monad addresses when available.
    // Current Monad Testnet Switchboard Router: Check docs.
    const SWITCHBOARD_ADDRESS = process.env.SWITCHBOARD_ADDRESS || "0xBE0eB53F46cd790Cd13851d5EFF43D12404d33E8"; // Example
    const QUEUE_ID = process.env.QUEUE_ID || "0x0000000000000000000000000000000000000000000000000000000000000000"; // Needs actual Queue ID

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
