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
    this.timelockDuration = new BN(10);
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

    it("should have a default timelock duration", async function () {
      const result = await this.space.lockInterval();
      expect(result).to.bignumber.equal(this.timelockDuration);
    });

    it("should allow the owner to change the timelock duration", async function () {
      const desiredTimelock = new BN(5);
      const oldTimelock = await this.space.lockInterval();
      await this.space.setLockInterval(desiredTimelock, { from: accounts[0] });
      const newTimelock = await this.space.lockInterval();
      expect(oldTimelock).to.not.equal(desiredTimelock);
      expect(newTimelock).to.bignumber.equal(desiredTimelock);
    });

    it("should revert if not the owner is trying to change the timelock duration", async function () {
      await expectRevert(
        this.space.setLockInterval(new BN(10), { from: accounts[2] }),
        "Ownable: caller is not the owner"
      );
    });
  });

  context("depositing", async function () {
    it("should not allow depositing zero tokens", async function () {
      await expectRevert(this.space.deposit(0, { from: accounts[0] }), "Non-positive deposit amount");
    });

    xit("should not allow depositing more than 600 times", async function () {
      const deposits = [];
      for (let i = 0; i < 600; i++) deposits.push(this.space.deposit(1, { from: accounts[2] }));
      await Promise.all(deposits);
      await expectRevert(this.space.deposit(1, { from: accounts[2] }), "Too many consecutive deposits");
    });

    it("should set the timelock correctly (3 attempts)", async function () {
      for (let i = 0; i < 3; i++) {
        const result = await this.space.deposit(this.oneToken, { from: accounts[0] });
        const blockNumber = result.receipt.blockNumber;
        const block = await web3.eth.getBlock(blockNumber);
        const lockInterval = await this.space.lockInterval();
        const timelockEntry = await this.space.timelocks(accounts[0], i);
        expect(timelockEntry.expires).to.bignumber.equal(new BN(block.timestamp + lockInterval * 60));
        expect(timelockEntry.amount).to.bignumber.equal(this.oneToken);
      }
    });

    it("should mint stakeTokens", async function () {
      const oldBalance = await this.stakeToken.balanceOf(accounts[0]);
      await this.space.deposit(this.oneToken, { from: accounts[0] });
      const newBalance = await this.stakeToken.balanceOf(accounts[0]);
      expect(newBalance.sub(oldBalance)).to.bignumber.equal(this.oneToken);
    });

    it("should transfer tokens to the contract", async function () {
      const oldBalance = await this.token.balanceOf(accounts[0]);
      await this.space.deposit(this.oneToken, { from: accounts[0] });
      const newBalance = await this.token.balanceOf(accounts[0]);
      expect(oldBalance.sub(newBalance)).to.bignumber.equal(this.oneToken);
    });

    it("should emit a Deposit event", async function () {
      const result = await this.space.deposit(this.oneToken, { from: accounts[0] });
      expectEvent(result, "Deposit", { wallet: accounts[0], amount: this.oneToken });
    });
  });

  context("withdrawing", async function () {
    it("should not allow withdrawing zero tokens", async function () {
      await expectRevert(this.space.withdraw(0, { from: accounts[0] }), "Non-positive withdraw amount");
    });

    it("should revert if the tokens are not unlocked yet", async function () {
      await expectRevert(this.space.withdraw(1, { from: accounts[0] }), "Not enough unlocked tokens");
    });

    it("should not revert after the tokens are unlocked", async function () {
      const lockInterval = await this.space.lockInterval();
      await time.increase(lockInterval * 60);
      const result = await this.space.withdraw(this.oneToken, { from: accounts[0] });
      expect(result.receipt.status).to.be.true;
    });

    it("should revert when trying to withdraw more tokens than unlocked", async function () {
      const depositedAmount = await this.stakeToken.balanceOf(accounts[0]);
      await this.space.deposit(this.oneToken, { from: accounts[0] });
      await expectRevert(
        this.space.withdraw(depositedAmount.add(new BN(1)), { from: accounts[0] }),
        "Not enough unlocked tokens"
      );
    });

    it("should not revert when trying to withdraw less token than unlocked", async function () {
      const lockInterval = await this.space.lockInterval();
      await time.increase(lockInterval * 60);
      const depositedAmount = await this.stakeToken.balanceOf(accounts[0]);
      await this.space.deposit(this.oneToken, { from: accounts[0] });
      const result = await this.space.withdraw(depositedAmount, { from: accounts[0] });
      expect(result.receipt.status).to.be.true;
    });

    it("should burn stakeTokens", async function () {
      const lockInterval = await this.space.lockInterval();
      await this.space.deposit(this.oneToken.mul(new BN(5)), { from: accounts[0] });
      time.increase(lockInterval * 60);
      const oldBalance = await this.stakeToken.balanceOf(accounts[0]);
      await this.space.withdraw(this.oneToken, { from: accounts[0] });
      const newBalance = await this.stakeToken.balanceOf(accounts[0]);
      expect(oldBalance.sub(newBalance)).to.bignumber.equal(this.oneToken);
    });

    it("should transfer tokens to the withdrawer", async function () {
      const oldBalance = await this.token.balanceOf(accounts[0]);
      await this.space.withdraw(this.oneToken, { from: accounts[0] });
      const newBalance = await this.token.balanceOf(accounts[0]);
      expect(newBalance.sub(oldBalance)).to.bignumber.equal(this.oneToken);
    });

    it("should emit a Withdraw event", async function () {
      const result = await this.space.withdraw(this.oneToken, { from: accounts[0] });
      expectEvent(result, "Withdraw", { wallet: accounts[0], amount: this.oneToken });
    });
  });
});
