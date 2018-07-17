pragma solidity ^0.4.24;


import "./interface/Engine.sol";
import "./Bundle.sol";
import "./Poach.sol";

contract NanoLoanEngine is Engine {
    function createLoan(address _oracleContract, address _borrower, bytes32 _currency, uint256 _amount, uint256 _interestRate,
        uint256 _interestRatePunitory, uint256 _duesIn, uint256 _cancelableAt, uint256 _expirationRequest, string _metadata) public returns (uint256);
    function registerApprove(bytes32 identifier, uint8 v, bytes32 r, bytes32 s) public returns (bool);
    function getAmount(uint index) public view returns (uint256);
    function getIdentifier(uint index) public view returns (bytes32);
}

contract BundleFactory {
    NanoLoanEngine engine;
    Bundle bundle;
    Poach poach;
    ERC721Cosigner erc721Cosigner;

    constructor(NanoLoanEngine _engine, Bundle _bundle, Poach _poach, ERC721Cosigner _erc721Cosigner){
        engine = _engine;
        bundle = _bundle;
        poach = _poach;
        erc721Cosigner = _erc721Cosigner;
    }

    function requestPawn(
        uint256[6] memory loanParams,
        string metadata,
        //ERC20
        Token[] _tokens,
        uint256[] _amounts,
        //ERC721
        ERC721[] _erc721s,
        uint256[] _ids
    ) public returns (uint256) {
        uint256 loanId = createLoan(loanParams, metadata);

        return bundleContructor(_tokens, _amounts, _erc721s, _ids);
    }

    function createLoan(uint256[6] memory params, string metadata) internal returns (uint256) {
        return nanoLoanEngine.createLoan(
            manaOracle,
            msg.sender,
            MANA_CURRENCY,
            params[0],
            params[1],
            params[2],
            params[3],
            params[4],
            params[5],
            metadata
        );
    }

    function bundleContructor(
        //ERC20
        Token[] _tokens,
        uint256[] _amounts,
        //ERC721
        ERC721[] _erc721s,
        uint256[] _ids
    ) internal returns(uint256 packageId){
        uint256 tokensLength = _tokens.length;
        require(tokensLength == _amounts.length);

        uint256 packageId = _bundle.create();
        uint256[] poaches;
        for(uint256 i = 0; i < tokensLength; i++)
            poaches.push(_poach.create(_tokens[i], _amounts[i]));

        _erc721s.push(_poach);
        _ids.push(poaches);
        _bundle.depositBatch(packageId, _erc721s, _ids);

        _bundle.approve(erc721Cosigner, packageId);
        _bundle.transferFrom(address(this), msg.sender, packageId);
    }
}
