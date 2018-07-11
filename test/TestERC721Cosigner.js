let NanoLoanEngine = artifacts.require("./NanoLoanEngine.sol");
let ERC721Cosigner = artifacts.require("./ERC721Cosigner.sol");
let TestToken = artifacts.require("./TestToken.sol");
let TestERC721 = artifacts.require("./TestERC721.sol");
//global variables
//////////////////
const Helper = require("./helper.js");
// contracts
let rcn;
let engine;
let erc721Cosigner;
// ERC721 contacts
let pokemons;
// pokemons
let pikachu  = 25;
// accounts
let admin;
let lender;
let borrower;
let borrowerHelper;
// auxiliar variables
const dueTime = 86400;
let loanId;
let cosignerData;

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
        rcn    = await TestToken.new();
        engine = await NanoLoanEngine.new(rcn.address, {from:admin});
        pokemons = await TestERC721.new();
        erc721Cosigner = await ERC721Cosigner.new();
        // create tokens
        await rcn.createTokens(lender, web3.toWei("500"));
        await rcn.createTokens(borrowerHelper, web3.toWei("550"));
        await pokemons.addNtf("pikachu" , pikachu , borrower);
        // create a loan
        const loanReceipt = await engine.createLoan(0x0, borrower, 0x0, web3.toWei("500"), Helper.toInterestRate(17, dueTime),
                                                    Helper.toInterestRate(17, dueTime), dueTime, 0, 10 ** 30, "", {from:borrower});
        loanId = loanReceipt.logs[0].args._index;

        cosignerData = Helper.hexArrayToBytesOfBytes32([pokemons.address, web3.toHex(pikachu)]);
        rcn.approve(engine.address, web3.toWei("500"), {from:lender});
    });

    it("ERC721 cosigner test, requestCosign() function", async() => {
        try { // try a lend without the approve of NFT owner
          await engine.lend(loanId, [], erc721Cosigner.address, cosignerData, {from:lender});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        await pokemons.approve(erc721Cosigner.address, pikachu, {from:borrower});
        await engine.lend(loanId, [], erc721Cosigner.address, cosignerData, {from:lender});

        assert.equal(await pokemons.ownerOf(pikachu), erc721Cosigner.address);
    });

    it("ERC721 cosigner test, claim() function from borrower", async() => {
        await pokemons.approve(erc721Cosigner.address, pikachu, {from:borrower});
        await engine.lend(loanId, [], erc721Cosigner.address, cosignerData, {from:lender});

        rcn.approve(engine.address, web3.toWei("550"), {from:borrowerHelper});

        await engine.pay(loanId, web3.toWei("550"), borrowerHelper, [], {from: borrowerHelper});

        try { // try lender claim NFT with paid loan
          await erc721Cosigner.claim(engine.address, loanId, "", {from: lender});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        await erc721Cosigner.claim(engine.address, loanId, "", {from: borrower});
        assert.equal(await pokemons.ownerOf(pikachu), borrower);
    });

    it("ERC721 cosigner test, claim() function from lender", async() => {
        await pokemons.approve(erc721Cosigner.address, pikachu, {from:borrower});
        await engine.lend(loanId, [], erc721Cosigner.address, cosignerData, {from:lender});

        try { // try borrower claim NFT before due time
          await erc721Cosigner.claim(engine.address, loanId, "", {from: borrower});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        try { // try lender claim NFT before due time
          await erc721Cosigner.claim(engine.address, loanId, "", {from: lender});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        Helper.timeTravel(dueTime);

        try { // try borrower claim NFT with unpaid loan
          await erc721Cosigner.claim(engine.address, loanId, "", {from: borrower});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        await erc721Cosigner.claim(engine.address, loanId, "", {from: lender});
        assert.equal(await pokemons.ownerOf(pikachu), lender);
    });
});
