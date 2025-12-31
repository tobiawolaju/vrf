const hre = require("hardhat");

async function main() {
    console.log("Deploying DiceRoller...");

    // --- CONFIGURATION ---
    // Official Switchboard Oracle on Monad Mainnet
    const SWITCHBOARD_ADDRESS = process.env.SWITCHBOARD_ADDRESS || "0x33A5066f65f66161bEb3f827A3e40fce7d7A2e6C";
    const QUEUE_ID = process.env.QUEUE_ID || "0x0000000000000000000000000000000000000000000000000000000000000000"; // May not be needed for Monad

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
