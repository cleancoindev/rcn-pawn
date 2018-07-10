let TestToken = artifacts.require("./TestToken.sol");
let NanoLoanEngine = artifacts.require("./NanoLoanEngine.sol");

let TestERC721 = artifacts.require("./TestERC721.sol");
let ERC721Cosigner = artifacts.require("./ERC721Cosigner.sol");
//global variables
//////////////////
const Helper = require("./helper.js");
const BigNumber = require('bignumber.js');
const precision = new BigNumber(10**18);

// contracts
let rcn;
let engine;
let erc721Cosigner;

// ERC721 contacts
let pokemons;
let zombies;
let magicCards;

// ERC721 ids
// pokemons
let ratata   = 19;
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

// accounts
let admin;
let lender;
let borrower;
let borrowerHelper;

// loan parameters
const dueTime = 86400;

contract('NanoLoanEngine', function(accounts) {
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

    beforeEach("Create engine and token", async function(){
        // set account addresses
        admin          = accounts[0];
        lender         = accounts[1];
        borrower       = accounts[2];
        borrowerHelper = accounts[3];
        // deploy contracts
        engine = await NanoLoanEngine.new(rcn.address, {from:admin});
        rcn    = await TestToken.new();
        pokemons = await TestERC721.new();
        await pokemons.addNtf("ratata"  , ratata, lender);
        await pokemons.addNtf("pikachu" , pikachu , borrower);
        await pokemons.addNtf("clefairy", clefairy, borrower);
        await pokemons.addNtf("vulpix"  , vulpix  , borrower);
        await pokemons.addNtf("mewtwo"  , mewtwo  , borrower);
        zombies = await TestERC721.new();
        await zombies.addNtf("michaelJackson"  , michaelJackson  , borrower);
        await zombies.addNtf("theFirst"  , theFirst  , borrower);
        magicCards = await TestERC721.new();
        await magicCards.addNtf("blackDragon"  , blackDragon  , borrower);
        await magicCards.addNtf("ent"  , ent  , borrower);
        await magicCards.addNtf("orc"  , orc  , borrower);
        erc721Cosigner = await ERC721Cosigner.new();
    });

    it("ERC721 cosigner test, defaulted loan, one ERC721 contract one non fungible token", async() => {
        let loanReceipt = await engine.createLoan(0x0, borrower, 0x0, web3.toWei("500"), Helper.toInterestRate(17, dueTime), Helper.toInterestRate(17, dueTime), dueTime, 0, 10 ** 30, "", {from:borrower});
        const loanId = loanReceipt.logs[0].args._index;

        await pokemons.approve(erc721Cosigner.address, pikachu, {from:borrower});
        assert.equal(await pokemons.getApproved(pikachu), erc721Cosigner.address, "ckeck approve");

        await rcn.createTokens(lender, web3.toWei("500"));
        rcn.approve(engine.address, web3.toWei("500"), {from:lender});

        const cosignerData = Helper.hexArrayToBytesOfBytes32([pokemons.address, web3.toHex(pikachu)]);
        await engine.lend(loanId, [], erc721Cosigner.address, cosignerData, {from:lender});

        assert.equal(await pokemons.ownerOf(pikachu), erc721Cosigner.address);
        assert.equal(await pokemons.getApproved(pikachu), 0x0);

        try { // try claim a NFT before due time
          await erc721Cosigner.claim(engine.address, loanId, "", {from: borrower});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        Helper.timeTravel(dueTime);
        await erc721Cosigner.claim(engine.address, loanId, "", {from: lender});
        assert.equal(await pokemons.ownerOf(pikachu), lender);
        assert.equal(await pokemons.getApproved(pikachu), 0x0);
    });

    it("ERC721 cosigner test, pay loan, one ERC721 contract one non fungible token", async() => {
        let loanReceipt = await engine.createLoan(0x0, borrower, 0x0, web3.toWei("500"), Helper.toInterestRate(17, dueTime), Helper.toInterestRate(17, dueTime), dueTime, 0, 10 ** 30, "", {from:borrower});
        const loanId = loanReceipt.logs[0].args._index;

        await pokemons.approve(erc721Cosigner.address, pikachu, {from:borrower});
        assert.equal(await pokemons.getApproved(pikachu), erc721Cosigner.address, "ckeck approve");

        await rcn.createTokens(lender, web3.toWei("500"));
        rcn.approve(engine.address, web3.toWei("500"), {from:lender});

        const cosignerData = Helper.hexArrayToBytesOfBytes32([pokemons.address, web3.toHex(pikachu)]);
        await engine.lend(loanId, [], erc721Cosigner.address, cosignerData, {from:lender});

        await rcn.createTokens(borrowerHelper, web3.toWei("600"));
        rcn.approve(engine.address, web3.toWei("600"), {from:borrowerHelper});

        await engine.pay(loanId, web3.toWei("600"), borrowerHelper, [], {from:borrowerHelper});

        try { // try claim a NFT before pay
          await erc721Cosigner.claim(engine.address, loanId, "", {from: lender});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        await erc721Cosigner.claim(engine.address, loanId, "", {from: borrower});
        assert.equal(await pokemons.ownerOf(pikachu), borrower);
        assert.equal(await pokemons.getApproved(pikachu), 0x0);
    });
    it("Test delete Pawn", async() => {
        let loanReceipt = await engine.createLoan(0x0, borrower, 0x0, web3.toWei("500"), Helper.toInterestRate(17, dueTime), Helper.toInterestRate(17, dueTime), dueTime, 0, 10 ** 30, "", {from:borrower});
        const loanId = loanReceipt.logs[0].args._index;

        await pepe.createTokens(borrower, web3.toWei("500"));
        await pepe.approve(pawn.address, web3.toWei("500"), {from:borrower});
        await pawn.addERC20ToPawnToken(loanId, pepe.address, web3.toWei("500"), {from: borrower});
        await pokemons.approve(pawn.address, pikachu, {from:borrower});
        await pawn.addERC721ToPawnToken(loanId, pokemons.address, [pikachu], {from: borrower});
        await zombies.approve(pawn.address, michaelJackson, {from:borrower});
        await pawn.addERC721ToPawnToken(loanId, zombies.address, [michaelJackson], {from: borrower});
        await magicCards.approve(pawn.address, blackDragon, {from:borrower});
        await magicCards.approve(pawn.address, ent, {from:borrower});
        await pawn.addERC721ToPawnToken(loanId, magicCards.address, [blackDragon, ent], {from: borrower});

        await pawn.deletePawn(loanId, {from: borrower});
        const auxERC20 = await pawn.getERC20Pawn(loanId);
        assert.isEmpty(auxERC20[0], "ckeck delete");
        assert.isEmpty(auxERC20[1], "ckeck delete");
        assert.isEmpty(await pawn.getERC721AddrPawn(loanId), "ckeck delete");

        await magicCards.approve(pawn.address, ent, {from:borrower});
        await pawn.addERC721ToPawnToken(loanId, magicCards.address, [ent], {from: borrower});

        await pawn.approve(erc721Cosigner.address, loanId, {from:borrower});

        await rcn.createTokens(lender, web3.toWei("500"));
        rcn.approve(engine.address, web3.toWei("500"), {from:lender});

        const cosignerData = Helper.hexArrayToBytesOfBytes32([pawn.address, loanId]);
        await engine.lend(loanId, [], erc721Cosigner.address, cosignerData, {from:lender});

        try { // try delete a pawn after lend
          await pawn.deletePawn(loanId, {from: borrower});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        assert.equal(await magicCards.ownerOf(ent), pawn.address);
        assert.equal(await magicCards.getApproved(ent), 0x0);
    });

    it("ERC721 cosigner test, defaulted loan, 3 ERC721 contract n non fungible token, and RCN token", async() => {
        let loanReceipt = await engine.createLoan(0x0, borrower, 0x0, web3.toWei("500"), Helper.toInterestRate(17, dueTime), Helper.toInterestRate(17, dueTime), dueTime, 0, 10 ** 30, "", {from:borrower});
        const loanId = loanReceipt.logs[0].args._index;

        await pepe.createTokens(borrower, web3.toWei("500"));
        await pepe.approve(pawn.address, web3.toWei("500"), {from:borrower});
        await pawn.addERC20ToPawnToken(loanId, pepe.address, web3.toWei("500"), {from: borrower});
        // pokemons
        await pokemons.approve(pawn.address, pikachu, {from:borrower});
        assert.equal(await pokemons.getApproved(pikachu), pawn.address, "ckeck approve");
        await pokemons.approve(pawn.address, clefairy, {from:borrower});
        assert.equal(await pokemons.getApproved(clefairy), pawn.address, "ckeck approve");
        await pokemons.approve(pawn.address, vulpix, {from:borrower});
        assert.equal(await pokemons.getApproved(vulpix), pawn.address, "ckeck approve");
        await pokemons.approve(pawn.address, mewtwo, {from:borrower});
        assert.equal(await pokemons.getApproved(mewtwo), pawn.address, "ckeck approve");
        await pawn.addERC721ToPawnToken(loanId, pokemons.address, [pikachu, clefairy, vulpix, mewtwo], {from: borrower});
        // zombies
        await zombies.approve(pawn.address, michaelJackson, {from:borrower});
        assert.equal(await zombies.getApproved(michaelJackson), pawn.address, "ckeck approve");
        await zombies.approve(pawn.address, theFirst, {from:borrower});
        assert.equal(await zombies.getApproved(theFirst), pawn.address, "ckeck approve");
        await pawn.addERC721ToPawnToken(loanId, zombies.address, [michaelJackson, theFirst], {from: borrower});
        // magic cards
        await magicCards.approve(pawn.address, blackDragon, {from:borrower});
        assert.equal(await magicCards.getApproved(blackDragon), pawn.address, "ckeck approve");
        await magicCards.approve(pawn.address, ent, {from:borrower});
        assert.equal(await magicCards.getApproved(ent), pawn.address, "ckeck approve");
        await magicCards.approve(pawn.address, orc, {from:borrower});
        assert.equal(await magicCards.getApproved(orc), pawn.address, "ckeck approve");
        await pawn.addERC721ToPawnToken(loanId, magicCards.address, [blackDragon, ent, orc], {from: borrower});

        await rcn.createTokens(lender, web3.toWei("500"));
        rcn.approve(engine.address, web3.toWei("500"), {from:lender});

        await pawn.approve(erc721Cosigner.address, loanId, {from:borrower});
        assert.equal(await pawn.getApproved(loanId), erc721Cosigner.address, "ckeck approve");

        const cosignerData = Helper.hexArrayToBytesOfBytes32([pawn.address, loanId]);
        await engine.lend(loanId, [], erc721Cosigner.address, cosignerData, {from:lender});

        assert.equal(await pawn.ownerOf(loanId), erc721Cosigner.address, "ckeck approve");
        assert.equal(await pawn.getApproved(loanId), 0x0, "ckeck approve");

        assert.equal((await pepe.balanceOf(pawn.address)).toNumber(), web3.toWei("500"), "ckeck balance");
        // pokemons
        assert.equal(await pokemons.ownerOf(pikachu), pawn.address);
        assert.equal(await pokemons.getApproved(pikachu), 0x0);
        assert.equal(await pokemons.ownerOf(clefairy), pawn.address);
        assert.equal(await pokemons.getApproved(clefairy), 0x0);
        assert.equal(await pokemons.ownerOf(vulpix), pawn.address);
        assert.equal(await pokemons.getApproved(vulpix), 0x0);
        assert.equal(await pokemons.ownerOf(mewtwo), pawn.address);
        assert.equal(await pokemons.getApproved(mewtwo), 0x0);
        // zombies
        assert.equal(await zombies.ownerOf(michaelJackson), pawn.address);
        assert.equal(await zombies.getApproved(michaelJackson), 0x0);
        assert.equal(await zombies.ownerOf(theFirst), pawn.address);
        assert.equal(await zombies.getApproved(theFirst), 0x0);
        // magic cards
        assert.equal(await magicCards.ownerOf(blackDragon), pawn.address);
        assert.equal(await magicCards.getApproved(blackDragon), 0x0);
        assert.equal(await magicCards.ownerOf(ent), pawn.address);
        assert.equal(await magicCards.getApproved(ent), 0x0);
        assert.equal(await magicCards.ownerOf(orc), pawn.address);
        assert.equal(await magicCards.getApproved(orc), 0x0);

        try { // try claim a NFT before due time
          await erc721Cosigner.claim(engine.address, loanId, "", {from: borrower});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        Helper.timeTravel(dueTime);
        await erc721Cosigner.claim(engine.address, loanId, "", {from: lender});

        assert.equal(await pawn.ownerOf(loanId), lender);
        assert.equal(await pawn.getApproved(loanId), 0x0);

        assert.equal((await pepe.balanceOf(lender)).toNumber(), web3.toWei("500"), "ckeck balance");
        // pokemons
        assert.equal(await pokemons.ownerOf(pikachu), lender);
        assert.equal(await pokemons.getApproved(pikachu), 0x0);
        assert.equal(await pokemons.ownerOf(clefairy), lender);
        assert.equal(await pokemons.getApproved(clefairy), 0x0);
        assert.equal(await pokemons.ownerOf(vulpix), lender);
        assert.equal(await pokemons.getApproved(vulpix), 0x0);
        assert.equal(await pokemons.ownerOf(mewtwo), lender);
        assert.equal(await pokemons.getApproved(mewtwo), 0x0);
        // zombies
        assert.equal(await zombies.ownerOf(michaelJackson), lender);
        assert.equal(await zombies.getApproved(michaelJackson), 0x0);
        assert.equal(await zombies.ownerOf(theFirst), lender);
        assert.equal(await zombies.getApproved(theFirst), 0x0);
        // magic cards
        assert.equal(await magicCards.ownerOf(blackDragon), lender);
        assert.equal(await magicCards.getApproved(blackDragon), 0x0);
        assert.equal(await magicCards.ownerOf(ent), lender);
        assert.equal(await magicCards.getApproved(ent), 0x0);
        assert.equal(await magicCards.ownerOf(orc), lender);
        assert.equal(await magicCards.getApproved(orc), 0x0);
    });

    it("ERC721 cosigner test, pay loan, 3 ERC721 contract n non fungible token, and RCN token", async() => {
        let loanReceipt = await engine.createLoan(0x0, borrower, 0x0, web3.toWei("500"), Helper.toInterestRate(17, dueTime), Helper.toInterestRate(17, dueTime), dueTime, 0, 10 ** 30, "", {from:borrower});
        const loanId = loanReceipt.logs[0].args._index;

        await pepe.createTokens(borrower, web3.toWei("500"));
        await pepe.approve(pawn.address, web3.toWei("500"), {from:borrower});
        await pawn.addERC20ToPawnToken(loanId, pepe.address, web3.toWei("500"), {from: borrower});
        // pokemons
        await pokemons.approve(pawn.address, pikachu, {from:borrower});
        assert.equal(await pokemons.getApproved(pikachu), pawn.address, "ckeck approve");
        await pokemons.approve(pawn.address, clefairy, {from:borrower});
        assert.equal(await pokemons.getApproved(clefairy), pawn.address, "ckeck approve");
        await pokemons.approve(pawn.address, vulpix, {from:borrower});
        assert.equal(await pokemons.getApproved(vulpix), pawn.address, "ckeck approve");
        await pokemons.approve(pawn.address, mewtwo, {from:borrower});
        assert.equal(await pokemons.getApproved(mewtwo), pawn.address, "ckeck approve");
        await pawn.addERC721ToPawnToken(loanId, pokemons.address, [pikachu, clefairy, vulpix, mewtwo], {from: borrower});
        // zombies
        await zombies.approve(pawn.address, michaelJackson, {from:borrower});
        assert.equal(await zombies.getApproved(michaelJackson), pawn.address, "ckeck approve");
        await zombies.approve(pawn.address, theFirst, {from:borrower});
        assert.equal(await zombies.getApproved(theFirst), pawn.address, "ckeck approve");
        await pawn.addERC721ToPawnToken(loanId, zombies.address, [michaelJackson, theFirst], {from: borrower});
        // magic cards
        await magicCards.approve(pawn.address, blackDragon, {from:borrower});
        assert.equal(await magicCards.getApproved(blackDragon), pawn.address, "ckeck approve");
        await magicCards.approve(pawn.address, ent, {from:borrower});
        assert.equal(await magicCards.getApproved(ent), pawn.address, "ckeck approve");
        await magicCards.approve(pawn.address, orc, {from:borrower});
        assert.equal(await magicCards.getApproved(orc), pawn.address, "ckeck approve");
        await pawn.addERC721ToPawnToken(loanId, magicCards.address, [blackDragon, ent, orc], {from: borrower});

        await rcn.createTokens(lender,  web3.toWei("500"));
        rcn.approve(engine.address,  web3.toWei("500"), {from:lender});

        await pawn.approve(erc721Cosigner.address, loanId, {from:borrower});
        assert.equal(await pawn.getApproved(loanId), erc721Cosigner.address, "ckeck approve");

        const cosignerData = Helper.hexArrayToBytesOfBytes32([pawn.address, loanId]);
        await engine.lend(loanId, [], erc721Cosigner.address, cosignerData, {from:lender});

        assert.equal(await pawn.ownerOf(loanId), erc721Cosigner.address, "ckeck approve");
        assert.equal(await pawn.getApproved(loanId), 0x0, "ckeck approve");

        assert.equal((await pepe.balanceOf(pawn.address)).toNumber(), web3.toWei("500"), "ckeck balance");
        // pokemons
        assert.equal(await pokemons.ownerOf(pikachu), pawn.address);
        assert.equal(await pokemons.getApproved(pikachu), 0x0);
        assert.equal(await pokemons.ownerOf(clefairy), pawn.address);
        assert.equal(await pokemons.getApproved(clefairy), 0x0);
        assert.equal(await pokemons.ownerOf(vulpix), pawn.address);
        assert.equal(await pokemons.getApproved(vulpix), 0x0);
        assert.equal(await pokemons.ownerOf(mewtwo), pawn.address);
        assert.equal(await pokemons.getApproved(mewtwo), 0x0);
        // zombies
        assert.equal(await zombies.ownerOf(michaelJackson), pawn.address);
        assert.equal(await zombies.getApproved(michaelJackson), 0x0);
        assert.equal(await zombies.ownerOf(theFirst), pawn.address);
        assert.equal(await zombies.getApproved(theFirst), 0x0);
        // magic cards
        assert.equal(await magicCards.ownerOf(blackDragon), pawn.address);
        assert.equal(await magicCards.getApproved(blackDragon), 0x0);
        assert.equal(await magicCards.ownerOf(ent), pawn.address);
        assert.equal(await magicCards.getApproved(ent), 0x0);
        assert.equal(await magicCards.ownerOf(orc), pawn.address);
        assert.equal(await magicCards.getApproved(orc), 0x0);

        await rcn.createTokens(borrowerHelper, web3.toWei("6000"));
        rcn.approve(engine.address, web3.toWei("6000"), {from:borrowerHelper});

        await engine.pay(loanId, web3.toWei("6000"), borrowerHelper, [], {from:borrowerHelper});

        try { // try claim a NFT before pay
          await erc721Cosigner.claim(engine.address, loanId, "", {from: lender});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        await erc721Cosigner.claim(engine.address, loanId, "", {from: borrower});

        assert.equal(await pawn.ownerOf(loanId), borrower);
        assert.equal(await pawn.getApproved(loanId), 0x0);

        assert.equal((await pepe.balanceOf(borrower)).toNumber(), web3.toWei("500"), "ckeck balance");
        // pokemons
        assert.equal(await pokemons.ownerOf(pikachu), borrower);
        assert.equal(await pokemons.getApproved(pikachu), 0x0);
        assert.equal(await pokemons.ownerOf(clefairy), borrower);
        assert.equal(await pokemons.getApproved(clefairy), 0x0);
        assert.equal(await pokemons.ownerOf(vulpix), borrower);
        assert.equal(await pokemons.getApproved(vulpix), 0x0);
        assert.equal(await pokemons.ownerOf(mewtwo), borrower);
        assert.equal(await pokemons.getApproved(mewtwo), 0x0);
        // zombies
        assert.equal(await zombies.ownerOf(michaelJackson), borrower);
        assert.equal(await zombies.getApproved(michaelJackson), 0x0);
        assert.equal(await zombies.ownerOf(theFirst), borrower);
        assert.equal(await zombies.getApproved(theFirst), 0x0);
        // magic cards
        assert.equal(await magicCards.ownerOf(blackDragon), borrower);
        assert.equal(await magicCards.getApproved(blackDragon), 0x0);
        assert.equal(await magicCards.ownerOf(ent), borrower);
        assert.equal(await magicCards.getApproved(ent), 0x0);
        assert.equal(await magicCards.ownerOf(orc), borrower);
        assert.equal(await magicCards.getApproved(orc), 0x0);
    });

    it("ERC721 test", async() => {
        assert.equal((await pokemons.balanceOf(borrower)).toNumber(), 4, "ckeck Id");
        assert.equal((await pokemons.totalSupply()).toNumber(), 5, "ckeck supply");
        assert.equal(await pokemons.ownerOf(ratata), lender, "ckeck owner");

        assert.equal(await pokemons.ownerOf(ratata), lender, "ckeck owner");
        await pokemons.approve(admin, ratata, {from: lender});
        assert.equal(await pokemons.getApproved(ratata), admin, "ckeck approve");
        await pokemons.approve(borrower, ratata, {from: lender});
        assert.equal(await pokemons.getApproved(ratata), borrower, "ckeck approve");
        assert.equal(await pokemons.ownerOf(ratata), lender);

        await pokemons.takeOwnership(ratata, {from: borrower});
        assert.equal(await pokemons.ownerOf(ratata), borrower);
        assert.equal(await pokemons.getApproved(ratata), 0x0, "ckeck approve");
    });
});
