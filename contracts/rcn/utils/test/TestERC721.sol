pragma solidity ^0.4.19;

import "./../../interfaces/ERC721.sol";
import './../RpSafeMath.sol';


contract TestERC721 is RpSafeMath, ERC721 {
    NFT[] public nfts;
    struct NFT{
        bytes32 name;
        uint nftId;
    }

    mapping (uint => uint) nftIdToIndex;

    mapping (uint => address) nftToOwner;
    mapping (uint => address) nftIdToApproved;
    mapping (address => uint) ownerNftCount;

    function totalSupply() public view returns (uint256){ return nfts.length; }
    function balanceOf(address _owner) public view returns (uint) { return ownerNftCount[_owner]; }
    function ownerOf(uint _nftId) public view returns (address) { return nftToOwner[_nftId]; }
    function name() public view returns (string){ return "test_erc721"; }
    function symbol() public view returns (string){ return "TEST"; }
    function getApproved(uint _nftId) public view returns (address) { return nftIdToApproved[_nftId]; }
    function tokenMetadata(uint256) public view returns (string) { return ""; }

    function setApprovalForAll(address, bool) public returns (bool) { return false; }
    function isApprovedForAll(address, address) public view returns (bool) { return false; }

    function getNftsByOwner(address _owner) external view returns(uint[]) {
        uint[] memory result = new uint[](ownerNftCount[_owner]);
        uint counter = 0;
        for (uint i = 0; i < nfts.length; i++) {
            if (nftToOwner[i] == _owner) {
                result[counter] = i;
                counter++;
            }
        }
        return result;
    }

    function addNtf(bytes32 _name, uint _nftId, address _owner) public {
        require(nftToOwner[_nftId] == 0x0);
        require(_owner != 0x0);

        nftIdToIndex[_nftId] = nfts.push(NFT(_name, _nftId)) - 1;
        ownerNftCount[_owner] = safeAdd(ownerNftCount[_owner], 1);
        nftToOwner[_nftId] = _owner;
    }

    function _transfer(address _from, address _to, uint _nftId) private returns(bool) {
        ownerNftCount[_from ] = safeSubtract(ownerNftCount[_from], 1);
        ownerNftCount[_to] = safeAdd(ownerNftCount[_to], 1);
        nftToOwner[_nftId] = _to;

        emit Transfer(msg.sender, _to, _nftId);

        return true;
    }

    function transfer(address _to, uint _nftId) public  returns(bool) {
        require(nftToOwner[_nftId] != 0x0);
        require(msg.sender == nftToOwner[_nftId]);
        require(msg.sender != _to);
        require(_to != address(0));

        _transfer(msg.sender, _to, _nftId);

        return true;
    }

    function approve(address _to, uint _nftId) public returns(bool) {
        require(msg.sender == nftToOwner[_nftId]);
        require(msg.sender != _to);

        nftIdToApproved[_nftId] = _to;

        emit Approval(msg.sender, _to, _nftId);

        return true;
    }

    function takeOwnership(uint _nftId) public returns(bool) {
        require(nftToOwner[_nftId] != 0x0);
        address oldOwner = nftToOwner[_nftId];

        require(nftIdToApproved[_nftId] == msg.sender);

        delete nftIdToApproved[_nftId];

        _transfer(oldOwner, msg.sender, _nftId);

        return true;
    }
}
