const hre = require("hardhat");

async function main() {
    console.log("Deploying DiceRoller with Switchboard On-Demand...");

    const DiceRoller = await hre.ethers.getContractFactory("DiceRoller");
    const diceRoller = await DiceRoller.deploy();

    await diceRoller.waitForDeployment();

    const address = await diceRoller.getAddress();
    console.log(`DiceRoller (Switchboard) deployed to ${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
