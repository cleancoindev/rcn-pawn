let TestToken = artifacts.require("./TestToken.sol");
let TestERC721 = artifacts.require("./TestERC721.sol");

let Bundle = artifacts.require("./Bundle.sol");
let Poach = artifacts.require("./Poach.sol");

//global variables
//////////////////
const Helper = require("./helper.js");
const BigNumber = require('bignumber.js');
const precision = new BigNumber(10**18);

// Contracts
let bundle;
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

    before("Create the bundle contract", async function() {
      bundle = await Bundle.new();
    })

    beforeEach("Create Bundle, ERC20, ERC721 contracts", async function(){
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

        poach = await Poach.new();
    });

    it("test createBundle()", async() => {
        let receipt = await bundle.create({from: user2});
        const bundle1 = receipt.logs[1].args._tokenId;
        receipt = await bundle.create({from: user});
        const bundle2 = receipt.logs[1].args._tokenId;

        assert.equal(await bundle.ownerOf(2), user, "check bundle 2 ownership");

        await bundle.create({from: user});
        await bundle.create({from: user});
        await bundle.create({from: user2});
        await bundle.create({from: user});

        assert.equal(await bundle.balanceOf(user), 4, "ckeck user balance");
        assert.equal(await bundle.balanceOf(user2), 2, "ckeck user2 balance");

        const userBundles = await bundle.assetsOf(user);
        const user2Bundles = await bundle.assetsOf(user2);

        assert.equal(userBundles.length, 4, "ckeck user balance");
        assert.equal(user2Bundles.length, 2, "ckeck user2 balance");
    });

    it("test add erc20 to a bundle", async() => {
        const receipt = await bundle.create({from: user});
        const bundleId = receipt.logs[1].args._tokenId;

        const prevRcnBal = await rcn.balanceOf(user);
        const prevPepeCoinBal = await pepeCoin.balanceOf(user);

        await rcn.approve(poach.address, web3.toWei(5), {from:user});
        await pepeCoin.approve(poach.address, web3.toWei(6), {from:user});

        await poach.create(rcn.address, web3.toWei(5), {from:user});
        await poach.create(pepeCoin.address, web3.toWei(6), {from:user});
        await poach.setApprovalForAll(bundle.address, true, {from:user});

        await bundle.deposit(bundleId, poach.address, 0, {from:user});
        await bundle.deposit(bundleId, poach.address, 1, {from:user});

        // ckeck bundle balance
        assert.equal(await rcn.balanceOf(poach.address), web3.toWei(5), "ckeck bundle balance in rcn");
        assert.equal(await pepeCoin.balanceOf(poach.address), web3.toWei(6), "ckeck bundle balance in pepeCoin");
        assert.equal(await poach.ownerOf(0), bundle.address);
        assert.equal(await poach.ownerOf(1), bundle.address);
        // ckeck user balance
        assert.equal(await rcn.balanceOf(user), prevRcnBal - web3.toWei(5), "ckeck user balance in rcn");
        assert.equal(await pepeCoin.balanceOf(user), prevPepeCoinBal - web3.toWei(6), "ckeck user balance in pepeCoin");

        let content = await bundle.content(bundleId);
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

        assert.equal(await rcn.balanceOf(poach.address), web3.toWei(9), "ckeck bundle balance in rcn");

        content = await bundle.content(bundleId);
        assert.equal(content[0].length, 2);
        assert.equal(content[0].length, content[1].length);
        assert.equal(content[0][0], poach.address);
        assert.equal(content[1][0], 0);
        assert.equal(content[0][1], poach.address);
        assert.equal(content[1][1], 1);
    });

    it("test add erc721 to a bundle", async() => {
        const receipt = await bundle.create({from: user});
        const bundleId = receipt.logs[1].args._tokenId;
    
        // pokemons
        await pokemons.approve(bundle.address, pikachu, {from:user});
        await pokemons.approve(bundle.address, clefairy, {from:user});
        await bundle.depositBatch(bundleId, [pokemons.address, pokemons.address], [pikachu, clefairy], {from: user});
        // zombies
        await zombies.approve(bundle.address, theFirst, {from:user});
        await bundle.deposit(bundleId, zombies.address, theFirst, {from: user});
        // magic cards
        await magicCards.approve(bundle.address, orc, {from:user});
        await bundle.deposit(bundleId, magicCards.address, orc, {from: user});

        try { // try to add from other account
          await pokemons.approve(bundle.address, ratata, {from:user2});
          await bundle.depositBatch(bundleId, [pokemons.address], [ratata], {from:user});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        // add more non fungible token in a registered ERC721
        await magicCards.approve(bundle.address, ent, {from:user});
        await bundle.deposit(bundleId, magicCards.address, ent, {from: user});

        // check ownership
        assert.equal(await pokemons.ownerOf(pikachu), bundle.address);
        assert.equal(await pokemons.ownerOf(clefairy), bundle.address);
        assert.equal(await zombies.ownerOf(theFirst), bundle.address);
        assert.equal(await magicCards.ownerOf(orc), bundle.address);
        assert.equal(await magicCards.ownerOf(ent), bundle.address);

        const content = await bundle.content(bundleId);
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
        const receipt = await bundle.create({from: user});
        const bundleId = receipt.logs[1].args._tokenId;

        const prevRcnBal = await rcn.balanceOf(user);
        const prevPepeCoinBal = await pepeCoin.balanceOf(user);

        // add erc20
        await rcn.approve(poach.address, web3.toWei(5), {from:user});
        await pepeCoin.approve(poach.address, web3.toWei(6), {from:user});

        await poach.create(rcn.address, web3.toWei(5), {from:user});
        await poach.create(pepeCoin.address, web3.toWei(6), {from:user});
        await poach.setApprovalForAll(bundle.address, true, {from:user});

        await bundle.deposit(bundleId, poach.address, 0, {from:user});
        await bundle.deposit(bundleId, poach.address, 1, {from:user});

        // withdraw RCN
        let prevUserBal = await rcn.balanceOf(user);
        let prevUser2Bal = await rcn.balanceOf(user2);
        let prevPoachBal = await rcn.balanceOf(poach.address);

        // const rcnId = await bundle.getERC20Id(bundleId, rcn.address);

        await bundle.withdraw(bundleId, poach.address, 0, user2, {from:user});
        await poach.destroy(0, {from:user2});
        assert.equal((await rcn.balanceOf(user2)).toString(), prevUser2Bal.plus(web3.toWei(5)).toString(), "check user2 Balance");
        assert.equal((await rcn.balanceOf(user)).toString(), prevUserBal.toString(), "check user Balance");
        assert.equal((await rcn.balanceOf(poach.address)).toString(), prevPoachBal.minus(web3.toWei(5)).toString(), "check bundle Balance");
        // assert.equal(((await bundle.getAllERC20(bundleId))[1][rcnId]).toString(), (prevUserBalOnBundle.minus(web3.toWei(2.5))).toString());

        // withdraw ALL pepeCoin
        prevUserBal = await pepeCoin.balanceOf(user);
        prevPoachBal = await pepeCoin.balanceOf(poach.address);

        await bundle.withdraw(bundleId, poach.address, 1, user, {from:user});
        await poach.destroy(1, {from:user});

        assert.equal((await pepeCoin.balanceOf(user)).toString(), prevUserBal.plus(web3.toWei(6)).toString(), "check user2 Balance");
        assert.equal((await pepeCoin.balanceOf(poach.address)).toString(), prevPoachBal.minus(web3.toWei(6)).toString(), "check bundle Balance");

        const content = await bundle.content(bundleId);
        assert.equal(content[0].length, 0);
        assert.equal(content[1].length, 0);

        try { // try to withdraw a deleted ERC20 id
          await bundle.withdraw(bundleId, poach.address, 1, user, {from:user});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }
    });

    it("test withdraw erc721 from a bundle", async() => {
        const receipt = await bundle.create({from: user});
        const bundleId = receipt.logs[1].args._tokenId;
        // pokemons
        await pokemons.approve(bundle.address, pikachu, {from:user});
        await pokemons.approve(bundle.address, clefairy, {from:user});
        await bundle.depositBatch(bundleId, [pokemons.address, pokemons.address], [pikachu, clefairy], {from: user});

        assert.equal(await pokemons.ownerOf(clefairy), bundle.address);
        assert.equal(await pokemons.ownerOf(pikachu), bundle.address);

        // zombies
        await zombies.approve(bundle.address, theFirst, {from:user});
        await bundle.depositBatch(bundleId, [zombies.address], [theFirst], {from: user});

        // magic cards
        await magicCards.approve(bundle.address, orc, {from:user});
        await bundle.deposit(bundleId, magicCards.address, orc, {from: user});

        await bundle.withdraw(bundleId, pokemons.address, clefairy, user, {from: user});
        await bundle.withdraw(bundleId, pokemons.address, pikachu, user, {from: user});

        const content = await bundle.content(bundleId);
        assert.equal(content[0].length, 2);
        assert.equal(content[1].length, 2);
        assert.equal(content[0][0], zombies.address);
        assert.equal(content[1][0], theFirst);
        assert.equal(content[0][1], magicCards.address);
        assert.equal(content[1][1], orc);

        assert.equal(await pokemons.ownerOf(clefairy), user);
        assert.equal(await pokemons.ownerOf(pikachu), user);
    });

    it("Should withdraw a single item from a bundle", async() => {
      const receipt = await bundle.create({from: user});
      const bundleId = receipt.logs[1].args._tokenId;
      
      await pokemons.approve(bundle.address, pikachu, {from:user});
      await pokemons.approve(bundle.address, clefairy, {from:user});
      await bundle.depositBatch(bundleId, [pokemons.address, pokemons.address], [pikachu, clefairy], {from: user});

      await bundle.withdraw(bundleId, pokemons.address, clefairy, user, {from: user});
      assert.equal(await pokemons.ownerOf(clefairy), user);
      assert.equal(await pokemons.ownerOf(pikachu), bundle.address);

      await bundle.withdraw(bundleId, pokemons.address, pikachu, user, {from: user});
      assert.equal(await pokemons.ownerOf(pikachu), user);
    })

    it("Should not allow to withdraw if lacks permissions", async() => {
      const receipt = await bundle.create({from: user});
      const bundleId = receipt.logs[1].args._tokenId;
      
      await pokemons.approve(bundle.address, pikachu, {from:user});
      await pokemons.approve(bundle.address, clefairy, {from:user});
      await bundle.depositBatch(bundleId, [pokemons.address, pokemons.address], [pikachu, clefairy], {from: user});

      try { // try to withdraw a deleted ERC20 id
        await bundle.withdraw(bundleId, pokemons.address, clefairy, user, {from: user2});
        assert(false, "throw was expected in line above.")
      } catch(e){
        assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
      }

      assert.equal(await pokemons.ownerOf(clefairy), bundle.address);
      assert.equal(await pokemons.ownerOf(pikachu), bundle.address);

      try { // try to withdraw a deleted ERC20 id
        await bundle.withdraw(bundleId, pokemons.address, pikachu, user2, {from: user2});
        assert(false, "throw was expected in line above.")
      } catch(e){
        assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
      }

      assert.equal(await pokemons.ownerOf(clefairy), bundle.address);
      assert.equal(await pokemons.ownerOf(pikachu), bundle.address);
    })

    it("Should withdraw a list of items", async() => {
      const receipt = await bundle.create({from: user});
      const bundleId = receipt.logs[1].args._tokenId;
      
      await pokemons.setApprovalForAll(bundle.address, true, {from:user});
      await magicCards.setApprovalForAll(bundle.address, true, {from:user});
      await pokemons.transferFrom(user2, user, ratata, {from:user2})

      const tokens = [pokemons.address, pokemons.address, pokemons.address, pokemons.address, magicCards.address, pokemons.address]
      const items = [pikachu, clefairy, ratata, mewtwo, ent, vulpix]

      await bundle.depositBatch(bundleId, tokens, items, {from: user});
      await bundle.transferFrom(user, user2, bundleId, {from: user})

      const wtokens = [pokemons.address, pokemons.address, magicCards.address]
      const witems = [pikachu, mewtwo, ent]

      await bundle.withdrawBatch(bundleId, wtokens, witems, user2, {from:user2})
      assert.equal(await pokemons.ownerOf(pikachu), user2);
      assert.equal(await pokemons.ownerOf(clefairy), bundle.address);
      assert.equal(await pokemons.ownerOf(vulpix), bundle.address);
      assert.equal(await pokemons.ownerOf(mewtwo), user2);
      assert.equal(await magicCards.ownerOf(ent), user2);
      assert.equal(await pokemons.ownerOf(vulpix), bundle.address);
    })

    it("Should fail to withdraw a list of items", async() => {
      const receipt = await bundle.create({from: user});
      const bundleId = receipt.logs[1].args._tokenId;
      
      await pokemons.setApprovalForAll(bundle.address, true, {from:user});
      await magicCards.setApprovalForAll(bundle.address, true, {from:user});
      await pokemons.transferFrom(user2, user, ratata, {from:user2})

      const tokens = [pokemons.address, pokemons.address, pokemons.address, pokemons.address, magicCards.address, pokemons.address]
      const items = [pikachu, clefairy, ratata, mewtwo, ent, vulpix]

      await bundle.depositBatch(bundleId, tokens, items, {from: user});
      await bundle.transferFrom(user, user2, bundleId, {from: user})

      const wtokens = [pokemons.address, pokemons.address, magicCards.address]
      const witems = [pikachu, mewtwo, ent]

      try { // try to withdraw a deleted ERC20 id
        await bundle.withdrawBatch(bundleId, wtokens, witems, user2, {from:user})
        assert(false, "throw was expected in line above.")
      } catch(e){
        assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
      }

      assert.equal(await pokemons.ownerOf(pikachu), bundle.address);
      assert.equal(await pokemons.ownerOf(clefairy), bundle.address);
      assert.equal(await pokemons.ownerOf(vulpix), bundle.address);
      assert.equal(await pokemons.ownerOf(mewtwo), bundle.address);
      assert.equal(await magicCards.ownerOf(ent), bundle.address);
      assert.equal(await pokemons.ownerOf(vulpix), bundle.address);
    })

    it("Should withdraw all items", async() => {
      const receipt = await bundle.create({from: user});
      const bundleId = receipt.logs[1].args._tokenId;
      
      await pokemons.setApprovalForAll(bundle.address, true, {from:user});
      await magicCards.setApprovalForAll(bundle.address, true, {from:user});
      await pokemons.transferFrom(user2, user, ratata, {from:user2})

      const tokens = [pokemons.address, pokemons.address, pokemons.address, pokemons.address, magicCards.address, pokemons.address]
      const items = [pikachu, clefairy, ratata, mewtwo, ent, vulpix]

      await bundle.depositBatch(bundleId, tokens, items, {from: user});
      await bundle.transferFrom(user, user2, bundleId, {from: user})

      await bundle.withdrawAll(bundleId, user2, {from:user2})
      assert.equal((await bundle.content(bundleId))[0].length, 0);
      assert.equal(await pokemons.ownerOf(pikachu), user2);
      assert.equal(await pokemons.ownerOf(clefairy), user2);
      assert.equal(await pokemons.ownerOf(vulpix), user2);
      assert.equal(await pokemons.ownerOf(mewtwo), user2);
      assert.equal(await magicCards.ownerOf(ent), user2);
      assert.equal(await pokemons.ownerOf(vulpix), user2);
    })
});
