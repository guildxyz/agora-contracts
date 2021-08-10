const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  ether, // Converts a value in Ether to wei
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  time, // Manipulate block number/timestamp
} = require("@openzeppelin/test-helpers");
const expect = require("chai").expect;

const tokenContract = artifacts.require("AgoraMemberToken");
const bankContract = artifacts.require("AgoraBank");

async function calculateReward(bank, communityIds, user, block) {
  const rewardPerBlock = await bank.rewardPerBlock();
  const totalStakes = await bank.totalStakes();
  let userStakes = new BN();
  let elapsedBlocks = new BN();
  for (let i = 0; i < communityIds.length; i++) {
    const stake = await bank.stakes(communityIds[i], user);
    const stakeInCommunity = stake.amount;
    if (stakeInCommunity > 0) {
      userStakes = userStakes.add(stakeInCommunity);
      elapsedBlocks = elapsedBlocks.add(block.sub(stake.countRewardsFrom));
    }
  }
  return elapsedBlocks.mul(rewardPerBlock).mul(userStakes).div(totalStakes);
}

contract("AgoraBank", async function (accounts) {
  before("setup", async function () {
    this.firstCommunity = new BN(1);
    this.oneToken = ether("1");
    this.token = await tokenContract.new("AgoraMemberToken", "AGT", ether("300"));
    this.bank = await bankContract.new(this.token.address);
    this.defaultLockDuration = new BN(586868);
    this.defaultRewardAmount = ether("0.1");
    // Approve tokens for the first three accounts and fund them, make Bank the minter
    await Promise.all([
      this.token.grantRole(await this.token.MINTER_ROLE(), this.bank.address, { from: accounts[0] }),
      this.token.approve(this.bank.address, constants.MAX_UINT256, { from: accounts[0] }),
      this.token.approve(this.bank.address, constants.MAX_UINT256, { from: accounts[1] }),
      this.token.approve(this.bank.address, constants.MAX_UINT256, { from: accounts[2] }),
      this.token.transfer(accounts[1], ether("100"), { from: accounts[0] }),
      this.token.transfer(accounts[2], ether("100"), { from: accounts[0] }),
    ]);
  });

  context("state variables", async function () {
    it("should return the token's address", async function () {
      const result = await this.bank.agoAddress();
      expect(result).to.equal(this.token.address);
    });

    it("should have a default reward amount", async function () {
      const result = await this.bank.rewardPerBlock();
      expect(result).to.bignumber.equal(this.defaultRewardAmount);
    });

    it("should have a default timelock duration", async function () {
      const result = await this.bank.lockInterval();
      expect(result).to.bignumber.equal(this.defaultLockDuration);
    });

    it("should have no stakes yet", async function () {
      const result = await this.bank.totalStakes();
      expect(result).to.bignumber.equal(new BN(0));
    });

    it("should allow the owner to change the timelock duration", async function () {
      const desiredTimelock = new BN(10);
      const oldTimelock = await this.bank.lockInterval();
      await this.bank.changeTimelockInterval(desiredTimelock, { from: accounts[0] });
      const newTimelock = await this.bank.lockInterval();
      expect(oldTimelock).to.not.equal(desiredTimelock);
      expect(newTimelock).to.bignumber.equal(desiredTimelock);
    });

    it("should revert if not the owner is trying to change the timelock duration", async function () {
      await expectRevert(
        this.bank.changeTimelockInterval(new BN(586868), { from: accounts[2] }),
        "Ownable: caller is not the owner"
      );
    });

    it("should allow the owner to change the reward amount", async function () {
      const desiredReward = ether("1");
      const oldReward = await this.bank.rewardPerBlock();
      await this.bank.changeRewardPerBlock(desiredReward, { from: accounts[0] });
      const newReward = await this.bank.rewardPerBlock();
      expect(oldReward).to.not.equal(desiredReward);
      expect(newReward).to.bignumber.equal(desiredReward);
    });

    it("should revert if not the owner is trying to change the reward amount", async function () {
      await expectRevert(
        this.bank.changeRewardPerBlock(ether("0.1"), { from: accounts[2] }),
        "Ownable: caller is not the owner"
      );
    });

    it("should emit a RewardChanged event", async function () {
      const desiredReward = ether("0.1");
      const result = await this.bank.changeRewardPerBlock(desiredReward, { from: accounts[0] });
      expectEvent(result, "RewardChanged", { newRewardPerBlock: desiredReward });
    });
  });

  context("depositing", async function () {
    it("should claim rewards", async function () {
      await this.bank.deposit(this.firstCommunity, this.oneToken, { from: accounts[0] });
      await time.advanceBlockTo((await time.latestBlock()).add(new BN(5)));
      const nextBlock = (await time.latestBlock()).add(new BN(1));
      const calculatedRewardAmount = await calculateReward(this.bank, [this.firstCommunity], accounts[0], nextBlock);
      const oldBalance = await this.token.balanceOf(accounts[0]);
      await this.bank.deposit(this.firstCommunity, this.oneToken, { from: accounts[0] });
      const newBalance = await this.token.balanceOf(accounts[0]);
      expect(oldBalance.sub(newBalance)).to.bignumber.equal(this.oneToken.sub(calculatedRewardAmount));
    });

    it("should set the stake details properly (more attempts in one community)", async function () {
      for (let i = 0; i < 3; i++) {
        const oldStakes = await this.bank.stakes(this.firstCommunity, accounts[0]);
        const result = await this.bank.deposit(this.firstCommunity, this.oneToken, { from: accounts[0] });
        const blockNumber = new BN(result.receipt.blockNumber);
        const stakes = await this.bank.stakes(this.firstCommunity, accounts[0]);
        const lockInterval = await this.bank.lockInterval();
        expect(stakes.amount).to.bignumber.equal(oldStakes.amount.add(this.oneToken));
        expect(stakes.countRewardsFrom).to.bignumber.equal(blockNumber);
        expect(stakes.lockExpires).to.bignumber.equal(blockNumber.add(lockInterval));
      }
    });

    it("should set the stake details properly (attempts in more communities)", async function () {
      for (let i = 0; i < 3; i++) {
        const communityId = new BN(i);
        const amount = this.oneToken.mul(new BN(2));
        const oldStakes = await this.bank.stakes(communityId, accounts[0]);
        const result = await this.bank.deposit(communityId, amount, { from: accounts[0] });
        const blockNumber = new BN(result.receipt.blockNumber);
        const stakes = await this.bank.stakes(communityId, accounts[0]);
        const lockInterval = await this.bank.lockInterval();
        expect(stakes.amount).to.bignumber.equal(oldStakes.amount.add(amount));
        expect(stakes.countRewardsFrom).to.bignumber.equal(blockNumber);
        expect(stakes.lockExpires).to.bignumber.equal(blockNumber.add(lockInterval));
      }
    });

    it("should set the stake details properly (multiple users in one community)", async function () {
      for (let i = 0; i < 3; i++) {
        const oldStakes = await this.bank.stakes(this.firstCommunity, accounts[i]);
        const result = await this.bank.deposit(this.firstCommunity, this.oneToken, { from: accounts[i] });
        const blockNumber = new BN(result.receipt.blockNumber);
        const stakes = await this.bank.stakes(this.firstCommunity, accounts[i]);
        const lockInterval = await this.bank.lockInterval();
        expect(stakes.amount).to.bignumber.equal(oldStakes.amount.add(this.oneToken));
        expect(stakes.countRewardsFrom).to.bignumber.equal(blockNumber);
        expect(stakes.lockExpires).to.bignumber.equal(blockNumber.add(lockInterval));
      }
    });

    it("should update totalStakes", async function () {
      const oldAmount = await this.bank.totalStakes();
      await this.bank.deposit(this.firstCommunity, this.oneToken, { from: accounts[0] });
      const newAmount = await this.bank.totalStakes();
      expect(newAmount.sub(oldAmount)).to.bignumber.equal(this.oneToken);
    });

    it("should transfer tokens to the contract", async function () {
      const oldBalance = await this.token.balanceOf(this.bank.address);
      await this.bank.deposit(this.firstCommunity, this.oneToken, { from: accounts[0] });
      const newBalance = await this.token.balanceOf(this.bank.address);
      expect(newBalance.sub(oldBalance)).to.bignumber.equal(this.oneToken);
    });

    it("should emit a Deposit event", async function () {
      const result = await this.bank.deposit(this.firstCommunity, this.oneToken, { from: accounts[0] });
      expectEvent(result, "Deposit", { communityId: this.firstCommunity, wallet: accounts[0], amount: this.oneToken });
    });
  });

  context("withdrawing", async function () {
    it("should revert if the tokens are not unlocked yet", async function () {
      await expectRevert(
        this.bank.withdraw(this.firstCommunity, new BN(1), { from: accounts[0] }),
        "Stake still locked"
      );
    });

    it("should not revert after the tokens are unlocked", async function () {
      const lockInterval = await this.bank.lockInterval();
      await time.advanceBlockTo((await time.latestBlock()).add(lockInterval).add(new BN(1)));
      const result = await this.bank.withdraw(this.firstCommunity, this.oneToken, { from: accounts[0] });
      expect(result.receipt.status).to.be.true;
    });

    it("should claim rewards", async function () {
      await time.advanceBlockTo((await time.latestBlock()).add(new BN(5)));
      const nextBlock = (await time.latestBlock()).add(new BN(1));
      const calculatedRewardAmount = await calculateReward(this.bank, [this.firstCommunity], accounts[0], nextBlock);
      const oldBalance = await this.token.balanceOf(accounts[0]);
      await this.bank.withdraw(this.firstCommunity, this.oneToken, { from: accounts[0] });
      const newBalance = await this.token.balanceOf(accounts[0]);
      expect(newBalance.sub(oldBalance)).to.bignumber.equal(this.oneToken.add(calculatedRewardAmount));
    });

    it("should revert if trying to withdraw too much", async function () {
      const stakes = await this.bank.stakes(this.firstCommunity, accounts[0]);
      await expectRevert.unspecified(
        this.bank.withdraw(this.firstCommunity, stakes.amount.mul(new BN(2)), { from: accounts[0] })
      );
    });

    it("should modify the stake details properly (more attempts in one community)", async function () {
      for (let i = 0; i < 3; i++) {
        const oldStakes = await this.bank.stakes(this.firstCommunity, accounts[0]);
        const result = await this.bank.withdraw(this.firstCommunity, this.oneToken, { from: accounts[0] });
        const blockNumber = new BN(result.receipt.blockNumber);
        const stakes = await this.bank.stakes(this.firstCommunity, accounts[0]);
        expect(stakes.amount).to.bignumber.equal(oldStakes.amount.sub(this.oneToken));
        expect(stakes.countRewardsFrom).to.bignumber.equal(blockNumber);
        expect(stakes.lockExpires).to.bignumber.equal(oldStakes.lockExpires);
      }
    });

    it("should modify the stake details properly (attempts in more communities)", async function () {
      for (let i = 0; i < 3; i++) {
        const communityId = new BN(i);
        const oldStakes = await this.bank.stakes(communityId, accounts[0]);
        const result = await this.bank.withdraw(communityId, this.oneToken, { from: accounts[0] });
        const blockNumber = new BN(result.receipt.blockNumber);
        const stakes = await this.bank.stakes(communityId, accounts[0]);
        expect(stakes.amount).to.bignumber.equal(oldStakes.amount.sub(this.oneToken));
        expect(stakes.countRewardsFrom).to.bignumber.equal(blockNumber);
        expect(stakes.lockExpires).to.bignumber.equal(oldStakes.lockExpires);
      }
    });

    it("should modify the stake details properly (multiple users in one community)", async function () {
      for (let i = 0; i < 3; i++) {
        const oldStakes = await this.bank.stakes(this.firstCommunity, accounts[i]);
        const result = await this.bank.withdraw(this.firstCommunity, this.oneToken, { from: accounts[i] });
        const blockNumber = new BN(result.receipt.blockNumber);
        const stakes = await this.bank.stakes(this.firstCommunity, accounts[i]);
        expect(stakes.amount).to.bignumber.equal(oldStakes.amount.sub(this.oneToken));
        expect(stakes.countRewardsFrom).to.bignumber.equal(blockNumber);
        expect(stakes.lockExpires).to.bignumber.equal(oldStakes.lockExpires);
      }
    });

    it("should update totalStakes", async function () {
      const oldAmount = await this.bank.totalStakes();
      await this.bank.withdraw(this.firstCommunity, this.oneToken, { from: accounts[0] });
      const newAmount = await this.bank.totalStakes();
      expect(oldAmount.sub(newAmount)).to.bignumber.equal(this.oneToken);
    });

    it("should transfer tokens to the withdrawer", async function () {
      const nextBlock = (await time.latestBlock()).add(new BN(1));
      const calculatedRewardAmount = await calculateReward(this.bank, [this.firstCommunity], accounts[0], nextBlock);
      const oldBalance = await this.token.balanceOf(accounts[0]);
      await this.bank.withdraw(this.firstCommunity, this.oneToken, { from: accounts[0] });
      const newBalance = await this.token.balanceOf(accounts[0]);
      expect(newBalance.sub(oldBalance)).to.bignumber.equal(this.oneToken.add(calculatedRewardAmount));
    });

    it("should emit a Withdraw event", async function () {
      const result = await this.bank.withdraw(this.firstCommunity, this.oneToken, { from: accounts[0] });
      expectEvent(result, "Withdraw", { communityId: this.firstCommunity, wallet: accounts[0], amount: this.oneToken });
    });
  });

  context("rewarding", async function () {
    it("should set countRewardsFrom to the current block", async function () {
      const oldStakes = await this.bank.stakes(this.firstCommunity, accounts[0]);
      const result = await this.bank.claimReward([this.firstCommunity], { from: accounts[0] });
      const newStakes = await this.bank.stakes(this.firstCommunity, accounts[0]);
      const blockNumber = new BN(result.receipt.blockNumber);
      expect(oldStakes.countRewardsFrom).to.bignumber.not.equal(blockNumber);
      expect(newStakes.countRewardsFrom).to.bignumber.equal(blockNumber);
    });

    it("should calculate the rewards to the user (one community)", async function () {
      await time.advanceBlockTo((await time.latestBlock()).add(new BN(5)));
      const communityIds = [new BN(0)];
      const calculatedRewardAmount = await calculateReward(
        this.bank,
        communityIds,
        accounts[0],
        await time.latestBlock()
      );
      const rewardAmount = await this.bank.getReward(communityIds, { from: accounts[0] });
      expect(rewardAmount).to.bignumber.equal(calculatedRewardAmount);
    });

    it("should calculate the rewards to the user (multiple communities)", async function () {
      await time.advanceBlockTo((await time.latestBlock()).add(new BN(5)));
      const communityIds = [new BN(0), new BN(1), new BN(2)];
      const calculatedRewardAmount = await calculateReward(
        this.bank,
        communityIds,
        accounts[0],
        await time.latestBlock()
      );
      const rewardAmount = await this.bank.getReward(communityIds, { from: accounts[0] });
      expect(rewardAmount).to.bignumber.equal(calculatedRewardAmount);
    });

    it("should mint the rewards to the user (one community)", async function () {
      await time.advanceBlockTo((await time.latestBlock()).add(new BN(5)));
      const communityIds = [new BN(0)];
      const nextBlock = (await time.latestBlock()).add(new BN(1));
      const calculatedRewardAmount = await calculateReward(this.bank, communityIds, accounts[0], nextBlock);
      const oldBalance = await this.token.balanceOf(accounts[0]);
      await this.bank.claimReward(communityIds, { from: accounts[0] });
      const newBalance = await this.token.balanceOf(accounts[0]);
      expect(newBalance.sub(oldBalance)).to.bignumber.equal(calculatedRewardAmount);
    });

    it("should mint the rewards to the user (multiple communities)", async function () {
      await time.advanceBlockTo((await time.latestBlock()).add(new BN(5)));
      const communityIds = [new BN(0), new BN(1), new BN(2)];
      const nextBlock = (await time.latestBlock()).add(new BN(1));
      const calculatedRewardAmount = await calculateReward(this.bank, communityIds, accounts[0], nextBlock);
      const oldBalance = await this.token.balanceOf(accounts[0]);
      await this.bank.claimReward(communityIds, { from: accounts[0] });
      const newBalance = await this.token.balanceOf(accounts[0]);
      expect(newBalance.sub(oldBalance)).to.bignumber.equal(calculatedRewardAmount);
    });

    it("should emit a RewardClaimed event", async function () {
      const result = await this.bank.claimReward([this.firstCommunity], { from: accounts[0] });
      expectEvent(result, "RewardClaimed", { wallet: accounts[0] });
    });
  });
});
