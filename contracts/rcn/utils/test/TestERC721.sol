pragma solidity ^0.4.19;

// import "./../../../interfaces/ERC721.sol";
// import './../RpSafeMath.sol';
import "./../../../ERC721Base.sol";

contract TestERC721 is ERC721Base {
    mapping(uint256 => bytes32) public nameOf;
    function addNtf(bytes32 _name, uint _nftId, address _owner) public {
        require(_owner != 0x0);

        _generate(_nftId, _owner);
        nameOf[_nftId] = _name;
    }
}
