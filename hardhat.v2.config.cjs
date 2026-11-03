require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

module.exports = {
  solidity: "0.8.24",
  paths: {
    sources: "./contracts-v2",
    tests: "./test-v2",
    cache: "./cache-v2",
    artifacts: "./artifacts-v2"
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || process.env.INFURA_URL,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY] : []
    }
  }
};
