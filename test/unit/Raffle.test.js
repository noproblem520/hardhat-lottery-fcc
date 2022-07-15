const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");
const { getNamedAccounts, network, deployments, ethers } = require("hardhat");
const { assert, expect } = require("chai");
!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Tests", () => {
      let raffle, vrfMock, raffleEntranceFee, deployer, interval;
      let chainId = network.config.chainId;
      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture("all");
        raffle = await ethers.getContract("Raffle", deployer);
        vrfMock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
        raffleEntranceFee = await raffle.getEntranceFee();
        interval = await raffle.getTimeInterval();
      });

      describe("constructor", () => {
        it("initializes the raffle correctly", async () => {
          // Ideally, we make our tests have just 1 assert per 'it'
          const raffleState = await raffle.getRaffleState();
          assert.equal(raffleState.toString(), "0");
          assert.equal(
            interval.toString(),
            networkConfig[chainId]["updateInterval"]
          );
        });
      });

      describe("enterRaffle", () => {
        it("reverts when you don't pay enough ethers", async () => {
          await expect(raffle.enterRaffle()).to.be.revertedWith(
            "Raffle__NotEnoughETHEntered"
          );
        });

        it("records players when they enter", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const player = await raffle.getPlayer(0);
          assert.equal(player, deployer);
        });

        it("emits event on enterRaffle", async () => {
          await expect(raffle.enterRaffle({ value: raffleEntranceFee }))
            .to.emit(raffle, "RaffleEnter")
            .withArgs(deployer);
        });

        // Need to review again!!
        it("doesn't allow entrance when raffle is calculating", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          //   We prtend to be a Chainlink Keeper
          await raffle.performUpkeep([]);
          await expect(
            raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.be.revertedWith("Raffle__NotOpen");
        });
      });

      describe("checkUpkeep", () => {
        // Need to review again!!
        it("returns false if people haven't sent any ETH", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });

        it("returns false if raffle isn't open", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          await raffle.performUpkeep([]);
          const raffleState = await raffle.getRaffleState();
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert.equal(raffleState.toString(), "1");
          assert.equal(upkeepNeeded, false);
        });

        it("returns false if enough time hasn't passed", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() - 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });

        it("returns false if enough time has passed, has players, eth, and is open", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert(upkeepNeeded);
        });
      });

      describe("performUpkeep", () => {
        it("it can only run if checkupkeep is true", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const tx = await raffle.performUpkeep([]);
          assert(tx);
        });

        it("reverts when checkupkeep is false", async () => {
          await expect(raffle.performUpkeep([])).to.be.revertedWith(
            "Raffle__UpkeepNotNeeded"
          );
        });

        it("updates the raffle state, emit an event, and calls the vrf coordinator", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const txRes = await raffle.performUpkeep([]);
          const txReceipt = await txRes.wait(1);
          const requestId = txReceipt.events[1].args.requestId;
          const raffleState = await raffle.getRaffleState();
          assert(requestId.toNumber() > 0);
          assert.equal(raffleState.toString(), "1");
        });
      });

      describe("fulfillRandomWords", () => {
        beforeEach(async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
        });
        // Need to review again
        it("can only be called after performUpkeep", async () => {
          await expect(
            vrfMock.fulfillRandomWords(0, raffle.address)
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfMock.fulfillRandomWords(1, raffle.address)
          ).to.be.revertedWith("nonexistent request");
        });
        // wayyyyyyyy to big
        it("picks a winner, resets the lottery, and sends money", async () => {
          const additionalEntrants = 3;
          const startingAccountIndex = 1; // deployer = 0
          const accounts = await ethers.getSigners();
          for (let i = startingAccountIndex; i <= additionalEntrants; i++) {
            const accountConnectedRaffle = await raffle.connect(accounts[i]);
            await accountConnectedRaffle.enterRaffle({
              value: raffleEntranceFee,
            });
          }

          const startingTimeStamp = await raffle.getLatestTimeStamp();
          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              console.log("Found the event!");
              try {
                const recentWinner = await raffle.getRecentWinner();
                console.log(`recentWinner is ${recentWinner}`);

                console.log(accounts[0].address);
                console.log(accounts[1].address);
                console.log(accounts[2].address);
                console.log(accounts[3].address);
                const winnerEndingBalance = await accounts[1].getBalance();
                const raffleState = await raffle.getRaffleState();
                const endingTimeStamp = await raffle.getLatestTimeStamp();
                const numPlayers = await raffle.getNumberOfPlayers();
                assert.equal(numPlayers.toString(), "0");
                assert.equal(raffleState.toString(), "0");
                assert(endingTimeStamp > startingTimeStamp);
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance
                    .add(
                      raffleEntranceFee
                        .mul(additionalEntrants)
                        .add(raffleEntranceFee)
                    )
                    .toString()
                );
                resolve();
              } catch (e) {
                reject(e);
              }
            });

            // Setting up the listener
            // below, we will fire the event, and the listener will pick it up, and resolve

            const txRes = await raffle.performUpkeep([]);
            const txReceipt = await txRes.wait(1);

            const winnerStartingBalance = await accounts[1].getBalance();

            await vrfMock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              raffle.address
            );
          });
        });
      });
    });
