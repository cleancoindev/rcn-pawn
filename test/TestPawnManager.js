let NanoLoanEngine = artifacts.require("./rcn/NanoLoanEngine.sol");

let Bundle = artifacts.require("./Bundle.sol");
let Poach = artifacts.require("./Poach.sol");
let PawnManager = artifacts.require("./PawnManager.sol");

let TestToken = artifacts.require("./rcn/utils/test/TestToken.sol");
let TestERC721 = artifacts.require("./rcn/utils/test/TestERC721.sol");

//global variables
//////////////////
const Helper = require("./helper.js");
const BigNumber = require('bignumber.js');
const precision = new BigNumber(10**18);
let Status = Object.freeze({"Pending":0, "Ongoing":1, "Canceled":2, "Paid":3, "Defaulted":4});

// Contracts
let bundle;
let poach;
let rcnEngine;
let pawnManager;
// ERC20 contacts
let rcn;
let pepeCoin;
// ERC721 contacts
let pokemons;
let zombies;
let magicCards;
// ERC721 ids
// pokemons
let ratata  = 19;
let pikachu  = 25;
let clefairy = 35;
let vulpix   = 37;
let mewtwo   = 150;
// zombies
let michaelJackson = 9953121564;
let theFirst = 0;
// magic cards
let blackDragon = 56153153;
let ent = 12312313;
let orc = 6516551;

// Accounts
let borrower;
let borrowerHelper;
let lender;
let otherUser;

// common variables
const loanDuration = 6 * 30 * 24 * 60 * 60;
const closeTime = 24 * 60 * 60;
const expirationRequest = Helper.now() + (30 * 24 * 60 * 60);// now plus a month

const loanParams = [
    web3.toWei(199),                         // Amount requested
    Helper.toInterestRate(20, loanDuration), // Anual interest
    Helper.toInterestRate(30, loanDuration), // Anual punnitory interest
    loanDuration,                            // Duration of the loan, in seconds
    closeTime,                               // Time when the payment of the loan starts
    expirationRequest                        // Expiration timestamp of the request
];

const loanMetadata = "#pawn";

let tokens;
let amounts;
let erc721s;
let ids;
let customLoanId;
let customPawnId;

