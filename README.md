# Agora Space smart contracts

The smart contracts in this repository are being used by [agora.space](https://agora.space).  
The Agora Space contract provides a way to lock tokens for a period of time. Agora Tokens are minted in exchange for the deposited assets that can be swapped back again after their timelock has expired. A detailed article written about the timelock implementation is available [here](https://github.com/zgendao/agora.space/wiki/Timelock-implementation-possibilities-in-smart-contracts).  
The Agora Bank contract provides a way to stake tokens in order to extend a community's space's capacity. Agora Member Tokens are minted in exchange. Rewards are distributed proportionately per block.

## Requirements

To run the project you need:

- [Node.js 12.x](https://nodejs.org/download/release/latest-v12.x) development environment.
- [Truffle](https://www.trufflesuite.com/truffle) for compiling and deploying.
- (optional) Local [Ganache](https://www.trufflesuite.com/ganache) environment installed with `npm install -g ganache-cli` for local testing.
- (optional) A file named `.mnemonic` in the root folder with your 12-word MetaMask seedphrase for deploying.
- (optional) A file named `.infura` in the root folder with your [Infura](https://infura.io) project ID for deploying to Ethereum networks.

## Before deployment

Pull the repository from GitHub, then install its dependencies by executing this command:

```bash
npm install
```

### Agora Space contract

Before deployment, you can rename the _AgoraSpace_ contract to include the accepted token's name or symbol. For WETH, the name could be AgoraWETHSpace.

Open _migrations/4_deploy_space.js_. Notice the top two constants:

```javascript
const stakeTokenAddress = "";
const returnTokenName = "Agora.space Token";
```

Edit them according to your needs.  
`stakeTokenAddress` is the address of the token to be staked.  
`returnTokenName` is the name of the token that will be given in return for staking. Conventionally, it should include the name or symbol of the stakeToken, e.g for WETH it should be Agora.space WETH Token.

### Agora Bank contract

Open _contracts/AgoraBank.sol_ and search for the function `agoAddress()`. Replace the address in it's return statement with the Agora Member Token's (AGO) address. **If this step is omitted, the contract becomes unusable!** This needs to be done like this in order to be able to save gas later on each transaction made to the contract.

## Deployment

To deploy the smart contracts to a network, replace _[name]_ in this command:

```bash
truffle migrate --network [name]
```

Networks can be configured in _truffle-config.js_. We've preconfigured the following:

- `development` (for local testing)
- `bsctest` (Binance Smart Chain Testnet)
- `bsc` (Binance Smart Chain)
- `ropsten` (Ropsten Ethereum Testnet)
- `kovan` (Kovan Ethereum Testnet)
- `ethereum` (Ethereum Mainnet)

### Note

The above procedure deploys all the contracts. If you want to deploy only specific contracts, you can run only the relevant script(s) via the below command:

```bash
truffle migrate -f [start] --to [end] --network [name]
```

Replace _[start]_ with the number of the first and _[end]_ with the number of the last migration script you wish to run. To run only one script, _[start]_ and _[end]_ should match. The numbers of the scripts are:

- 1 - Migrations
- 2 - Agora Member Token
- 3 - Agora Bank
- 4 - Agora Space and it's token

If the script fails before starting the deployment, you might need to run the first one, too.

## After deployment

### Agora Space contract

The deployment script should automatically transfer it's token's ownership to the AgoraSpace contract. If it fails to do so, it should be transferred manually.

### Agora Member Token contract

Initially, the minter role is granted to the deployer. Ideally, if the deployer is not the governance wallet, they should grant the role to the governance and revoke from themselves. Then, the governance should grant the role to the Agora Bank contract. If a new version of Agora Bank is deployed, the governance is able to grant it the role, too.