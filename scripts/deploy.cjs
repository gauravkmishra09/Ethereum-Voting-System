const hre = require("hardhat");

async function main() {
  const Election = await hre.ethers.getContractFactory("IndianElection");
  console.log("Deploying contract...");
  const election = await Election.deploy();
  await election.deployed();
  console.log("Contract deployed to:", election.address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
