const { BN, ether, expectRevert } = require("@openzeppelin/test-helpers");
const expect = require("chai").expect;

const tokenContract = artifacts.require("AgoraMemberToken");

contract("AgoraMemberToken", async function (accounts) {
  before("setup", async function () {
    this.name = "AgoraMemberToken";
    this.symbol = "AGO";
    this.initialSupply = ether("1000");
    this.token = await tokenContract.new(this.name, this.symbol, this.initialSupply);
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

    it("should store the hash of the minter role", async function () {
      const result = await this.token.MINTER_ROLE();
      expect(result).to.equal(web3.utils.keccak256("MINTER_ROLE"));
    });
  });

  context("constructor", async function () {
    it("should grant DEFAULT_ADMIN_ROLE to the deployer", async function () {
      const result = await this.token.hasRole(await this.token.DEFAULT_ADMIN_ROLE(), accounts[0]);
      expect(result).to.be.true;
    });
    it("should mint the correct initial supply to the deployer", async function () {
      const result = await this.token.balanceOf(accounts[0]);
      expect(result).to.bignumber.equal(this.initialSupply);
    });
  });

  context("minting", async function () {
    it("should be able to mint AGO if called by someone with MINTER_ROLE", async function () {
      await this.token.grantRole(await this.token.MINTER_ROLE(), accounts[1]);
      const result = await this.token.mint(accounts[1], this.oneToken, { from: accounts[1] });
      expect(result.receipt.status).to.be.true;
    });

    it("should fail to mint AGO if called by someone without MINTER_ROLE", async function () {
      await expectRevert(this.token.mint(accounts[1], this.oneToken, { from: accounts[2] }), "Minting failed");
    });

    it("should fail to mint AGO if called by someone with DEFAULT_ADMIN_ROLE", async function () {
      await expectRevert(this.token.mint(accounts[1], this.oneToken, { from: accounts[0] }), "Minting failed");
    });

    it("should mint the correct amount", async function () {
      const oldBalance = await this.token.balanceOf(accounts[1]);
      await this.token.mint(accounts[1], this.oneToken, { from: accounts[1] });
      const newBalance = await this.token.balanceOf(accounts[1]);
      const difference = newBalance.sub(oldBalance);
      expect(difference).to.bignumber.equal(this.oneToken);
    });
  });
});
