// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleCounter {
    uint256 public count;

    event Incremented(uint256 newCount, address indexed sender);

    function increment() public {
        count += 1;
        emit Incremented(count, msg.sender);
    }

    function getCount() public view returns (uint256) {
        return count;
    }
}
