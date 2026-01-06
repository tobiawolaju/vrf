const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Deploying RewardNFT to Monad Testnet (Attempt 2)...");

    const RewardNFT = await hre.ethers.getContractFactory("RewardNFT");
    const rewardNFT = await RewardNFT.deploy();

    await rewardNFT.waitForDeployment();

    const address = await rewardNFT.getAddress();
    console.log(`RewardNFT deployed to: ${address}`);

    const outputPath = path.resolve(__dirname, "../deployed_reward.txt");
    fs.writeFileSync(outputPath, address);
    console.log(`Address saved to: ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
