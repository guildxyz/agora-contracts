const Token = artifacts.require("AgoraMemberToken");

module.exports = (deployer) => {
  deployer.deploy(Token, "Agora Member Token", "AGO");
};
