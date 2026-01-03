const hre = require("hardhat");
const fs = require("fs");

async function main() {
    // Official Monad Mainnet Switchboard Address
    // Source: https://switchboard.xyz/explorer/143
    // Address: 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67
    const switchboardAddress = "0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67";
    const queueId = "0x86807068432f186a147cf0b13a30067d386204ea9d6c8b04743ac2ef010b0752";

    console.log(`Deploying DiceRoller with Switchboard: ${switchboardAddress} | Queue: ${queueId}`);

    const DiceRoller = await hre.ethers.getContractFactory("DiceRoller");
    const diceRoller = await DiceRoller.deploy(switchboardAddress, queueId);

    await diceRoller.waitForDeployment();

    console.log(`DiceRoller deployed to ${diceRoller.target}`);
    fs.writeFileSync("address.txt", diceRoller.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
