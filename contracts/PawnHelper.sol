pragma solidity ^0.4.15;


import "./rcn/interfaces/Token.sol";
import "./rcn/interfaces/Oracle.sol";
import "./interfaces/ERC721.sol";
import "./rcn/interfaces/Engine.sol";

import "./rcn/utils/BytesUtils.sol";
import "./rcn/utils/Ownable.sol";

import "./rcn/utils/Ownable.sol";

contract NanoLoanEngine is Engine {
    function createLoan(address _oracleContract, address _borrower, bytes32 _currency, uint256 _amount, uint256 _interestRate,
        uint256 _interestRatePunitory, uint256 _duesIn, uint256 _cancelableAt, uint256 _expirationRequest, string _metadata) public returns (uint256);
    function registerApprove(bytes32 identifier, uint8 v, bytes32 r, bytes32 s) public returns (bool);
    function getAmount(uint index) public view returns (uint256);
    function getIdentifier(uint index) public view returns (bytes32);
}

//function identifierToIndex(bytes32 signature) public view returns (uint256);

interface IPawnManager {
    function requestPawnId(Engine engine, uint256 loanId, Token[] _tokens, uint256[] _amounts, ERC721[] _erc721s, uint256[] _ids) external returns (uint256 pawnId, uint256 packageId);
}

contract PawnHelper is Ownable {
    IPawnManager pawnManager;
    NanoLoanEngine nanoLoanEngine;

    event NewPawn(address borrower, uint256 loanId, uint256 packageId, uint256 pawnId);

    constructor(NanoLoanEngine _nanoLoanEngine, IPawnManager _pawnManager) public {
        nanoLoanEngine = _nanoLoanEngine;
        pawnManager = _pawnManager;
    }

    function createLoan(Oracle _oracle, bytes32 _currency, uint256[6] memory params, string metadata) internal returns (uint256) {
        return nanoLoanEngine.createLoan(
            _oracle,
            msg.sender,
            _currency,
            params[0],
            params[1],
            params[2],
            params[3],
            params[4],
            params[5],
            metadata
        );
    }

    function requestPawn(
        Oracle _oracle,
        bytes32 _currency,
        uint256[6] memory loanParams,
        string metadata,
        uint8 v,
        bytes32 r,
        bytes32 s,
        //ERC20
        Token[] _tokens,
        uint256[] _amounts,
        //ERC721
        ERC721[] _erc721s,
        uint256[] _ids
    ) public returns (uint256 pawnId, uint256 packageId) {
        uint256 loanId = createLoan(_oracle, _currency, loanParams, metadata);
        require(nanoLoanEngine.registerApprove(nanoLoanEngine.getIdentifier(loanId), v, r, s));
        
        (pawnId, packageId) = pawnManager.requestPawnId(Engine(nanoLoanEngine), loanId, _tokens, _amounts, _erc721s, _ids);

        //emit NewPawn(msg.sender, loanId, packageId, pawnId);
    }
}
