const { ethers, network } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat-config");
const { verify } = require("../utils/verify.js");
const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30");
module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  let VRFCoordinatorV2MockAddress, subscriptionId;
  if (developmentChains.includes(network.name)) {
    const vrfMock = await ethers.getContract("VRFCoordinatorV2Mock");
    VRFCoordinatorV2MockAddress = vrfMock.address;
    const txRes = await vrfMock.createSubscription();
    const txReceipt = await txRes.wait(1);
    subscriptionId = txReceipt.events[0].args.subId;
    // Fund the subscription
    // Usually, you'd need the link token on a real network
    await vrfMock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
  } else {
    VRFCoordinatorV2MockAddress = networkConfig[chainId]["vrfCoordinatorV2"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }
  const entranceFee = networkConfig[chainId]["entranceFee"];
  const gasLane = networkConfig[chainId]["gasLane"];
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
  const updateInterval = networkConfig[chainId]["updateInterval"];
  const args = [
    VRFCoordinatorV2MockAddress,
    entranceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    updateInterval,
  ];
  const raffle = await deploy("Raffle", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmation || 1,
  });

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("verifying...");
    await verify(raffle.address, args);
  }
  log("---------------------------------");
};

module.exports.tags = ["all", "raffle"];
