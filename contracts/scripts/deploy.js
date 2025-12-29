import hre from "hardhat";

async function main() {
    console.log("Deploying SimpleCounter...");

    const SimpleCounter = await hre.ethers.getContractFactory("SimpleCounter");
    const counter = await SimpleCounter.deploy();

    await counter.waitForDeployment();

    console.log("SimpleCounter deployed to:", await counter.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
