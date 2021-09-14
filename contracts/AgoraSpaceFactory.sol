// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./AgoraSpace.sol";
import "./token/AgoraToken.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title A contract that deploys Agora Space contracts for any community
contract AgoraSpaceFactory is Ownable {
    /// @notice Token => deployed Space
    mapping(address => address) public spaces;

    event SpaceCreated(address token, address space, address agoraToken);

    error Unauthorized();
    error AlreadyExists();
    error InvalidSignature();

    /// @notice Deploys a new Agora Space contract with it's token and registers it in the spaces mapping
    /// @param _signature A signed message from the owner containing their, the token's and this contract's address
    /// @param _token The address of the community's token (that will be deposited to Space)
    function createSpace(bytes memory _signature, address _token) external {
        if (spaces[_token] != address(0)) revert AlreadyExists();
        bytes32 message = prefixed(keccak256(abi.encode(msg.sender, _token, address(this)))); // Recreate the signed message
        if (recoverSigner(message, _signature) != owner()) revert Unauthorized();
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

    /// @notice Builds a prefixed hash to mimic the behavior of eth_sign
    /// @param _hash The hash of the message's content without the prefix
    /// @return The hash with the prefix
    function prefixed(bytes32 _hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash));
    }

    /// @notice Recovers the address of the signer of the message
    /// @param _message The prefixed hashed message that we recreated
    /// @param _sig The signed message that we need to check
    /// @return The address of the signer
    function recoverSigner(bytes32 _message, bytes memory _sig) internal pure returns (address) {
        if (_sig.length != 65) revert InvalidSignature();
        uint8 v;
        bytes32 r;
        bytes32 s;
        assembly {
            // First 32 bytes, after the length prefix
            r := mload(add(_sig, 32))
            // Second 32 bytes
            s := mload(add(_sig, 64))
            // Final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(_sig, 96)))
        }
        return ecrecover(_message, v, r, s);
    }
}
