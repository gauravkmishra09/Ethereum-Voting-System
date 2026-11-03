const hre = require("hardhat");

async function main() {
  const [admin] = await hre.ethers.getSigners();
  console.log("Deploying JanVoteV2 from:", admin.address);

  const JanVoteV2 = await hre.ethers.getContractFactory("JanVoteV2");
  const contract = await JanVoteV2.deploy();
  await contract.deployed();

  console.log("JanVoteV2 deployed to:", contract.address);
  console.log("Admin:", admin.address);
  console.log("Network:", hre.network.name);
  console.log("Next: create an election and add candidates using the admin wallet.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
