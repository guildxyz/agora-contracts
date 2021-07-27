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

### Agora Member Token contract

Open _migrations/2_deploy_ago.js_. Notice the constant at the top:

```javascript
const initialSupply = 0;
```

Change it to the amount of the token's initial supply in wei.

### Agora Bank contract

Open _migrations/3_deploy_bank.js_. Notice the constant at the top:

```javascript
const agoAddress = "INSERT_HERE";
```

Change it to the address of the token to be staked (Agora Member Token - AGO).

### Agora Space contract

Open _migrations/4_deploy_space.js_. Notice the top two constants:

```javascript
const tokenAddress = "INSERT_HERE";
const stakeTokenName = "Agora.space Token";
```

Edit them according to your needs.  
`tokenAddress` is the address of the token to be staked.  
`stakeTokenName` is the name of the token that will be given in return for staking. Conventionally, it should include the name or symbol of the stakeToken, e.g for WETH it should be Agora.space WETH Token.

## Deployment

To deploy the smart contracts to a network, replace _[name]_ in this command:

```bash
truffle migrate --network [name]
```

Networks can be configured in _truffle-config.js_. We've preconfigured the following:

- `development` (for local testing)
- `ethereum` (Ethereum Mainnet)
- `kovan` (Kovan Ethereum Testnet)
- `ropsten` (Ropsten Ethereum Testnet)
- `bsc` (Binance Smart Chain)
- `bsctest` (Binance Smart Chain Testnet)
- `polygon` (Polygon Mainnet (formerly Matic))
- `mumbai` (Matic Mumbai Testnet)

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

### Agora Member Token contract

Initially, the DEFAULT_ADMIN_ROLE is granted to the deployer. Ideally, if the deployer is not the governance wallet, they should grant the role to the governance and revoke from themselves. Then, the governance should grant the MINTER_ROLE to the Agora Bank contract. If a new version of Agora Bank is deployed, the governance is able to grant it the role, too.  
The DEFAULT_ADMIN_ROLE is not able to mint tokens, only the MINTER_ROLE is. Ideally, only the different versions of Bank contracts have it. If it's granted to any other address, the security might be at risk. To get the addresses that received the role, listen for the `RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)` event.

### Agora Space contract

The deployment script should automatically transfer it's token's ownership to the AgoraSpace contract. If it fails to do so, it should be transferred manually.
