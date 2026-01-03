const hre = require("hardhat");

async function main() {
    console.log("Deploying DiceRoller with Pyth Entropy...");

    // Pyth Entropy contract on Monad Mainnet
    const ENTROPY_ADDRESS = "0x98046Bd286715D3B0BC227Dd7a956b83D8978603";

    // Default Pyth entropy provider
    const ENTROPY_PROVIDER = "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344"; // Pyth's default provider

    console.log(`Entropy: ${ENTROPY_ADDRESS} | Provider: ${ENTROPY_PROVIDER}`);

    const DiceRoller = await hre.ethers.getContractFactory("DiceRoller");
    const diceRoller = await DiceRoller.deploy(ENTROPY_ADDRESS, ENTROPY_PROVIDER);

    await diceRoller.waitForDeployment();

    const address = await diceRoller.getAddress();
    console.log(`DiceRoller deployed to ${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
