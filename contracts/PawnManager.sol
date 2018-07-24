pragma solidity ^0.4.15;


import "./rcn/interfaces/Cosigner.sol";
import "./rcn/interfaces/Engine.sol";
import "./rcn/interfaces/Token.sol";
import "./interfaces/ERC721.sol";

import "./rcn/utils/BytesUtils.sol";
import "./rcn/utils/Ownable.sol";

import "./ERC721Base.sol";

contract IBundle is ERC721Base {
    function create() public returns (uint256 id);
    function depositBatch(uint256 _packageId, ERC721[] tokens, uint256[] ids) external returns (bool);
    function depositTokenBatch(uint256 _packageId, ERC721 token, uint256[] ids) external returns (bool);
    function deposit(uint256 _packageId, ERC721 token, uint256 tokenId) external returns (bool);
}

contract IPoach is ERC721Base {
    function create(Token token, uint256 amount) public returns (uint256 id);
}

contract NanoLoanEngine is Engine {
    function createLoan(address _oracleContract, address _borrower, bytes32 _currency, uint256 _amount, uint256 _interestRate,
        uint256 _interestRatePunitory, uint256 _duesIn, uint256 _cancelableAt, uint256 _expirationRequest, string _metadata) public returns (uint256);
    function registerApprove(bytes32 identifier, uint8 v, bytes32 r, bytes32 s) public returns (bool);
    function getAmount(uint index) public view returns (uint256);
    function getIdentifier(uint index) public view returns (bytes32);
    function identifierToIndex(bytes32 signature) public view returns (uint256);
}

