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
const spaceContract = artifacts.require("AgoraSpace");
const stakeTokenContract = artifacts.require("AgoraToken");

contract("AgoraSpace", async function (accounts) {
  before("setup", async function () {
    this.oneToken = ether("1");
    this.token = await tokenContract.new("OwoToken", "OWO", ether("300"));
    this.stakeToken = await stakeTokenContract.new("AgoraToken", "AGT", 18);
    this.space = await spaceContract.new(this.token.address, this.stakeToken.address);
    // Transfer ownership, approve tokens for the first three accounts and fund them
    await Promise.all([
      this.stakeToken.transferOwnership(this.space.address, { from: accounts[0] }),
      this.token.approve(this.space.address, constants.MAX_UINT256, { from: accounts[0] }),
      this.token.approve(this.space.address, constants.MAX_UINT256, { from: accounts[1] }),
      this.token.approve(this.space.address, constants.MAX_UINT256, { from: accounts[2] }),
      this.stakeToken.approve(this.space.address, constants.MAX_UINT256, { from: accounts[0] }),
      this.stakeToken.approve(this.space.address, constants.MAX_UINT256, { from: accounts[1] }),
      this.stakeToken.approve(this.space.address, constants.MAX_UINT256, { from: accounts[2] }),
      this.token.transfer(accounts[1], ether("100"), { from: accounts[0] }),
      this.token.transfer(accounts[2], ether("100"), { from: accounts[0] }),
    ]);
  });

  context("state variables", async function () {
    it("should return the token's address", async function () {
      const result = await this.space.token();
      expect(result).to.equal(this.token.address);
    });

    it("should return the stakeToken's address", async function () {
      const result = await this.space.stakeToken();
      expect(result).to.equal(this.stakeToken.address);
    });

    it("should not be frozen", async function () {
      const result = await this.space.frozen();
      expect(result).to.be.false;
    });
  });

  context("Rank management", async function () {
    it("should create new rank (2 attempts)", async function () {
      await this.space.addRank(1, this.oneToken, { from: accounts[0] });
      await this.space.addRank(2, ether("2"), { from: accounts[0] });
      const rank1 = await this.space.ranks(0);
      const rank2 = await this.space.ranks(1);
      const numOfRanks = await this.space.numOfRanks();
      expect(rank1.minDuration).to.bignumber.equal(new BN(1));
      expect(rank1.goalAmount).to.bignumber.equal(this.oneToken);
      expect(rank2.minDuration).to.bignumber.equal(new BN(2));
      expect(rank2.goalAmount).to.bignumber.equal(ether("2"));
      expect(numOfRanks).to.bignumber.equal(new BN(2));
    });

    it("should emit a NewRank event", async function () {
      const result = await this.space.addRank(2, ether("2"), { from: accounts[0] });
      expectEvent(result, "NewRank", { minDuration: new BN(2), goalAmount: ether("2"), id: new BN(2) });
    });

    it("should revert if not the owner is trying to add a new rank", async function () {
      await expectRevert(this.space.addRank(3, ether("2"), { from: accounts[2] }), "Ownable: caller is not the owner");
    });

    it("should revert if the new rank's min. duration is too short", async function () {
      await expectRevert.unspecified(this.space.addRank(1, ether("2"), { from: accounts[0] }));
    });

    it("should revert if the new rank's goal amount is too low", async function () {
      await expectRevert.unspecified(this.space.addRank(2, this.oneToken, { from: accounts[0] }));
    });

    it("should modify rank", async function () {
      await this.space.modifyRank(2, ether("3"), 2, { from: accounts[0] });
    });

    it("should emit a ModifyRank event", async function () {
      const result = await this.space.modifyRank(3, ether("3"), 2, { from: accounts[0] });
      expectEvent(result, "ModifyRank", { minDuration: new BN(3), goalAmount: ether("3"), id: new BN(2) });
    });

    it("should revert if rank is invalid", async function () {
      await expectRevert.unspecified(this.space.modifyRank(4, ether("4"), 3, { from: accounts[0] }));
    });

    it("should revert if not the owner is trying to modify a rank", async function () {
      await expectRevert(
        this.space.modifyRank(4, ether("3"), 2, { from: accounts[2] }),
        "Ownable: caller is not the owner"
      );
    });

    it("should revert if new min. duration is out of bounds", async function () {
      await expectRevert.unspecified(this.space.modifyRank(3, ether("1"), 0, { from: accounts[0] }));
      await expectRevert.unspecified(this.space.modifyRank(1, ether("3"), 2, { from: accounts[0] }));
    });

    it("should revert if new goal amount is out of bounds", async function () {
      await expectRevert.unspecified(this.space.modifyRank(1, ether("3"), 0, { from: accounts[0] }));
      await expectRevert.unspecified(this.space.modifyRank(3, ether("1"), 2, { from: accounts[0] }));
    });
  });

  context("depositing", async function () {
    it("should not allow depositing zero tokens", async function () {
      await expectRevert.unspecified(this.space.deposit(0, 0, false, { from: accounts[0] }));
    });

    xit("should not allow depositing more than 600 times", async function () {
      const deposits = [];
      for (let i = 0; i < 600; i++) deposits.push(this.space.deposit(1, 0, false, { from: accounts[2] }));
      await Promise.all(deposits);
      await expectRevert.unspecified(this.space.deposit(1, { from: accounts[2] }));
    });

    it("should set the timelock correctly (3 attempts)", async function () {
      for (let i = 0; i < 3; i++) {
        const result = await this.space.deposit(this.oneToken, i, false, { from: accounts[0] });
        const blockNumber = result.receipt.blockNumber;
        const block = await web3.eth.getBlock(blockNumber);
        const rank = await this.space.ranks(i);
        const rankBalance = await this.space.rankBalances(i, accounts[0]);
        const timelocks = await this.space.getTimelocks(accounts[0]);
        const timelockEntry = timelocks[i];
        expect(timelockEntry.expires).to.bignumber.equal(new BN(block.timestamp + rank.minDuration * 60));
        expect(timelockEntry.amount).to.bignumber.equal(this.oneToken);
        expect(timelockEntry.rankId).to.bignumber.equal(new BN(i));
        expect(rankBalance.locked).to.bignumber.equal(this.oneToken);
      }
    });

    it("should mint stakeTokens", async function () {
      const oldBalance = await this.stakeToken.balanceOf(accounts[0]);
      await this.space.deposit(this.oneToken, 0, false, { from: accounts[0] });
      const newBalance = await this.stakeToken.balanceOf(accounts[0]);
      expect(newBalance.sub(oldBalance)).to.bignumber.equal(this.oneToken);
    });

    it("should transfer tokens to the contract", async function () {
      const oldBalance = await this.token.balanceOf(accounts[0]);
      await this.space.deposit(this.oneToken, 0, false, { from: accounts[0] });
      const newBalance = await this.token.balanceOf(accounts[0]);
      expect(oldBalance.sub(newBalance)).to.bignumber.equal(this.oneToken);
    });

    it("should emit a Deposit event", async function () {
      const result = await this.space.deposit(this.oneToken, 0, false, { from: accounts[0] });
      expectEvent(result, "Deposit", { wallet: accounts[0], amount: this.oneToken });
    });
  });

  context("consolidate", async function () {
    it("should unlock tokens below a rank when goal amount is reached", async function () {
      await this.space.deposit(this.oneToken, 0, false, { from: accounts[0] });
      const rankBalance0 = await this.space.rankBalances(0, accounts[0]);
      const rank1 = await this.space.ranks(2);
      await this.space.deposit(rank1.goalAmount, 1, false, { from: accounts[0] });
      const newRankBalance0 = await this.space.rankBalances(0, accounts[0]);
      expect(newRankBalance0.locked).to.bignumber.equal(new BN(0));
      expect(newRankBalance0.unlocked).to.bignumber.equal(rankBalance0.unlocked.add(rankBalance0.locked));
    });

    it("should consolidate tokens when goal amount is not reached", async function () {
      const rankBalance0 = await this.space.rankBalances(0, accounts[0]);
      const rankBalance1 = await this.space.rankBalances(1, accounts[0]);
      const rankBalance2 = await this.space.rankBalances(2, accounts[0]);
      const amountBelow = rankBalance0.locked
        .add(rankBalance0.unlocked)
        .add(rankBalance1.locked)
        .add(rankBalance1.unlocked);
      const totalAmount = amountBelow.add(rankBalance2.locked).add(rankBalance2.unlocked);
      const rank2 = await this.space.ranks(2);

      await this.space.deposit(this.oneToken, 2, true, { from: accounts[0] });

      const newRankBalance0 = await this.space.rankBalances(0, accounts[0]);
      const newRankBalance1 = await this.space.rankBalances(1, accounts[0]);
      const newRankBalance2 = await this.space.rankBalances(2, accounts[0]);
      const newAmountBelow = newRankBalance0.locked
        .add(newRankBalance0.unlocked)
        .add(newRankBalance1.locked)
        .add(newRankBalance1.unlocked);

      expect(amountBelow).to.bignumber.be.greaterThan(new BN(0));
      expect(newAmountBelow).to.bignumber.equal(new BN(0));
      expect(newRankBalance2.locked).to.bignumber.equal(rank2.goalAmount);
      expect(newRankBalance2.locked.add(newRankBalance2.unlocked)).to.bignumber.equal(totalAmount.add(this.oneToken));
    });
  });

  context("withdrawing", async function () {
    it("should not allow withdrawing zero tokens", async function () {
      await expectRevert.unspecified(this.space.withdraw(0, 2, { from: accounts[0] }));
    });

    it("should revert when trying to withdraw more tokens than unlocked", async function () {
      const rankBalance2 = await this.space.rankBalances(2, accounts[0]);
      await expectRevert.unspecified(
        this.space.withdraw(rankBalance2.unlocked.add(this.oneToken), 2, { from: accounts[0] })
      );
    });

    it("should remove tokens", async function () {
      const rankBalance2 = await this.space.rankBalances(2, accounts[0]);
      expect(rankBalance2.unlocked).to.bignumber.be.greaterThan(new BN(0));
      await this.space.withdraw(rankBalance2.unlocked, 2, { from: accounts[0] });
      const newRankBalance2 = await this.space.rankBalances(2, accounts[0]);
      expect(newRankBalance2.unlocked).to.bignumber.equal(new BN(0));
    });

    it("should revert when tokens are locked", async function () {
      const rankBalance2 = await this.space.rankBalances(2, accounts[1]);
      expect(rankBalance2.unlocked.add(rankBalance2.locked)).to.bignumber.equal(new BN(0));
      await this.space.deposit(this.oneToken, 2, false, { from: accounts[1] });
      await expectRevert.unspecified(this.space.withdraw(this.oneToken, 2, { from: accounts[1] }));
    });

    it("should not revert after the tokens are expired", async function () {
      const rank2 = await this.space.ranks(2);
      await this.space.deposit(this.oneToken, 2, false, { from: accounts[1] });
      const rankBalance2 = await this.space.rankBalances(2, accounts[1]);
      time.increase(rank2.minDuration * 60);
      const result = await this.space.withdraw(rankBalance2.locked.add(rankBalance2.unlocked), 2, {
        from: accounts[1],
      });
      expect(result.receipt.status).to.be.true;
    });

    it("should burn stakeTokens", async function () {
      const rank2 = await this.space.ranks(2);
      await this.space.deposit(this.oneToken.mul(new BN(5)), 2, false, { from: accounts[1] });
      time.increase(rank2.minDuration * 60);
      const oldBalance = await this.stakeToken.balanceOf(accounts[1]);
      await this.space.withdraw(this.oneToken, 2, { from: accounts[1] });
      const newBalance = await this.stakeToken.balanceOf(accounts[1]);
      expect(oldBalance.sub(newBalance)).to.bignumber.equal(this.oneToken);
    });

    it("should transfer tokens to the withdrawer", async function () {
      const oldBalance = await this.token.balanceOf(accounts[1]);
      await this.space.withdraw(this.oneToken, 2, { from: accounts[1] });
      const newBalance = await this.token.balanceOf(accounts[1]);
      expect(newBalance.sub(oldBalance)).to.bignumber.equal(this.oneToken);
    });

    it("should emit a Withdraw event", async function () {
      const result = await this.space.withdraw(this.oneToken, 2, { from: accounts[1] });
      expectEvent(result, "Withdraw", { wallet: accounts[1], amount: this.oneToken });
    });
  });

  context("freeze space", async function () {
    it("should not allow emergency withdraw when not fozen ", async function () {
      await expectRevert.unspecified(this.space.emergencyWithdraw({ from: accounts[0] }));
    });

    it("should revert if not the owner is trying to freeze the contract", async function () {
      await expectRevert(this.space.freezeSpace({ from: accounts[2] }), "Ownable: caller is not the owner");
    });

    it("should emit a SpaceFrozenState event", async function () {
      const result = await this.space.freezeSpace({ from: accounts[0] });
      expectEvent(result, "SpaceFrozenState", { frozen: true });
    });

    it("should freeze the contract", async function () {
      const result = await this.space.frozen();
      expect(result).to.be.true;
    });

    it("should not allow deposit when fozen ", async function () {
      await expectRevert.unspecified(this.space.deposit(this.oneToken, 0, false, { from: accounts[0] }));
    });

    it("should not allow withdraw when fozen ", async function () {
      await expectRevert.unspecified(this.space.withdraw(this.oneToken, 0, { from: accounts[0] }));
    });

    it("should allow emergency withdraw when fozen", async function () {
      await this.space.emergencyWithdraw({ from: accounts[0] });
    });

    it("should allow to add new ranks when fozen", async function () {
      await this.space.addRank(4, ether("3"), { from: accounts[0] });
    });

    it("should allow to modify ranks when fozen", async function () {
      await this.space.modifyRank(4, ether("4"), 3, { from: accounts[0] });
    });
  });

  context("emergency withdraw", async function () {
    it("should revert if balance is zero ", async function () {
      await expectRevert.unspecified(this.space.emergencyWithdraw({ from: accounts[0] }));
    });

    it("should remove tokens", async function () {
      await this.space.thawSpace({ from: accounts[0] });
      await this.space.deposit(this.oneToken, 0, false, { from: accounts[0] });
      const rankBalance0 = await this.space.rankBalances(0, accounts[0]);
      expect(rankBalance0.locked).to.bignumber.be.greaterThan(new BN(0));
      await this.space.freezeSpace({ from: accounts[0] });
      await this.space.emergencyWithdraw({ from: accounts[0] });
      const newRankBalance0 = await this.space.rankBalances(0, accounts[0]);
      expect(newRankBalance0.unlocked).to.bignumber.equal(new BN(0));
    });

    it("should burn stakeTokens", async function () {
      await this.space.thawSpace({ from: accounts[0] });
      await this.space.deposit(this.oneToken, 0, false, { from: accounts[0] });
      await this.space.freezeSpace({ from: accounts[0] });
      const oldBalance = await this.stakeToken.balanceOf(accounts[0]);
      await this.space.emergencyWithdraw({ from: accounts[0] });
      const newBalance = await this.stakeToken.balanceOf(accounts[0]);
      expect(oldBalance).to.bignumber.equal(this.oneToken);
      expect(newBalance).to.bignumber.equal(new BN(0));
    });

    it("should transfer tokens to the withdrawer", async function () {
      await this.space.thawSpace({ from: accounts[0] });
      await this.space.deposit(this.oneToken, 0, false, { from: accounts[0] });
      await this.space.freezeSpace({ from: accounts[0] });
      const oldBalance = await this.token.balanceOf(accounts[0]);
      await this.space.emergencyWithdraw({ from: accounts[0] });
      const newBalance = await this.token.balanceOf(accounts[0]);
      expect(newBalance.sub(oldBalance)).to.bignumber.equal(this.oneToken);
    });

    it("should emit an EmergencyWithdraw event", async function () {
      await this.space.thawSpace({ from: accounts[0] });
      await this.space.deposit(this.oneToken, 0, false, { from: accounts[0] });
      await this.space.freezeSpace({ from: accounts[0] });
      const result = await this.space.emergencyWithdraw({ from: accounts[0] });
      expectEvent(result, "EmergencyWithdraw", { wallet: accounts[0], amount: this.oneToken });
    });
  });

  context("thaw space", async function () {
    it("should revert if not the owner is trying to thaw the contract", async function () {
      await expectRevert(this.space.thawSpace({ from: accounts[2] }), "Ownable: caller is not the owner");
    });

    it("should emit a SpaceFrozenState event", async function () {
      const result = await this.space.thawSpace({ from: accounts[0] });
      expectEvent(result, "SpaceFrozenState", { frozen: false });
    });

    it("should unfreeze the contract", async function () {
      const result = await this.space.frozen();
      expect(result).to.be.false;
    });

    it("should revert when not fozen ", async function () {
      await expectRevert.unspecified(this.space.thawSpace({ from: accounts[0] }));
    });

    it("should enable deposit", async function () {
      await this.space.deposit(this.oneToken.mul(new BN(2)), 0, false, { from: accounts[0] });
    });

    it("should enable withdraw", async function () {
      const rank0 = await this.space.ranks(0);
      time.increase(rank0.minDuration * 60);
      await this.space.withdraw(this.oneToken, 0, { from: accounts[0] });
    });

    it("should disable emergency withdraw", async function () {
      await expectRevert.unspecified(this.space.emergencyWithdraw({ from: accounts[0] }));
    });
  });
});
