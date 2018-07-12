let TestToken = artifacts.require("./TestToken.sol");
let TestERC721 = artifacts.require("./TestERC721.sol");

let ErcBundle = artifacts.require("./ErcBundle.sol");
let Poach = artifacts.require("./Poach.sol");

//global variables
//////////////////
const Helper = require("./helper.js");
const BigNumber = require('bignumber.js');
const precision = new BigNumber(10**18);

// Contracts
let ercBundle;
let poach;
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
let user;
let user2;

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

    beforeEach("Create ErcBundle, ERC20, ERC721 contracts", async function(){
        // set account addresses
        user  = accounts[1];
        user2  = accounts[2];
        // deploy contracts
        // ERC20
        rcn = await TestToken.new();
        await rcn.createTokens(user, web3.toWei(10));
        await rcn.createTokens(user2, web3.toWei(6));
        pepeCoin = await TestToken.new();
        await pepeCoin.createTokens(user, web3.toWei(15));
        // ERC721
        pokemons = await TestERC721.new();
        await pokemons.addNtf("ratata"  , ratata  , user2);
        await pokemons.addNtf("pikachu" , pikachu , user);
        await pokemons.addNtf("clefairy", clefairy, user);
        await pokemons.addNtf("vulpix"  , vulpix  , user);
        await pokemons.addNtf("mewtwo"  , mewtwo  , user);
        zombies = await TestERC721.new();
        await zombies.addNtf("michaelJackson", michaelJackson , user);
        await zombies.addNtf("theFirst"      , theFirst       , user);
        magicCards = await TestERC721.new();
        await magicCards.addNtf("blackDragon", blackDragon, user);
        await magicCards.addNtf("ent"        , ent        , user);
        await magicCards.addNtf("orc"        , orc        , user);

        ercBundle = await ErcBundle.new();
        poach = await Poach.new();
    });

    it("test createBundle()", async() => {
        await ercBundle.create({from: user2});
        await ercBundle.create({from: user});

        assert.equal(await ercBundle.ownerOf(2), user, "check bundle 2 ownership");

        await ercBundle.create({from: user});
        await ercBundle.create({from: user});
        await ercBundle.create({from: user2});
        await ercBundle.create({from: user});

        assert.equal(await ercBundle.balanceOf(user), 4, "ckeck user balance");
        assert.equal(await ercBundle.balanceOf(user2), 2, "ckeck user2 balance");

        const userBundles = await ercBundle.assetsOf(user);
        const user2Bundles = await ercBundle.assetsOf(user2);

        assert.equal(userBundles.length, 4, "ckeck user balance");
        assert.equal(user2Bundles.length, 2, "ckeck user2 balance");
    });

    it("test add erc20 to a bundle", async() => {
        await ercBundle.create({from: user});
        const prevRcnBal = await rcn.balanceOf(user);
        const prevPepeCoinBal = await pepeCoin.balanceOf(user);
        const bundleId = 1;

        await rcn.approve(poach.address, web3.toWei(5), {from:user});
        await pepeCoin.approve(poach.address, web3.toWei(6), {from:user});

        await poach.create(rcn.address, web3.toWei(5), {from:user});
        await poach.create(pepeCoin.address, web3.toWei(6), {from:user});
        await poach.setApprovalForAll(ercBundle.address, true, {from:user});

        await ercBundle.deposit(bundleId, poach.address, 0, {from:user});
        await ercBundle.deposit(bundleId, poach.address, 1, {from:user});

        // ckeck ercBundle balance
        assert.equal(await rcn.balanceOf(poach.address), web3.toWei(5), "ckeck ercBundle balance in rcn");
        assert.equal(await pepeCoin.balanceOf(poach.address), web3.toWei(6), "ckeck ercBundle balance in pepeCoin");
        assert.equal(await poach.ownerOf(0), ercBundle.address);
        assert.equal(await poach.ownerOf(1), ercBundle.address);
        // ckeck user balance
        assert.equal(await rcn.balanceOf(user), prevRcnBal - web3.toWei(5), "ckeck user balance in rcn");
        assert.equal(await pepeCoin.balanceOf(user), prevPepeCoinBal - web3.toWei(6), "ckeck user balance in pepeCoin");

        let content = await ercBundle.content(bundleId);
        assert.equal(content[0].length, 2);
        assert.equal(content[0].length, content[1].length);
        assert.equal(content[0][0], poach.address);
        assert.equal(content[1][0], 0);
        assert.equal(content[0][1], poach.address);
        assert.equal(content[1][1], 1);

        // add a diferent amount of tokens in a registered bundle
        await rcn.createTokens(user, web3.toWei(4));
        await rcn.approve(poach.address, web3.toWei(4), {from:user});
        await poach.deposit(0, web3.toWei(4), {from:user});

        assert.equal(await rcn.balanceOf(poach.address), web3.toWei(9), "ckeck ercBundle balance in rcn");
        
        content = await ercBundle.content(bundleId);
        assert.equal(content[0].length, 2);
        assert.equal(content[0].length, content[1].length);
        assert.equal(content[0][0], poach.address);
        assert.equal(content[1][0], 0);
        assert.equal(content[0][1], poach.address);
        assert.equal(content[1][1], 1);
    });

    it("test add erc721 to a bundle", async() => {
        await ercBundle.create({from: user});
        const bundleId = 1;

        // pokemons
        await pokemons.approve(ercBundle.address, pikachu, {from:user});
        await pokemons.approve(ercBundle.address, clefairy, {from:user});
        await ercBundle.depositBatch(bundleId, [pokemons.address, pokemons.address], [pikachu, clefairy], {from: user});
        // zombies
        await zombies.approve(ercBundle.address, theFirst, {from:user});
        await ercBundle.deposit(bundleId, zombies.address, theFirst, {from: user});
        // magic cards
        await magicCards.approve(ercBundle.address, orc, {from:user});
        await ercBundle.deposit(bundleId, magicCards.address, orc, {from: user});

        try { // try to add from other account
          await pokemons.approve(ercBundle.address, ratata, {from:user2});
          await ercBundle.depositBatch(bundleId, [pokemons.address], [ratata], {from:user});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        // add more non fungible token in a registered ERC721
        await magicCards.approve(ercBundle.address, ent, {from:user});
        await ercBundle.deposit(bundleId, magicCards.address, ent, {from: user});
        
        // check ownership
        assert.equal(await pokemons.ownerOf(pikachu), ercBundle.address);
        assert.equal(await pokemons.ownerOf(clefairy), ercBundle.address);
        assert.equal(await zombies.ownerOf(theFirst), ercBundle.address);
        assert.equal(await magicCards.ownerOf(orc), ercBundle.address);
        assert.equal(await magicCards.ownerOf(ent), ercBundle.address);

        const content = await ercBundle.content(bundleId);
        assert.equal(content[0].length, 5);
        assert.equal(content[0].length, content[1].length);
        assert.equal(content[0][0], pokemons.address);
        assert.equal(content[1][0], pikachu);
        assert.equal(content[0][1], pokemons.address);
        assert.equal(content[1][1], clefairy);
        assert.equal(content[0][2], zombies.address);
        assert.equal(content[1][2], theFirst);
        assert.equal(content[0][3], magicCards.address);
        assert.equal(content[1][3], orc);
        assert.equal(content[0][4], magicCards.address);
        assert.equal(content[1][4], ent);
    });

    it("test withdraw erc20 from a bundle", async() => {
        await ercBundle.create({from: user});
        const prevRcnBal = await rcn.balanceOf(user);
        const prevPepeCoinBal = await pepeCoin.balanceOf(user);
        const bundleId = 1;
        
        // add erc20
        await rcn.approve(poach.address, web3.toWei(5), {from:user});
        await pepeCoin.approve(poach.address, web3.toWei(6), {from:user});

        await poach.create(rcn.address, web3.toWei(5), {from:user});
        await poach.create(pepeCoin.address, web3.toWei(6), {from:user});
        await poach.setApprovalForAll(ercBundle.address, true, {from:user});

        await ercBundle.deposit(bundleId, poach.address, 0, {from:user});
        await ercBundle.deposit(bundleId, poach.address, 1, {from:user});

        // withdraw RCN
        let prevUserBal = await rcn.balanceOf(user);
        let prevUser2Bal = await rcn.balanceOf(user2);
        let prevPoachBal = await rcn.balanceOf(poach.address);

        // const rcnId = await ercBundle.getERC20Id(bundleId, rcn.address);

        await ercBundle.withdraw(bundleId, poach.address, 0, user2, {from:user});
        await poach.destroy(0, {from:user2});
        assert.equal((await rcn.balanceOf(user2)).toString(), prevUser2Bal.plus(web3.toWei(5)).toString(), "check user2 Balance");
        assert.equal((await rcn.balanceOf(user)).toString(), prevUserBal.toString(), "check user Balance");
        assert.equal((await rcn.balanceOf(poach.address)).toString(), prevPoachBal.minus(web3.toWei(5)).toString(), "check ercBundle Balance");
        // assert.equal(((await ercBundle.getAllERC20(bundleId))[1][rcnId]).toString(), (prevUserBalOnBundle.minus(web3.toWei(2.5))).toString());
        
        // withdraw ALL pepeCoin
        prevUserBal = await pepeCoin.balanceOf(user);
        prevPoachBal = await pepeCoin.balanceOf(poach.address);

        await ercBundle.withdraw(bundleId, poach.address, 1, user, {from:user});
        await poach.destroy(1, {from:user});

        assert.equal((await pepeCoin.balanceOf(user)).toString(), prevUserBal.plus(web3.toWei(6)).toString(), "check user2 Balance");
        assert.equal((await pepeCoin.balanceOf(poach.address)).toString(), prevPoachBal.minus(web3.toWei(6)).toString(), "check ercBundle Balance");

        const content = await ercBundle.content(bundleId);
        assert.equal(content[0].length, 0);
        assert.equal(content[1].length, 0);

        try { // try to withdraw a deleted ERC20 id
          await ercBundle.withdraw(bundleId, poach.address, 1, user, {from:user});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }
    });

    it("test withdraw erc721 from a bundle", async() => {
        await ercBundle.create({from: user});
        const bundleId = 1;

        // pokemons
        await pokemons.approve(ercBundle.address, pikachu, {from:user});
        await pokemons.approve(ercBundle.address, clefairy, {from:user});
        await ercBundle.depositBatch(bundleId, [pokemons.address, pokemons.address], [pikachu, clefairy], {from: user});
        
        assert.equal(await pokemons.ownerOf(clefairy), ercBundle.address);
        assert.equal(await pokemons.ownerOf(pikachu), ercBundle.address);

        // zombies
        await zombies.approve(ercBundle.address, theFirst, {from:user});
        await ercBundle.depositBatch(bundleId, [zombies.address], [theFirst], {from: user});
        
        // magic cards
        await magicCards.approve(ercBundle.address, orc, {from:user});
        await ercBundle.deposit(bundleId, magicCards.address, orc, {from: user});

        await ercBundle.withdraw(bundleId, pokemons.address, clefairy, user, {from: user});
        await ercBundle.withdraw(bundleId, pokemons.address, pikachu, user, {from: user});

        const content = await ercBundle.content(bundleId);
        assert.equal(content[0].length, 2);
        assert.equal(content[1].length, 2);
        assert.equal(content[0][0], zombies.address);
        assert.equal(content[1][0], theFirst);
        assert.equal(content[0][1], magicCards.address);
        assert.equal(content[1][1], orc);

        assert.equal(await pokemons.ownerOf(clefairy), user);
        assert.equal(await pokemons.ownerOf(pikachu), user);
    });
});
