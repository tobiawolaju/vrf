// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract RewardNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    constructor() ERC721("MonkeyHand Victory Badge", "MHVB") Ownable(msg.sender) {}

    function mintReward(address player) public returns (uint256) {
        _tokenIds.increment();

        uint256 newItemId = _tokenIds.current();
        _mint(player, newItemId);

        return newItemId;
    }

    // Optional: Set base URI for metadata if needed later
    function _baseURI() internal pure override returns (string memory) {
        return "https://monkeyhand.vercel.app/api/nft/metadata/";
    }
}
