const hre = require("hardhat");

async function main() {
    const provider = new hre.ethers.JsonRpcProvider(hre.config.networks.monadMainnet.url);
    const network = await provider.getNetwork();
    console.log("Chain ID:", network.chainId.toString());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
