const Factory = artifacts.require("AgoraSpaceFactory");

module.exports = (deployer) => {
  deployer.deploy(Factory);
};
