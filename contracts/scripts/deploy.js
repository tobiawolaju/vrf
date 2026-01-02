const hre = require("hardhat");
const fs = require("fs");

async function main() {
    // Local Oracle Mode
    // Since we cannot access the Switchboard Cloud UI, we set the deployer as the Oracle.
    // We will run a local script (scripts/oracle.js) to act as the Oracle.
    const [deployer] = await hre.ethers.getSigners();
    const switchboardAddress = deployer.address;

    console.log(`Deploying DiceRoller with Local Oracle: ${switchboardAddress}`);

    const DiceRoller = await hre.ethers.getContractFactory("DiceRoller");
    const diceRoller = await DiceRoller.deploy(switchboardAddress);

    await diceRoller.waitForDeployment();


    console.log(`DiceRoller deployed to ${diceRoller.target}`);
    fs.writeFileSync("address.txt", diceRoller.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
