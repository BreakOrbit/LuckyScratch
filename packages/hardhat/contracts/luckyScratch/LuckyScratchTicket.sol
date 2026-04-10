// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ILuckyScratchCore } from "./interfaces/ILuckyScratchCore.sol";
import { ILuckyScratchTicket } from "./interfaces/ILuckyScratchTicket.sol";

contract LuckyScratchTicket is ERC721, Ownable, ILuckyScratchTicket {
    error OnlyCore();
    error TransferLocked(uint256 tokenId);
    error ZeroAddress();

    address public override core;

    mapping(uint256 tokenId => bool locked) private transferLocks;

    constructor(address initialOwner) ERC721("LuckyScratch Ticket", "LSCRT") Ownable(initialOwner) {}

    modifier onlyCore() {
        if (msg.sender != core) revert OnlyCore();
        _;
    }

    function setCore(address newCore) external override onlyOwner {
        if (newCore == address(0)) revert ZeroAddress();
        core = newCore;
    }

    function mintTicket(address to, uint256 tokenId) external override onlyCore {
        _safeMint(to, tokenId);
    }

    function setTransferLocked(uint256 tokenId, bool locked) external override onlyCore {
        transferLocks[tokenId] = locked;
    }

    function isTransferLocked(uint256 tokenId) external view override returns (bool) {
        return transferLocks[tokenId];
    }

    function ownerOf(uint256 tokenId) public view override(ERC721, ILuckyScratchTicket) returns (address) {
        return super.ownerOf(tokenId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != address(0) && transferLocks[tokenId]) {
            revert TransferLocked(tokenId);
        }

        address previousOwner = super._update(to, tokenId, auth);

        if (from != address(0) && to != address(0) && core != address(0)) {
            ILuckyScratchCore(core).onTicketTransfer(tokenId, from, to);
        }

        return previousOwner;
    }
}
