let TestToken = artifacts.require("./contracts/rcn/utils/test/TestToken.sol");

let Poach = artifacts.require("./contracts/Poach.sol");
//global variables
//////////////////
const Helper = require("./helper.js");
const BigNumber = require('bignumber.js');
const precision = new BigNumber(10**18);

const token  = 0;
const amount = 1;
const alive  = 2;
let customPairId;
let customPair;

// contracts
let rcn;
let tico;
let poach;

// accounts
let user;

contract('Poach', function(accounts) {
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

    beforeEach("Create Poach and tokens", async function(){
        // set account addresses
        user   = accounts[1];
        hacker = accounts[2];
        // deploy contracts
        rcn   = await TestToken.new();
        tico  = await TestToken.new();
        poach = await Poach.new();
        // create tokens
        await rcn.createTokens(user, web3.toWei("500"));
        await tico.createTokens(user, web3.toWei("300"));

        await rcn.createTokens(hacker, web3.toWei("500000"));
        await tico.createTokens(hacker, web3.toWei("500000"));
        // create custom pair
        await rcn.approve(poach.address, web3.toWei("100"), {from:user});
        await poach.create(rcn.address, web3.toWei("100"), {from: user});
        customPairId = (await poach.assetsOf(user))[0].toNumber();
    });

    it("Test: create function", async() => {
        try { // try a create a pair without approve
          await poach.create(tico.address, web3.toWei("100"), {from: user});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        try { // try a create a pair with other account
          await rcn.approve(poach.address, web3.toWei("100"), {from:user});
          await poach.create(rcn.address, web3.toWei("100"), {from: hacker});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        customPair = await poach.getPair(customPairId);
        assert.equal(customPair[token], rcn.address);
        assert.equal(customPair[amount].toNumber(), web3.toWei("100"));
        assert.equal(customPair[alive], true);
    });

    it("Test: deposit function", async() => {
        try { // try deposit without approve
          await poach.deposit(customPairId, web3.toWei("50"), {from: user});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        await rcn.approve(poach.address, web3.toWei("50"), {from:user});
        await poach.deposit(customPairId, web3.toWei("50"), {from: user});

        await rcn.approve(poach.address, web3.toWei("50"), {from: hacker});
        await poach.deposit(customPairId, web3.toWei("50"), {from: hacker});

        customPair = await poach.getPair(customPairId);
        assert.equal(customPair[token], rcn.address);
        assert.equal(customPair[amount].toNumber(), web3.toWei("200"));
        assert.equal(customPair[alive], true);

        await poach.destroy(customPairId, {from: user});

        try { // try deposit in destroyed pair
          await rcn.approve(poach.address, web3.toWei("50"), {from: user});
          await poach.deposit(customPairId, web3.toWei("50"), {from: user});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }
    });

    it("Test: destroy function", async() => {
        try { // try destroy a pair with other account
          await poach.destroy(customPairId, {from: hacker});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        await poach.destroy(customPairId, {from: user});

        customPair = await poach.getPair(customPairId);
        assert.equal(customPair[token], rcn.address);
        assert.equal(customPair[alive], false);

        try { // try destroy a destroyed pair
          await rcn.createTokens(poach.address, web3.toWei("500000"));
          await poach.destroy(customPairId, {from: user});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }
    });
});
