const { BN, ether, expectRevert } = require("@openzeppelin/test-helpers");
const expect = require("chai").expect;

const tokenContract = artifacts.require("AgoraToken");

contract("AgoraToken", async function (accounts) {
  before("setup", async function () {
    this.name = "AgoraToken";
    this.symbol = "AGT";
    this.decimals = new BN(18);
    this.token = await tokenContract.new(this.name, this.symbol, this.decimals);
    this.oneToken = ether("1");
  });

  context("metadata", async function () {
    it("should have the correct name", async function () {
      const result = await this.token.name();
      expect(result).to.equal(this.name);
    });

    it("should have the correct symbol", async function () {
      const result = await this.token.symbol();
      expect(result).to.equal(this.symbol);
    });

    it("should have the correct decimals", async function () {
      const result = await this.token.decimals();
      expect(result).to.bignumber.equal(this.decimals);
    });
  });

  context("minting", async function () {
    it("should be able to mint AGT if called by the owner", async function () {
      const result = await this.token.mint(accounts[1], this.oneToken, { from: accounts[0] });
      expect(result.receipt.status).to.be.true;
    });

    it("should fail to mint AGT if not called by the owner", async function () {
      await expectRevert(
        this.token.mint(accounts[1], this.oneToken, { from: accounts[2] }),
        "Ownable: caller is not the owner"
      );
    });

    it("should mint the correct amount", async function () {
      const oldBalance = await this.token.balanceOf(accounts[1]);
      await this.token.mint(accounts[1], this.oneToken, { from: accounts[0] });
      const newBalance = await this.token.balanceOf(accounts[1]);
      const difference = newBalance.sub(oldBalance);
      expect(difference).to.bignumber.equal(this.oneToken);
    });
  });

  context("burning", async function () {
    it("should be able to burn AGT if called by the owner", async function () {
      const result = await this.token.burn(accounts[1], this.oneToken, { from: accounts[0] });
      expect(result.receipt.status).to.be.true;
    });

    it("should fail to burn AGT if not called by the owner", async function () {
      await expectRevert(
        this.token.burn(accounts[1], this.oneToken, { from: accounts[2] }),
        "Ownable: caller is not the owner"
      );
    });

    it("should burn the correct amount", async function () {
      const oldBalance = await this.token.balanceOf(accounts[1]);
      await this.token.mint(accounts[1], this.oneToken, { from: accounts[0] });
      const medBalance = await this.token.balanceOf(accounts[1]);
      await this.token.burn(accounts[1], this.oneToken, { from: accounts[0] });
      const newBalance = await this.token.balanceOf(accounts[1]);
      const difference = medBalance.sub(newBalance);
      expect(difference).to.bignumber.equal(this.oneToken);
      expect(oldBalance).to.bignumber.equal(newBalance);
    });
  });
});
