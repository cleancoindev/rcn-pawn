pragma solidity ^0.4.15;

import "./rcn/interfaces/Engine.sol";
import "./rcn/interfaces/Token.sol";
import "./rcn/interfaces/ERC721.sol";
import "./rcn/utils/BytesUtils.sol";
import "./rcn/utils/Ownable.sol";

contract Pawn is ERC721, BytesUtils, Ownable {
    Engine engine;

    mapping (uint => address) pawnToOwner;
    mapping (uint => address) pawnToApproved;

    mapping (uint => PawnToken) loanIdToPawn;
    struct PawnToken {
        ERC20Data[]  erc20Datas;  // loan index to array of ERC20Data struct
        ERC721Data[] erc721Datas; // loan index to array of ERC721Data struct
    }

    struct ERC20Data {
        Token addr; // address of ERC20 contract
        uint amount;
    }
    struct ERC721Data {
        ERC721 addr; // address of ERC721 contract
        uint[] nfts; // array of non fungible
    }

    function getERC20Pawn(uint _loanId) public view returns(address[] memory addrs, uint[] memory amounts){
        ERC20Data[] storage erc20Data = loanIdToPawn[_loanId].erc20Datas;
        uint length = erc20Data.length;
        addrs = new address[](length);
        amounts = new uint[](length);

        for(uint i; i < length; i++){
            addrs[i] = erc20Data[i].addr;
            amounts[i] = erc20Data[i].amount;
        }
    }

    function getERC721AddrPawn(uint _loanId) public view returns(address[] addrs){
        ERC721Data[] storage erc721Data = loanIdToPawn[_loanId].erc721Datas;
        addrs = new address[](erc721Data.length);

        for(uint i; i < erc721Data.length; i++){
            addrs[i] = (erc721Data[i].addr);
        }
    }

    function getERC721NftsPawn(uint _loanId, address _addr) public view returns(uint[] nfts){
        ERC721Data[] storage erc721Data = loanIdToPawn[_loanId].erc721Datas;
        nfts = new uint[](erc721Data.length);

        for(uint i; i < erc721Data.length; i++){
            if(erc721Data[i].addr == _addr)
                return erc721Data[i].nfts;
        }
    }

    constructor(Engine _engine) public {
        engine = _engine;
    }

    modifier onlyBorrower(uint _loanId) {
        require(engine.getBorrower(_loanId) == msg.sender);
        _;
    }

    function deletePawn(uint _loanId) public onlyBorrower(_loanId) {
        delete loanIdToPawn[_loanId];
    }

    function addERC20ToPawnToken(uint _loanId, Token _erc20, uint _amount) public onlyBorrower(_loanId) {
        if(pawnToOwner[_loanId] == 0)
            pawnToOwner[_loanId] = msg.sender;
        loanIdToPawn[_loanId].erc20Datas.push(ERC20Data(_erc20, _amount));
    }

    function addERC721ToPawnToken(uint _loanId, ERC721 _erc721, uint[] _nfts) public onlyBorrower(_loanId) {
        if(pawnToOwner[_loanId] == 0)
            pawnToOwner[_loanId] = msg.sender;
        loanIdToPawn[_loanId].erc721Datas.push(ERC721Data(_erc721, _nfts));
    }

    function ownerOf(uint _loanId) public view returns (address) { return pawnToOwner[_loanId]; }

    function approve(address _to, uint _loanId) public returns(bool) {
        require(msg.sender == pawnToOwner[_loanId]);
        require(msg.sender != _to);

        pawnToApproved[_loanId] = _to;

        emit Approval(msg.sender, _to, _loanId);

        return true;
    }

    function takeOwnership(uint _loanId) public returns(bool) {
        require(pawnToOwner[_loanId] != 0x0);
        address oldOwner = pawnToOwner[_loanId];

        require(pawnToApproved[_loanId] == msg.sender);
        delete pawnToApproved[_loanId];

        _takeAll(oldOwner, address(this), _loanId);
        pawnToOwner[_loanId] = msg.sender;

        return true;
    }

    function _takeAll(address _from, address _to, uint _loanId) private returns(bool) {
        PawnToken storage pawn = loanIdToPawn[_loanId];
        ERC20Data[] storage erc20Datas = pawn.erc20Datas;

        uint i;
        for(i = 0; i < erc20Datas.length; i++){
            require(erc20Datas[i].addr.transferFrom(_from, _to, erc20Datas[i].amount));
        }

        ERC721Data[] storage erc721Datas = pawn.erc721Datas;
        ERC721 addr;

        for(i = 0; i < erc721Datas.length; i++){
            addr = erc721Datas[i].addr;
            uint[] storage nfts = erc721Datas[i].nfts;
            for(uint j = 0; j < nfts.length; j++){
                require(addr.takeOwnership(nfts[j]));
            }
        }

        return true;
    }

    function checkLoanStatus(address _to, uint256 _loanId) private view returns (bool) {
      return (engine.getBorrower(_loanId) == _to && engine.getStatus(_loanId) == Engine.Status.paid) ||
        (engine.ownerOf(_loanId) == _to && engine.getStatus(_loanId) == Engine.Status.lent && engine.getDueTime(_loanId) <= now);
    }

    function _transferAll(address _to, uint _loanId) private returns(bool) {
        PawnToken storage pawn = loanIdToPawn[_loanId];
        ERC20Data[] storage erc20Datas = pawn.erc20Datas;

        uint i;
        for(i = 0; i < erc20Datas.length; i++){
            require(erc20Datas[i].addr.transfer(_to, erc20Datas[i].amount));
        }

        ERC721Data[] storage erc721Datas = pawn.erc721Datas;
        ERC721 addr;

        for(i = 0; i < erc721Datas.length; i++){
            addr = erc721Datas[i].addr;
            uint[] storage nfts = erc721Datas[i].nfts;
            for(uint j = 0; j < nfts.length; j++){
                require(addr.transfer(_to, nfts[j]));
            }
        }

        return true;
    }

    function transfer(address _to, uint _loanId) public returns(bool) {
        require(pawnToOwner[_loanId] != 0x0);//TODO es necesario????
        require(msg.sender == pawnToOwner[_loanId]);
        require(checkLoanStatus(_to, _loanId));
        require(msg.sender != _to);
        require(_to != address(0));

        _transferAll(_to, _loanId);
        pawnToOwner[_loanId] = _to;

        emit Transfer(msg.sender, _to, _loanId);

        return true;
    }

    function name() public view returns (string){ return "test_erc721"; }
    function symbol() public view returns (string){ return "TEST"; }
    function totalSupply() public view returns (uint256){ return 0; }
    function balanceOf(address ) public view returns (uint) { return 0; }
    function setApprovalForAll(address , bool ) public returns (bool){ return false; }
    function getApproved(uint _loanId) public view returns (address) { return pawnToApproved[_loanId]; }
    function isApprovedForAll(address , address ) public view returns (bool){ return false; }
    // Token metadata
    function tokenMetadata(uint256 ) public view returns (string info){ return ""; }
}
