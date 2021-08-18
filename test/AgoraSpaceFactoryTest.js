const { constants, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const expect = require("chai").expect;

const factoryContract = artifacts.require("AgoraSpaceFactory");
const sampleTokenContract = artifacts.require("AgoraMemberToken");
const agoraTokenContract = artifacts.require("AgoraToken");
const spaceContract = artifacts.require("AgoraSpace");

function getEventArg(logs, eventName, eventArg) {
  for (elem of logs) if (elem.event === eventName) return elem.args[eventArg];
}

contract("AgoraSpaceFactory", async function (accounts) {
  let factory;
  let sampleToken;

  before("setup", async function () {
    sampleToken = await sampleTokenContract.new("OwoToken", "OWO", 0);
  });

  beforeEach("cleanup in between tests", async function () {
    factory = await factoryContract.new();
  });

  context("managing approvals", async function () {
    it("should work when called by the owner", async function () {
      const result = await factory.setApproval(accounts[0], sampleToken.address, true, { from: accounts[0] });
      expect(result.receipt.status).to.be.true;
    });

    it("should revert if called by anyone but the owner", async function () {
      await expectRevert(
        factory.setApproval(accounts[0], sampleToken.address, true, { from: accounts[1] }),
        "Ownable: caller is not the owner"
      );
    });

    it("should revert if the token owner is the zero address", async function () {
      await factory.setApproval(accounts[0], sampleToken.address, true, { from: accounts[0] });
      await expectRevert.unspecified(
        factory.setApproval(constants.ZERO_ADDRESS, sampleToken.address, { from: accounts[0] })
      );
    });

    it("should revert if the token address is the zero address", async function () {
      await factory.setApproval(accounts[0], sampleToken.address, true, { from: accounts[0] });
      await expectRevert.unspecified(factory.setApproval(accounts[0], constants.ZERO_ADDRESS, { from: accounts[0] }));
    });

    it("should set approved state", async function () {
      await factory.setApproval(accounts[1], sampleToken.address, true, { from: accounts[0] });
      const state = await factory.approvedAddresses(accounts[1], sampleToken.address);
      expect(state).to.be.true;
    });

    it("should set disapproved state", async function () {
      await factory.setApproval(accounts[1], sampleToken.address, false, { from: accounts[0] });
      const state = await factory.approvedAddresses(accounts[1], sampleToken.address);
      expect(state).to.be.false;
    });

    it("should emit an AddressApproved event", async function () {
      const result = await factory.setApproval(accounts[1], sampleToken.address, true, { from: accounts[0] });
      expectEvent(result, "AddressApproved", {
        account: accounts[1],
        token: sampleToken.address,
        approvalState: true,
      });
    });
  });

  context("creating spaces", async function () {
    beforeEach("approve an address", async function () {
      await factory.setApproval(accounts[0], sampleToken.address, true, { from: accounts[0] });
    });

    it("should work when called by an approved address", async function () {
      const result = await factory.createSpace(sampleToken.address, { from: accounts[0] });
      expect(result.receipt.status).to.be.true;
    });

    it("should revert when called by a not approved address", async function () {
      await expectRevert.unspecified(factory.createSpace(sampleToken.address, { from: accounts[1] }));
    });

    it("should revert when trying to create a space if the community already has one", async function () {
      await factory.createSpace(sampleToken.address, { from: accounts[0] });
      await expectRevert.unspecified(factory.createSpace(sampleToken.address, { from: accounts[0] }));
    });

    context("the created Agora Token contract", async function () {
      beforeEach("create a space and get the deployed token", async function () {
        const result = await factory.createSpace(sampleToken.address, { from: accounts[0] });
        const deployedTokenAddress = getEventArg(result.receipt.logs, "SpaceCreated", "agoraToken");
        this.deployedTokenInstance = await agoraTokenContract.at(deployedTokenAddress);
      });

      it("should include the community's token's symbol in it's name", async function () {
        const name = await this.deployedTokenInstance.name();
        const communitySymbol = await sampleToken.symbol();
        expect(name).to.equal(`Agora.space ${communitySymbol} Token`);
      });

      it("should have the symbol AGT", async function () {
        const symbol = await this.deployedTokenInstance.symbol();
        expect(symbol).to.equal("AGT");
      });

      it("should have the same decimals as the community's token", async function () {
        const decimals = await this.deployedTokenInstance.decimals();
        const communityDecimals = await sampleToken.decimals();
        expect(decimals).to.bignumber.equal(communityDecimals);
      });
    });

    context("the created Agora Space contract", async function () {
      beforeEach("create a space and get it's address", async function () {
        const result = await factory.createSpace(sampleToken.address, { from: accounts[0] });
        const deployedSpaceAddress = getEventArg(result.receipt.logs, "SpaceCreated", "space");
        this.deployedTokenAddress = getEventArg(result.receipt.logs, "SpaceCreated", "agoraToken");
        this.deployedSpaceInstance = await spaceContract.at(deployedSpaceAddress);
      });

      it("should have the address of the community's token", async function () {
        const storedToken = await this.deployedSpaceInstance.token();
        expect(storedToken).to.equal(sampleToken.address);
      });

      it("should have the address of the Agora Token", async function () {
        const storedToken = await this.deployedSpaceInstance.stakeToken();
        expect(storedToken).to.equal(this.deployedTokenAddress);
      });
    });

    it("should register the new space's address", async function () {
      const result = await factory.createSpace(sampleToken.address, { from: accounts[0] });
      const deployedSpaceAddress = getEventArg(result.receipt.logs, "SpaceCreated", "space");
      const registeredAddress = await factory.spaces(sampleToken.address);
      expect(registeredAddress).to.equal(deployedSpaceAddress);
    });

    it("should transfer the token's ownership to the space's address", async function () {
      const result = await factory.createSpace(sampleToken.address, { from: accounts[0] });
      const deployedSpaceAddress = getEventArg(result.receipt.logs, "SpaceCreated", "space");
      const deployedTokenAddress = getEventArg(result.receipt.logs, "SpaceCreated", "agoraToken");
      const deployedTokenInstance = await agoraTokenContract.at(deployedTokenAddress);
      const owner = await deployedTokenInstance.owner();
      expect(owner).to.equal(deployedSpaceAddress);
    });

    it("should transfer the space's ownership to the deployer", async function () {
      const result = await factory.createSpace(sampleToken.address, { from: accounts[0] });
      const deployedSpaceAddress = getEventArg(result.receipt.logs, "SpaceCreated", "space");
      const deployedSpaceInstance = await spaceContract.at(deployedSpaceAddress);
      const owner = await deployedSpaceInstance.owner();
      expect(owner).to.equal(accounts[0]);
    });

    it("should emit a SpaceCreated event", async function () {
      const result = await factory.createSpace(sampleToken.address, { from: accounts[0] });
      const spaceAddress = await factory.spaces(sampleToken.address);
      expectEvent(result, "SpaceCreated", { token: sampleToken.address, space: spaceAddress });
      // Checking the Agora Token's address is tricky - let's check if there's an AGT token at the address in the event
      const deployedTokenAddress = getEventArg(result.receipt.logs, "SpaceCreated", "agoraToken");
      const deployedTokenInstance = await agoraTokenContract.at(deployedTokenAddress);
      const symbol = await deployedTokenInstance.symbol();
      expect(symbol).to.equal("AGT");
    });
  });
});
