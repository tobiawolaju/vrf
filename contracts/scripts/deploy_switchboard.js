const hre = require("hardhat");

async function main() {
    console.log("Deploying DiceRoller...");

    const DiceRoller = await hre.ethers.getContractFactory("DiceRoller");
    const contract = await DiceRoller.deploy();

    await contract.waitForDeployment();

    const address = await contract.getAddress();

    console.log(`🎲 DiceRoller deployed to: ${address}`);
    console.log(`   Owner: ${await contract.owner()}`);

    // Verify?
    // await hre.run("verify:verify", { ... })
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
