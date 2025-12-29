const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const SimpleCounter = await hre.ethers.getContractFactory("SimpleCounter");

    console.log("Deploying SimpleCounter...");
    const simpleCounter = await SimpleCounter.deploy();

    await simpleCounter.waitForDeployment();

    console.log(`SimpleCounter deployed to ${simpleCounter.target}`);
    fs.writeFileSync("address.txt", simpleCounter.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
