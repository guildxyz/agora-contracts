const read = require("readline-sync");
const Bank = artifacts.require("AgoraBank");

if (read.keyInYN("WAIT! Did you set the new AGO address in the Agora Bank contract?")) {
  console.log("Cool, let's deploy it...");
} else {
  console.log("Set it and try again.");
  process.exit(0);
}

module.exports = (deployer) => {
  deployer.deploy(Bank);
};
