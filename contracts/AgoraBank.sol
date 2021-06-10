// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "./token/IAgoraToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title The central contract of agora.space, keeping track of the community member limits and distributing rewards.
contract AgoraBank is Ownable {
    uint256 public rewardPerBlock = 100000000000000000; // 0.1 AGO by default
    uint256 public lockInterval = 586868; // by default around 90 days with 13.25s block time
    uint256 public totalStakes;

    struct StakeItem {
        uint256 amount;
        uint256 lockExpires;
        uint256 countRewardsFrom;
    }
    mapping(uint256 => mapping(address => StakeItem)) private stakes; // communityId -> user -> stake

    event Stake(uint256 communityId, address walletAddress, uint256 amount);
    event Withdraw(uint256 communityId, address walletAddress, uint256 amount);
    event RewardChanged(uint256 newRewardPerBlock);

    /// @notice Stake an ERC20 token, register it and mint AGO in return.
    function stake(
        uint256 _communityId,
        address _tokenAddress,
        uint256 _amount
    ) external {
        IAgoraToken(agoAddress()).mint(msg.sender, _amount);
        // Claim rewards in the community
        uint256[] memory communityArray = new uint256[](1);
        communityArray[0] = _communityId;
        claimReward(communityArray);
        // Register the stake details
        stakes[_communityId][msg.sender].amount += _amount;
        stakes[_communityId][msg.sender].lockExpires = block.number + lockInterval;
        totalStakes += _amount;
        // Get the input token last to be protected from reentrancy
        IERC20(_tokenAddress).transferFrom(msg.sender, address(this), _amount);
        emit Stake(_communityId, msg.sender, _amount);
    }

    /// @notice Withdraw a certain amount of staked tokens if the timelock expired. No AGO is burned in the process.
    function withdraw(
        uint256 _communityId,
        address _tokenAddress,
        uint256 _amount
    ) external {
        StakeItem storage stakeData = stakes[_communityId][msg.sender];
        // Test timelock
        require(stakeData.lockExpires < block.number, "Stake still locked");
        // Claim rewards in the community
        uint256[] memory communityArray = new uint256[](1);
        communityArray[0] = _communityId;
        claimReward(communityArray);
        // Modify tne stake details
        stakeData.amount -= _amount; // Will revert if the user tries to withdraw more than staked
        totalStakes -= _amount;
        // Send the staked token last to be protected from reentrancy
        IERC20(_tokenAddress).transfer(msg.sender, _amount);
        emit Withdraw(_communityId, msg.sender, _amount);
    }

    /// @notice Mint the reward for the sender based on a stake in an array of communities.
    /// @dev The rewards will be calculated from the current block in these communities.
    function claimReward(uint256[] memory _communityIds) public {
        uint256 userStakes;
        uint256 elapsedBlocks;
        for (uint256 i = 0; i < _communityIds.length; i++) {
            uint256 stakeInCommunity = stakes[_communityIds[i]][msg.sender].amount;
            if (stakeInCommunity > 0) {
                userStakes += stakeInCommunity;
                elapsedBlocks += block.number - stakes[_communityIds[i]][msg.sender].countRewardsFrom;
            }
            stakes[_communityIds[i]][msg.sender].countRewardsFrom = block.number;
        }
        if (userStakes > 0)
            IAgoraToken(agoAddress()).mint(msg.sender, (elapsedBlocks * rewardPerBlock * userStakes) / totalStakes);
    }

    /// @notice The amount of AGO to be minted per block as a reward.
    function changeRewardPerBlock(uint256 _rewardAmount) external onlyOwner {
        rewardPerBlock = _rewardAmount;
        emit RewardChanged(_rewardAmount);
    }

    /// @notice Lock the stakes for a specific number of blocks.
    function changeTimelockInterval(uint256 _blocks) external onlyOwner {
        lockInterval = _blocks;
    }

    /// @notice The address of the token minted for staking.
    /// @dev Change before deploying. Also, this contract has to be able to mint it.
    function agoAddress() public pure returns (address) {
        return 0x0000000000000000000000000000000000000000;
    }
}
