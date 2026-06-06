const { ethers } = require("hardhat");

async function main() {
  const accounts = await ethers.getSigners();
  console.log("Available accounts:");
  accounts.forEach((acc, i) => {
    console.log(`Account ${i+1}: ${acc.address}`);
  });

  const Election = await ethers.getContractFactory("IndianElection");
  const election = await Election.deploy();
  await election.deployed();
  console.log("\nContract deployed to:", election.address);

  await election.connect(accounts[0]).vote(1);
  console.log("Account 1 voted for BJP");
  
  await election.connect(accounts[1]).vote(2);
  console.log("Account 2 voted for INC");
  
  await election.connect(accounts[2]).vote(1);
  console.log("Account 3 voted for BJP");

  console.log("\nVoting complete! BJP: 2, INC: 1");
}

main().catch(console.error);
