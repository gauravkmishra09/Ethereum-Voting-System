require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

module.exports = {
  solidity: "0.5.16",
  networks: {
    sepolia: {
      url: process.env.INFURA_URL,
      accounts: [`0x${process.env.PRIVATE_KEY}`]
    }
  }
};
