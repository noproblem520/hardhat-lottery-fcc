require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("dotenv").config();

const RINKEBY_RPC_URL = process.env.RINKEBY_RPC_URL || "https://google.com";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x00";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.7",
  networks: {
    rinkeby: {
      url: RINKEBY_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 4,
      blockConfirmation: 6,
    },
    localhost: {
      url: "http://127.0.0.1:8545/",
      chainId: 31337,
      blockConfirmation: 1,
    },
  },
  etherscan: {
    apikey: {
      rinkeby: ETHERSCAN_API_KEY,
    },
  },
  gasReporter: {
    enabled: false,
    outputFile: "gas-report.txt",
    noColors: true,
    currency: "USD",
    coinmarketcap: COINMARKETCAP_API_KEY,
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    player: {
      default: 1,
    },
  },
  mocha: {
    timeout: 200000, // 200 seconds
  },
};