contract('TestPawnManager', function(accounts) {
    async function assertThrow(promise) {
      try {
        await promise;
      } catch (error) {
        const invalidJump = error.message.search('invalid JUMP') >= 0;
        const revert = error.message.search('revert') >= 0;
        const invalidOpcode = error.message.search('invalid opcode') >0;
        const outOfGas = error.message.search('out of gas') >= 0;
        assert(
          invalidJump || outOfGas || revert || invalidOpcode,
          "Expected throw, got '" + error + "' instead",
        );
        return;
      }
      assert.fail('Expected throw not received');
    };

    before("Assign accounts", async function() {
        // set account addresses
        borrower  = accounts[1];
        borrowerHelper = accounts[2]
        lender  = accounts[3];
        otherUser  = accounts[4];
    });

    beforeEach("Create Bundle, ERC20, ERC721 contracts", async function(){
        // deploy contracts
        // ERC20
        rcn = await TestToken.new();
        await rcn.createTokens(lender, web3.toWei(99999999));
        await rcn.createTokens(borrowerHelper, web3.toWei(99999999));
        pepeCoin = await TestToken.new();
        await pepeCoin.createTokens(borrower, web3.toWei(15));
        // ERC721
        pokemons = await TestERC721.new();
        await pokemons.addNtf("ratata"  , ratata  , lender);
        await pokemons.addNtf("pikachu" , pikachu , borrower);
        await pokemons.addNtf("clefairy", clefairy, borrower);
        await pokemons.addNtf("vulpix"  , vulpix  , borrower);
        await pokemons.addNtf("mewtwo"  , mewtwo  , borrower);
        zombies = await TestERC721.new();
        await zombies.addNtf("michaelJackson", michaelJackson , borrower);
        await zombies.addNtf("theFirst"      , theFirst       , borrower);
        magicCards = await TestERC721.new();
        await magicCards.addNtf("blackDragon", blackDragon, borrower);
        await magicCards.addNtf("ent"        , ent        , borrower);
        await magicCards.addNtf("orc"        , orc        , borrower);

        bundle = await Bundle.new();
        poach = await Poach.new();
        rcnEngine = await NanoLoanEngine.new(rcn.address);
        pawnManager = await PawnManager.new(rcnEngine.address, bundle.address, poach.address);
        //
        //create custom loan with a pawn
        //
        tokens  = [pepeCoin.address];
        amounts = [web3.toWei(1)];
        erc721s = [pokemons.address];
        ids     = [pikachu];
        // approves
        await pepeCoin.approve(pawnManager.address, amounts[0], {from:borrower});
        await pokemons.approve(pawnManager.address, ids[0], {from:borrower});
        // Retrieve the loan signature
        const loanIdentifier = await rcnEngine.buildIdentifier(
            0x0,                  // Contract of the oracle
            borrower,             // Borrower of the loan (caller of this method)
            pawnManager.address,  // Creator of the loan, the pawn creator
            0x0,                  // Currency of the loan, RCN
            loanParams[0],        // Request amount
            loanParams[1],        // Interest rate, 20% anual
            loanParams[2],        // Punnitory interest rate, 30% anual
            loanParams[3],        // Duration of the loan, 6 months
            loanParams[4],        // Borrower can pay the loan at 5 months
            loanParams[5],        // Pawn request expires in 1 month
            loanMetadata          // Metadata
        )
        // Sign the loan
        const approveSignature = await web3.eth.sign(borrower, loanIdentifier).slice(2);
        const r = `0x${approveSignature.slice(0, 64)}`;
        const s = `0x${approveSignature.slice(64, 128)}`;
        const v = web3.toDecimal(approveSignature.slice(128, 130)) + 27;
        // Request a Pawn
        const pawnReceipt = await pawnManager.requestPawn(
            0x0,
            0x0,
            loanParams,   // Configuration of the loan request
            loanMetadata, // Metadata of the loan
            v,            // Signature of the loan
            r,            // Signature of the loan
            s,            // Signature of the loan
            //ERC20
            tokens,       // Array of ERC20 addresses
            amounts,      // Array of ERC20 amounts
            //ERC721
            erc721s,      // Array of ERC721 addresses
            ids,          // Array of ERC721 ids
            {from: borrower}
        );
        customLoanId = pawnReceipt["logs"][pawnReceipt["logs"].length - 1]["args"]["loanId"];
        customPawnId = pawnReceipt["logs"][pawnReceipt["logs"].length - 1]["args"]["pawnId"];
    });

    it("test: create a pawn and cancel", async() => {
        let packageId = await pawnManager.getPawnPackageId(customPawnId);
        let pawnPackage = await bundle.content(packageId);
        let poachId = pawnPackage[1][0];

        assert.equal(await poach.ownerOf(poachId), bundle.address);
        assert.equal(await bundle.ownerOf(packageId), pawnManager.address);
        assert.equal((await pawnManager.getLiability(rcnEngine.address, customLoanId)).toNumber(), customPawnId.toNumber());
        assert.equal(await pawnManager.ownerOf(customPawnId), 0x0);
        assert.equal(await pawnManager.getPawnOwner(customPawnId), borrower);
        assert.equal(await pawnManager.getPawnEngine(customPawnId), rcnEngine.address);
        assert.equal((await pawnManager.getPawnLoanId(customPawnId)).toNumber(), customLoanId);
        assert.equal((await pawnManager.getPawnPackageId(customPawnId)).toNumber(), customPawnId);
        assert.equal((await pawnManager.getPawnStatus(customPawnId)).toNumber(), Status.Pending);

        assert.equal(pawnPackage[0][0], poach.address);
        let pair = await poach.getPair(poachId);
        assert.equal(pair[0], tokens[0]);
        assert.equal(pair[1], amounts[0]);
        assert.equal(pair[2], true);

        assert.equal(pawnPackage[0][1], pokemons.address);
        assert.equal(pawnPackage[1][1], ids[0]);

        try { // Try to claim a pawn without being borrowed from lender
            await pawnManager.claim(rcnEngine.address, customLoanId, "", {from: lender});
            assert(false, "throw was expected in line above.")
        } catch(e){
            assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }
        try { // Try to claim a pawn without being borrowed from borrower
            await pawnManager.claim(rcnEngine.address, customLoanId, "", {from: borrower});
            assert(false, "throw was expected in line above.")
        } catch(e){
            assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        try { // Try to cancel a pawn without be the owner
            await pawnManager.cancelPawn(customPawnId, {from: lender});
            assert(false, "throw was expected in line above.")
        } catch(e){
            assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        const cancelPawnReceipt = await pawnManager.cancelPawn(customPawnId, {from: borrower});
        let pawnId = cancelPawnReceipt["logs"][cancelPawnReceipt["logs"].length - 1]["args"]["pawnId"];

        assert.equal((await pawnManager.getPawnStatus(pawnId)).toNumber(), Status.Canceled);

        assert.equal(await bundle.ownerOf(packageId), borrower);

        pawnPackage = await bundle.content(packageId);
        assert.equal(pawnPackage[0][0], poach.address);
        assert.equal(pawnPackage[0][1], pokemons.address);
        assert.equal(pawnPackage[1][1], ids[0]);

        await bundle.withdrawAll(packageId, borrower, {from: borrower});

        let prevBal = await pepeCoin.balanceOf(borrower);
        await poach.destroy(pawnPackage[1][0], {from: borrower});
        pair = await poach.getPair(pawnPackage[1][0]);
        assert.equal(pair[2], false);
        let bal = await pepeCoin.balanceOf(borrower);
        assert.equal(bal.toString(), prevBal.plus(amounts[0]).toString());

        assert.equal(await pokemons.ownerOf(pikachu), borrower);
    });

    it("test: lend a loan with a pawn as cosigner, pay and claim (as borrower)", async() => {
        let packageId = await pawnManager.getPawnPackageId(customPawnId);
        rcn.approve(rcnEngine.address, loanParams[0], {from:lender});

        await rcnEngine.lend(customLoanId, [], pawnManager.address, Helper.toBytes32(customPawnId), {from:lender});

        assert.equal(await bundle.ownerOf(packageId), pawnManager.address);
        assert.equal(await pawnManager.ownerOf(customPawnId), borrower);
        assert.equal(await pawnManager.getPawnOwner(customPawnId), borrower);
        assert.equal(await pawnManager.getPawnEngine(customPawnId), rcnEngine.address);
        assert.equal((await pawnManager.getPawnLoanId(customPawnId)).toNumber(), customLoanId);
        assert.equal((await pawnManager.getPawnPackageId(customPawnId)).toNumber(), customPawnId);
        assert.equal((await pawnManager.getPawnStatus(customPawnId)).toNumber(), Status.Ongoing);

        try { // try a withdraw all tokens of a ongoing pawn
            await bundle.withdrawAll(packageId, otherUser, {from: otherUser});
            assert(false, "throw was expected in line above.")
        } catch(e){
            assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        try { // try borrower claim pawn with ongoing loan
            await pawnManager.claim(rcnEngine.address, customLoanId, "", {from: borrower});
            assert(false, "throw was expected in line above.")
        } catch(e){
            assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        try { // try lender claim pawn with ongoing loan
            await pawnManager.claim(rcnEngine.address, customLoanId, "", {from: lender});
            assert(false, "throw was expected in line above.")
        } catch(e){
            assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        await rcn.approve(rcnEngine.address, web3.toWei("250"), {from: borrowerHelper});
        await rcnEngine.pay(customLoanId, web3.toWei("250"), borrowerHelper, [], {from: borrowerHelper});

        try { // try lender claim pawn with paid loan
            await pawnManager.claim(rcnEngine.address, customLoanId, "", {from: lender});
            assert(false, "throw was expected in line above.")
        } catch(e){
            assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        let claimPawnReceipt = await pawnManager.claim(rcnEngine.address, customLoanId, "", {from: borrower});

        assert.equal((await pawnManager.getPawnStatus(customPawnId)).toNumber(), Status.Paid);

        assert.equal(await bundle.ownerOf(packageId), borrower);

        pawnPackage = await bundle.content(packageId);
        assert.equal(pawnPackage[0][0], poach.address);
        assert.equal(pawnPackage[0][1], pokemons.address);
        assert.equal(pawnPackage[1][1], ids[0]);

        await bundle.withdrawAll(packageId, borrower, {from: borrower});

        let prevBal = await pepeCoin.balanceOf(borrower);
        await poach.destroy(pawnPackage[1][0], {from: borrower});
        pair = await poach.getPair(pawnPackage[1][0]);
        assert.equal(pair[2], false);
        let bal = await pepeCoin.balanceOf(borrower);
        assert.equal(bal.toString(), prevBal.plus(amounts[0]).toString());

        assert.equal(await pokemons.ownerOf(pikachu), borrower);
    });
});
