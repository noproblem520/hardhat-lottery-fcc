const { ethers, network } = require("hardhat");
const FRONT_END_ADDRESSES_FILE =
  "../nextjs-smartcontract-lottery/constants/contractAddresses.json";
const FRONT_END_ABI_FILE = "../nextjs-smartcontract-lottery/constants/abi.json";
const fs = require("fs");
module.exports = async () => {
  if (process.env.UPDATE_FRONT_END) {
    console.log("updating front end...");
    await updateContractAddresses();
    await updateAbi();
  }
};

const updateAbi = async () => {
  const raffle = await ethers.getContract("Raffle");
  console.log("updateAbi");
  fs.writeFileSync(
    FRONT_END_ABI_FILE,
    raffle.interface.format(ethers.utils.FormatTypes.json)
  );
};

const updateContractAddresses = async () => {
  const raffle = await ethers.getContract("Raffle");
  const currentAddresses = JSON.parse(
    fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf-8")
  );
  const chainId = network.config.chainId.toString();
  console.log(chainId);
  if (chainId in currentAddresses) {
    if (!currentAddresses[chainId].includes(raffle.address)) {
      currentAddresses[chainId].push(raffle.address);
    }
  } else {
    currentAddresses[chainId] = [raffle.address];
  }
  fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses));
};

module.exports.tags = ["All", "frontend"];
