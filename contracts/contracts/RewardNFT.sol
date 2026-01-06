// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RewardNFT is ERC721, Ownable {
    uint256 private _nextTokenId;

    constructor() ERC721("MonkeyHand Victory Badge", "MHVB") Ownable(msg.sender) {}

    function mintReward(address player) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(player, tokenId);

        return tokenId;
    }

    // Optional: Set base URI for metadata if needed later
    function _baseURI() internal pure override returns (string memory) {
        return "https://monkeyhand.vercel.app/api/nft/metadata/";
    }
}
