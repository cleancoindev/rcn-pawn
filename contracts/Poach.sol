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

    event Created(address owner, uint256 pairId, address erc20, uint256 amount);
    event Deposit(address sender, uint256 pairId, uint256 amount);
    event Destroy(address retriever, uint256 pairId, uint256 amount);

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
        emit Created(msg.sender, id, token, amount);
        _generate(id, msg.sender);
    }

    function deposit(
        uint256 id,
        uint256 amount
    ) public alive(id) returns (bool) {
        Pair storage pair = poaches[id];
        require(pair.token.transferFrom(msg.sender, this, amount));
        pair.amount = safeAdd(pair.amount, amount);

        emit Deposit(msg.sender, id, amount);

        return true;
    }

    function destroy(uint256 id) public onlyAuthorized(id) alive(id) returns (bool) {
        Pair storage pair = poaches[id];
        require(pair.token.transfer(msg.sender, pair.amount));
        pair.alive = false;

        emit Destroy(msg.sender, id, pair.amount);

        return true;
    }
}
