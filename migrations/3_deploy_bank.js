// Token address
// NOTE: change it before deploying
const agoAddress = "INSERT_HERE";

const read = require("readline-sync");
const Bank = artifacts.require("AgoraBank");

if (read.keyInYN("WAIT! Did you set the new AGO address in this script (3_deploy_bank.js)?")) {
  console.log("Cool, let the deployment begin...");
} else {
  console.log("Set it and try again.");
  process.exit(0);
}

module.exports = (deployer) => {
  deployer.deploy(Bank, agoAddress);
};
