let TestToken = artifacts.require("./rcn/utils/test/TestToken.sol");
let TestERC721 = artifacts.require("./rcn/utils/test/TestERC721.sol");
let NanoLoanEngine = artifacts.require("./rcn/NanoLoanEngine.sol");

let Bundle = artifacts.require("./Bundle.sol");
let Poach = artifacts.require("./Poach.sol");
let PawnManager = artifacts.require("./PawnManager.sol");

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
let lender;

contract('TestBundle', function(accounts) {
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
        lender  = accounts[2];
    });

    beforeEach("Create Bundle, ERC20, ERC721 contracts", async function(){
        // deploy contracts
        // ERC20
        rcn = await TestToken.new();
        await rcn.createTokens(borrower, web3.toWei(10));
        await rcn.createTokens(lender, web3.toWei(6));
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
    });

    it("test create a pawn and cancel", async() => {
        const loanDuration = 6 * 30 * 24 * 60 * 60;
        const closeTime = 5 * 30 * 24 * 60 * 60;
        const expirationRequest = Math.floor(Date.now() / 1000) + 1 * 30 * 24 * 60 * 60;

        const loanParams = [
            web3.toWei(199), // Amount requested
            Helper.toInterestRate(20), // Anual interest
            Helper.toInterestRate(30), // Anual punnitory interest
            loanDuration, // Duration of the loan, in seconds
            closeTime, // Time when the payment of the loan starts
            expirationRequest // Expiration timestamp of the request
        ];

        const loanMetadata = "#pawn";

        let tokens  = [pepeCoin.address];
        let amounts = [web3.toWei(1)];
        let erc721s = [pokemons.address];
        let ids     = [pikachu];

        // approves
        await pepeCoin.approve(pawnManager.address, amounts[0], {from:borrower});
        await pokemons.approve(pawnManager.address, ids[0], {from:borrower});

        // Retrieve the loan signature
        let loanIdentifier = await rcnEngine.buildIdentifier(
            0x0, // Contract of the oracle
            borrower, // Borrower of the loan (caller of this method)
            pawnManager.address, // Creator of the loan, the mortgage creator
            0x0, // Currency of the loan, MANA
            loanParams[0], // Request amount
            loanParams[1], // Interest rate, 20% anual
            loanParams[2], // Punnitory interest rate, 30% anual
            loanParams[3], // Duration of the loan, 6 months
            loanParams[4], // Borrower can pay the loan at 5 months
            loanParams[5], // Mortgage request expires in 1 month
            loanMetadata  // Metadata
        )

        // Sign the loan
        let approveSignature = await web3.eth.sign(borrower, loanIdentifier).slice(2);

        let r = `0x${approveSignature.slice(0, 64)}`
        let s = `0x${approveSignature.slice(64, 128)}`
        let v = web3.toDecimal(approveSignature.slice(128, 130)) + 27

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
        let loanId = pawnReceipt["logs"][pawnReceipt["logs"].length - 1]["args"]["loanId"];
        let pawnId = pawnReceipt["logs"][pawnReceipt["logs"].length - 1]["args"]["pawnId"];

        assert.equal((await pawnManager.getLiability(rcnEngine.address, loanId)).toNumber(), pawnId.toNumber());

        let packageId = await pawnManager.getPawnPackageId(pawnId);
        let pawnPackage = await bundle.content(packageId);
        let pair = await poach.getPair(pawnPackage[1][0]);

        assert.equal(await bundle.ownerOf(packageId), pawnManager.address);

        assert.equal(await pawnManager.ownerOf(pawnId), 0x0);
        assert.equal(await pawnManager.getPawnOwner(pawnId), borrower);
        assert.equal(await pawnManager.getPawnEngine(pawnId), rcnEngine.address);
        assert.equal((await pawnManager.getPawnLoanId(pawnId)).toNumber(), loanId);
        assert.equal((await pawnManager.getPawnPackageId(pawnId)).toNumber(), pawnId);
        assert.equal((await pawnManager.getPawnStatus(pawnId)).toNumber(), Status.Pending);

        assert.equal(pawnPackage[0][0], poach.address);
        assert.equal(pair[1], amounts[0]);

        assert.equal(pawnPackage[0][1], pokemons.address);
        assert.equal(pawnPackage[1][1], ids[0]);


        try { // Try to claim a pawn without being borrowed from lender
            await pawnManager.claim(rcnEngine.address, loanId, "", {from: lender});
            assert(false, "throw was expected in line above.")
        } catch(e){
            assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }
        try { // Try to claim a pawn without being borrowed from borrower
            await pawnManager.claim(rcnEngine.address, loanId, "", {from: borrower});
            assert(false, "throw was expected in line above.")
        } catch(e){
            assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        try { // Try to cancel a pawn without be the owner
            await pawnManager.cancelPawn(pawnId, {from: lender});
            assert(false, "throw was expected in line above.")
        } catch(e){
            assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        const cancelPawnReceipt = await pawnManager.cancelPawn(pawnId, {from: borrower});
        pawnId = cancelPawnReceipt["logs"][cancelPawnReceipt["logs"].length - 1]["args"]["_pawnId"];

        assert.equal((await pawnManager.getPawnStatus(pawnId)).toNumber(), Status.Canceled);

        assert.equal(await bundle.ownerOf(packageId), borrower);

        pawnPackage = await bundle.content(packageId);
        assert.equal(pawnPackage[0][0], poach.address);
        assert.equal(pair[1], amounts[0]);

        assert.equal(pawnPackage[0][1], pokemons.address);
        assert.equal(pawnPackage[1][1], ids[0]);
    });
});
