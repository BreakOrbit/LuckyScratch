// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILuckyScratchTicket {
    function core() external view returns (address);

    function setCore(address newCore) external;

    function mintTicket(address to, uint256 tokenId) external;

    function setTransferLocked(uint256 tokenId, bool locked) external;

    function isTransferLocked(uint256 tokenId) external view returns (bool);

    function ownerOf(uint256 tokenId) external view returns (address);
}
