// Initial supply in wei, minted to the deployer
// NOTE: change it before deploying
const initialSupply = 0;

const Token = artifacts.require("AgoraMemberToken");

module.exports = (deployer) => {
  deployer.deploy(Token, "Agora Member Token", "AGO", initialSupply);
};
