pragma solidity ^0.4.24;


import "./interfaces/Token.sol";

import "./ERC721Base.sol";
import "./rcn/utils/RpSafeMath.sol";

contract Poach is ERC721Base, RpSafeMath {
    struct Pair {
        Token token;
        uint256 amount;
        bool alive;
    }

    Pair[] public poaches;

    constructor() public {
        poaches.length++;
    }

    modifier alive(uint256 id) {
      require(poaches[id].alive, "the pair its not alive");
      _;
    }

    function getPair(uint poachId) view public returns(address, uint, bool) {
        Pair storage poach = poaches[poachId];
        return (poach.token, poach.amount, poach.alive);
    }

    function create(
        Token token,
        uint256 amount
    ) public returns (uint256 id) {
        require(token.transferFrom(msg.sender, this, amount));
        id = poaches.length;
        poaches.push(Pair(token, amount, true));
        _generate(id, msg.sender);
    }

    function deposit(
        uint256 id,
        uint256 amount
    ) public alive(id) returns (bool) {
        Pair storage pair = poaches[id];
        require(pair.token.transferFrom(msg.sender, this, amount));
        pair.amount = safeAdd(pair.amount, amount);
        return true;
    }

    function destroy(uint256 id) public onlyAuthorized(id) alive(id) returns (bool) {
        Pair storage pair = poaches[id];
        require(pair.token.transfer(msg.sender, pair.amount));
        pair.alive = false;
        return true;
    }
}
