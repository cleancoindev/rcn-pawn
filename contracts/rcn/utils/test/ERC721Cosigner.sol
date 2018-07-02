pragma solidity ^0.4.15;

import "./../../interfaces/Cosigner.sol";
import "./../../utils/BytesUtils.sol";
import "./../../interfaces/Engine.sol";
import "./../../interfaces/Token.sol";
import "./../../interfaces/ERC721.sol";
import "./../../utils/Ownable.sol";

contract ERC721Cosigner is Cosigner, BytesUtils, Ownable {
    mapping(uint => ERC721Data) loanIdToERC721Data;
    struct ERC721Data {
        ERC721 addr; // address of ERC721 contract
        uint nft; // non fungible id
    }

    uint private constant INDEX_ERC721_ADDR = 0;
    uint private constant INDEX_NFT = 1;

    function cost(address , uint256 , bytes , bytes ) public view returns (uint256) {
        return 0;
    }

    function requestCosign(Engine _engine, uint256 _index, bytes _data, bytes ) public returns (bool) {
        require(msg.sender == address(_engine));

        ERC721 erc721 = ERC721(address(readBytes32(_data, INDEX_ERC721_ADDR)));
        uint nft = uint(readBytes32(_data, INDEX_NFT));
        require(erc721.takeOwnership(nft));
        loanIdToERC721Data[_index] = ERC721Data(erc721, nft);

        require(_engine.cosign(_index, 0), "fail cosing");

        return true;
    }

    function url() public view returns (string) {
        return "";
    }

    /**
        @dev Defines a custom logic that determines if a loan is defaulted or not.

        @param _index Index of the loan

        @return true if the loan is considered defaulted
    */
    function isDefaulted(Engine _engine, uint256 _index) public view returns (bool) {
        return _engine.getStatus(_index) == Engine.Status.lent && _engine.getDueTime(_index) <= now;
    }

    function claim(address _engineAddress, uint256 _index, bytes ) public returns (bool) {
      Engine engine = Engine(_engineAddress);
      ERC721Data storage erc721Data = loanIdToERC721Data[_index];

      address lender = engine.ownerOf(_index);
      if(msg.sender == lender) {
          require(isDefaulted(engine, _index));
          erc721Data.addr.transfer(lender, erc721Data.nft);
          return true;
      } else {
          address borrower = engine.getBorrower(_index);
          if(msg.sender == borrower){
              require(engine.getStatus(_index) == Engine.Status.paid);
              erc721Data.addr.transfer(borrower, erc721Data.nft);
              return true;
          } else {
              revert();
          }
      }
    }
}
