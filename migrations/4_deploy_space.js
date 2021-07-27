// Token properties
// NOTE: change them before deploying
const tokenAddress = "INSERT_HERE";
const stakeTokenName = "Agora.space Token";
const stakeTokenSymbol = "AGT";

// Contracts
const read = require("readline-sync");
const staking = artifacts.require("AgoraSpace");
const stakeToken = artifacts.require("AgoraToken");

if (read.keyInYN("WAIT! Did you set the token's properties in this script (4_deploy_space.js)?")) {
  console.log("Cool, let the deployment begin...");
} else {
  console.log("Set them and try again.");
  process.exit(0);
}

module.exports = async (deployer) => {
  // Get the decimals of the staked token
  const erc20Abi = require("../build/contracts/ERC20.json").abi;
  const web3 = staking.interfaceAdapter.web3;
  const tokenContract = new web3.eth.Contract(erc20Abi, tokenAddress);
  const stakeTokenDecimals = await tokenContract.methods.decimals().call();
  console.log(`The community's token has ${stakeTokenDecimals} decimals.`);

  // Deploy the stakeToken and then the staking contract
  await deployer.deploy(stakeToken, stakeTokenName, stakeTokenSymbol, stakeTokenDecimals);
  await deployer.deploy(staking, tokenAddress, stakeToken.address);

  // Transfer ownerShip of the token to the staking contract
  console.log("Transferring the token's ownership to the Agora Space contract...");
  const stakeTokenInstance = await stakeToken.deployed();
  await stakeTokenInstance.transferOwnership(staking.address);
  const newOwner = await stakeTokenInstance.owner();
  if (newOwner === staking.address) console.log("Agora Token's ownership successfully transferred.");
  else console.log(`You need to transfer Agora Token's ownership to ${staking.address} manually`);
};
