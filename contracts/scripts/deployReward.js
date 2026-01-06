const hre = require("hardhat");

async function main() {
    console.log("Deploying RewardNFT to Monad Testnet...");

    const RewardNFT = await hre.ethers.getContractFactory("RewardNFT");
    const rewardNFT = await RewardNFT.deploy();

    await rewardNFT.waitForDeployment();

    const address = await rewardNFT.getAddress();
    console.log(`RewardNFT deployed to: ${address}`);

    // Verify ownership or initial setup if needed
    // const [deployer] = await hre.ethers.getSigners();
    // console.log("Owner:", deployer.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
