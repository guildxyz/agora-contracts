// Token properties
// NOTE: change them before deploying
const stakeTokenAddress = "";
const returnTokenName = "Agora.space Token";
const returnTokenSymbol = "AGT";

// Contracts
const staking = artifacts.require("AgoraSpace");
const returnToken = artifacts.require("AgoraToken");

module.exports = async (deployer) => {
  // Get the decimals of the staked token
  const erc20Abi = require("../build/contracts/ERC20.json").abi;
  const web3 = staking.interfaceAdapter.web3;
  const tokenContract = new web3.eth.Contract(erc20Abi, stakeTokenAddress);
  const returnTokenDecimals = await tokenContract.methods.decimals().call();
  console.log(`The staked token has ${returnTokenDecimals} decimals.`);

  // Deploy the returnToken and then the staking contract
  await deployer.deploy(returnToken, returnTokenName, returnTokenSymbol, returnTokenDecimals);
  await deployer.deploy(staking, stakeTokenAddress, returnToken.address);

  // Transfer ownerShip of the token to the staking contract
  console.log("Transferring the token's ownership to the Agora Space contract...");
  const tokenInstance = await returnToken.deployed();
  await tokenInstance.transferOwnership(staking.address);
  const newOwner = tokenInstance.owner();
  console.log("Agora Token's ownership successfully transferred.");
};