contract PawnManager is Cosigner, ERC721Base, BytesUtils, Ownable {
    NanoLoanEngine nanoLoanEngine;
    IBundle bundle;
    IPoach poach;

    event NewPawn(address borrower, uint256 loanId, uint256 packageId, uint256 pawnId);

    event RequestedPawn(uint256 _pawnId, address _borrower, address _engine, uint256 _loanId, uint256 _packageId);
    event StartedPawn(uint256 pawnId);
    event CanceledPawn(address _from, uint256 _pawnId);
    event PaidPawn(address _from, uint256 _pawnId);
    event DefaultedPawn(uint256 _pawnId);

    mapping(uint256 => uint256) pawnByPackageId;
    mapping(address => mapping(uint256 => uint256)) loanToLiability;

    Pawn[] pawns;
    struct Pawn {
        address owner;
        Engine engine;
        uint256 loanId;
        uint256 packageId;
        Status status;
    }

    enum Status { Pending, Ongoing, Canceled, Paid, Defaulted }

    constructor(NanoLoanEngine _nanoLoanEngine, IBundle _bundle, IPoach _poach) public {
        nanoLoanEngine = _nanoLoanEngine;
        bundle = _bundle;
        poach = _poach;
        pawns.length++;
    }
    // Getters
    function getLiability(Engine engine, uint256 loanId) view public returns(uint256) { return loanToLiability[engine][loanId]; }
    function getPawnId(uint256 packageId) view public returns(uint256) { return pawnByPackageId[packageId]; }
    // Pawns getters
    function getPawnOwner(uint256 pawnId) view public returns(address) { return pawns[pawnId].owner; }
    function getPawnEngine(uint256 pawnId) view public returns(address) { return pawns[pawnId].engine; }
    function getPawnLoanId(uint256 pawnId) view public returns(uint256) { return pawns[pawnId].loanId; }
    function getPawnPackageId(uint256 pawnId) view public returns(uint256) { return pawns[pawnId].packageId; }
    function getPawnStatus(uint256 pawnId) view public returns(Status) { return pawns[pawnId].status; }


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
        uint256[6] loanParams,
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

        (pawnId, packageId) = requestPawnId(nanoLoanEngine, loanId, _tokens, _amounts, _erc721s, _ids);

        emit NewPawn(msg.sender, loanId, packageId, pawnId);
    }

    function requestPawnWithLoanIdentifier(
        NanoLoanEngine engine,
        bytes32 loanIdentifier,
        Token[] _tokens,
        uint256[] _amounts,
        ERC721[] _erc721s,
        uint256[] _ids
    ) public returns (uint256 pawnId, uint256 packageId) {
        return requestPawnId(engine, engine.identifierToIndex(loanIdentifier), _tokens, _amounts, _erc721s, _ids);
    }

    /**
        @notice Request a pawn to buy a new loan
    */
    function requestPawnId(
        Engine engine,
        uint256 loanId,
        Token[] _tokens,
        uint256[] _amounts,
        ERC721[] _erc721s,
        uint256[] _ids
    ) public returns (uint256 pawnId, uint256 packageId) {
        // Validate the associated loan
        address borrower = engine.getBorrower(loanId);
        require(engine.getStatus(loanId) == Engine.Status.initial);
        require(msg.sender == borrower || msg.sender == engine.getCreator(loanId));
        require(engine.isApproved(loanId));
        require(loanToLiability[engine][loanId] == 0);

        packageId = createPackage(_tokens, _amounts, _erc721s, _ids);

        // Create the liability
        pawnId = pawns.push(Pawn({
            owner:     borrower,
            engine:    engine,
            loanId:    loanId,
            packageId: packageId,
            status:    Status.Pending
        })) - 1;

        loanToLiability[engine][loanId] = pawnId;

        emit RequestedPawn({
            _pawnId:    pawnId,
            _borrower:  borrower,
            _engine:    engine,
            _loanId:    loanId,
            _packageId: packageId
        });
    }

    function createPackage(
        //ERC20
        Token[] _tokens,
        uint256[] _amounts,
        //ERC721
        ERC721[] _erc721s,
        uint256[] _ids
    ) internal returns(uint256 packageId){
        uint256 tokensLength = _tokens.length;
        uint256 erc721sLength = _erc721s.length;
        require(tokensLength == _amounts.length && erc721sLength == _ids.length);

        packageId = bundle.create();
        uint256 i = 0;
        uint256 poachId;
        for(; i < tokensLength; i++){
            require(_tokens[i].transferFrom(msg.sender, this, _amounts[i]));
            require(_tokens[i].approve(poach, _amounts[i]));
            poachId = poach.create(_tokens[i], _amounts[i]);
            require(poach.approve(bundle, poachId));
            bundle.deposit(packageId, ERC721(poach), poachId);
        }

        for(i = 0; i < erc721sLength; i++){
            require(_erc721s[i].transferFrom(msg.sender, this, _ids[i]));
            require(_erc721s[i].approve(bundle, _ids[i]));
        }
        bundle.depositBatch(packageId, _erc721s, _ids);
    }
    /**
        @notice Cancels an existing pawn
        @dev The pawn status should be pending
        @param _pawnId Id of the pawn
        @return true If the operation was executed

    */
    function cancelPawn(uint256 _pawnId) external returns (bool) {
        Pawn storage pawn = pawns[_pawnId];

        // Only the owner of the pawn and if the pawn is pending
        require(msg.sender == pawn.owner, "Only the owner can cancel the pawn");
        require(pawn.status == Status.Pending, "The pawn is not pending");

        pawn.status = Status.Canceled;

        // Transfer the package back to the borrower
        bundle.safeTransferFrom(this, msg.sender, pawn.packageId);

        emit CanceledPawn(msg.sender, _pawnId);
        return true;
    }
    //
    // Implements cosigner
    //
    uint256 public constant I_PAWN_ID = 0;

    //this cosign dont have cost
    function cost(address , uint256 , bytes , bytes ) public view returns (uint256) {
        return 0;
    }

    function requestCosign(Engine _engine, uint256 _index, bytes _data, bytes ) public returns (bool) {
        require(msg.sender == address(_engine), "the sender its not the Engine");
        uint256 pawnId = uint256(readBytes32(_data, I_PAWN_ID));
        Pawn storage pawn = pawns[pawnId];

        // Validate that the loan matches with the pawn
        // and the pawn is still pending
        require(pawn.engine == _engine, "Engine does not match");
        require(pawn.loanId == _index, "Loan id does not match");
        require(pawn.status == Status.Pending, "Pawn is not pending");

        pawn.status = Status.Ongoing;

        // Mint pawn ERC721 Token
        _generate(pawnId, pawn.owner);

        // Cosign contract
        require(_engine.cosign(_index, 0), "Error performing cosign");

        // Save pawn id registry
        pawnByPackageId[pawn.packageId] = pawnId;

        // Emit pawn event
        emit StartedPawn(pawnId);

        return true;
    }

    function url() public view returns (string) {
        return "";
    }

    /**
        @notice Defines a custom logic that determines if a loan is defaulted or not.

        @param _engine RCN Engines
        @param _index Index of the loan

        @return true if the loan is considered defaulted
    */
    function isDefaulted(Engine _engine, uint256 _index) public view returns (bool) {
        return _engine.getStatus(_index) == Engine.Status.lent && _engine.getDueTime(_index) <= now;
    }

    function claim(address _engine, uint256 _loanId, bytes ) public returns (bool) {
        uint256 pawnId = loanToLiability[_engine][_loanId];
        Pawn storage pawn = pawns[pawnId];
        // Validate that the pawn wasn't claimed
        require(pawn.status == Status.Ongoing, "Pawn not ongoing");
        require(pawn.loanId == _loanId, "Pawn don't match loan id");

        if (pawn.engine.getStatus(_loanId) == Engine.Status.paid || pawn.engine.getStatus(_loanId) == Engine.Status.destroyed) {
            // The pawn is paid
            require(_isAuthorized(msg.sender, pawnId), "Sender not authorized");

            pawn.status = Status.Paid;
            // Transfer the package to the borrower
            bundle.safeTransferFrom(this, msg.sender, pawn.packageId);
            emit PaidPawn(msg.sender, pawnId);
        } else {
            if (isDefaulted(pawn.engine, _loanId)) {
                // The pawn is defaulted
                require(msg.sender == pawn.engine.ownerOf(_loanId), "Sender not lender");

                pawn.status = Status.Defaulted;
                // Transfer the package to the lender
                bundle.safeTransferFrom(this, msg.sender, pawn.packageId);
                emit DefaultedPawn(pawnId);
            } else {
                revert("Pawn not defaulted/paid");
            }
        }

        // ERC721 Delete asset
        _destroy(pawnId);

        // Delete pawn id registry
        delete pawnByPackageId[pawn.packageId];

        return true;
    }
}
