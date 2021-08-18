// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./AgoraSpace.sol";
import "./token/AgoraToken.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title A contract that deploys Agora Space contracts for any community
contract AgoraSpaceFactory is Ownable {
    /// @notice EOA => token => approved to deploy?
    mapping(address => mapping(address => bool)) public approvedAddresses;

    /// @notice Token => deployed Space
    mapping(address => address) public spaces;

    event SpaceCreated(address token, address space, address agoraToken);
    event AddressApproved(address indexed account, address token, bool approvalState);

    error Unauthorized();
    error AlreadyExists();
    error ZeroAddress();

    /// @notice Deploys a new Agora Space contract with it's token and registers it in the spaces mapping
    /// @param _token The address of the community's token (that will be deposited to Space)
    function createSpace(address _token) external {
        if (!approvedAddresses[msg.sender][_token]) revert Unauthorized();
        if (spaces[_token] != address(0)) revert AlreadyExists();
        string memory tokenSymbol = IERC20Metadata(_token).symbol();
        uint8 tokenDecimals = IERC20Metadata(_token).decimals();
        AgoraToken agoraToken = new AgoraToken(
            string(abi.encodePacked("Agora.space ", tokenSymbol, " Token")),
            "AGT",
            tokenDecimals
        );
        AgoraSpace agoraSpace = new AgoraSpace(_token, address(agoraToken));
        spaces[_token] = address(agoraSpace);
        agoraToken.transferOwnership(address(agoraSpace));
        agoraSpace.transferOwnership(msg.sender);
        emit SpaceCreated(_token, address(agoraSpace), address(agoraToken));
    }

    /// @notice Sets the approval state of an address
    /// @param _tokenOwner The owner of the token authorized on agora.space
    /// @param _tokenAddress The address of the token whose owner is being approved
    /// @param _approvalState Whether to approve or disapprove
    function setApproval(
        address _tokenOwner,
        address _tokenAddress,
        bool _approvalState
    ) external onlyOwner {
        if ((_tokenOwner == address(0)) || (_tokenAddress == address(0))) revert ZeroAddress();
        approvedAddresses[_tokenOwner][_tokenAddress] = _approvalState;
        emit AddressApproved(_tokenOwner, _tokenAddress, _approvalState);
    }
}
