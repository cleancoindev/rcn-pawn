pragma solidity ^0.4.24;

interface Token {
    function transfer(address to, uint256 id) external returns (bool);
    function transferFrom(address from, address to, uint256 id) external returns (bool);

}