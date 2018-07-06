let TestToken = artifacts.require("./TestToken.sol");
let TestERC721 = artifacts.require("./TestERC721.sol");

let ErcBundle = artifacts.require("./ErcBundle.sol");
//global variables
//////////////////
const Helper = require("./helper.js");
const BigNumber = require('bignumber.js');
const precision = new BigNumber(10**18);

// Contracts
let ercBundle;
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

contract('TestErcBundle', function(accounts) {
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
    });

    it("test createBundle()", async() => {
        await ercBundle.createBundle({from: user2});
        await ercBundle.createBundle({from: user});
        const bundleId = 1;

        assert.equal(await ercBundle.ownerOf(bundleId), user, "ckeck bundleId(1) ownership");

        await ercBundle.createBundle({from: user});
        await ercBundle.createBundle({from: user});
        await ercBundle.createBundle({from: user2});
        await ercBundle.createBundle({from: user});

        assert.equal(await ercBundle.balanceOf(user), 4, "ckeck user balance");
        assert.equal(await ercBundle.balanceOf(user2), 2, "ckeck user2 balance");

        const userBundles = await ercBundle.bundleOfOwner(user);
        const user2Bundles = await ercBundle.bundleOfOwner(user2);

        assert.equal(userBundles.length, 4, "ckeck user balance");
        assert.equal(user2Bundles.length, 2, "ckeck user2 balance");
    });

    it("test add erc20 to a bundle", async() => {
        await ercBundle.createBundle({from: user});
        const prevRcnBal = await rcn.balanceOf(user);
        const prevPepeCoinBal = await pepeCoin.balanceOf(user);
        const bundleId = 0;

        try { // try to add from other account
          await rcn.approve(ercBundle.address, web3.toWei(5), {from:user2});
          await ercBundle.addERC20ToBundle(bundleId, rcn.address, web3.toWei(5), {from:user});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        await rcn.approve(ercBundle.address, web3.toWei(5), {from:user});
        await pepeCoin.approve(ercBundle.address, web3.toWei(6), {from:user});

        await ercBundle.addERC20ToBundle(bundleId, rcn.address, web3.toWei(5), {from:user});
        await ercBundle.addERC20ToBundle(bundleId, pepeCoin.address, web3.toWei(6), {from:user});
        // ckeck ercBundle balance
        assert.equal(await rcn.balanceOf(ercBundle.address), web3.toWei(5), "ckeck ercBundle balance in rcn");
        assert.equal(await pepeCoin.balanceOf(ercBundle.address), web3.toWei(6), "ckeck ercBundle balance in pepeCoin");
        // ckeck user balance
        assert.equal(await rcn.balanceOf(user), prevRcnBal - web3.toWei(5), "ckeck user balance in rcn");
        assert.equal(await pepeCoin.balanceOf(user), prevPepeCoinBal - web3.toWei(6), "ckeck user balance in pepeCoin");

        const addrs = (await ercBundle.getAllERC20(bundleId))[0];
        const amount = (await ercBundle.getAllERC20(bundleId))[1];

        assert.equal(addrs[0], rcn.address);
        assert.equal(amount[0], web3.toWei(5));
        assert.equal(addrs[1], pepeCoin.address);
        assert.equal(amount[1], web3.toWei(6));
        // add more token in a registered ERC20
        await rcn.approve(ercBundle.address, web3.toWei(5), {from:user});
        await ercBundle.addERC20ToBundle(bundleId, rcn.address, web3.toWei(4), {from:user});
        assert.equal((await ercBundle.getAllERC20(bundleId))[1][0], web3.toWei(9));
    });

    it("test add erc721 to a bundle", async() => {
        await ercBundle.createBundle({from: user});
        const bundleId = 0;

        // pokemons
        await pokemons.approve(ercBundle.address, pikachu, {from:user});
        await pokemons.approve(ercBundle.address, clefairy, {from:user});
        await ercBundle.addERC721ToBundle(bundleId, pokemons.address, [pikachu, clefairy], {from: user});
        // zombies
        await zombies.approve(ercBundle.address, theFirst, {from:user});
        await ercBundle.addERC721ToBundle(bundleId, zombies.address, [theFirst], {from: user});
        // magic cards
        await magicCards.approve(ercBundle.address, orc, {from:user});
        await ercBundle.addERC721ToBundle(bundleId, magicCards.address, [orc], {from: user});

        try { // try to add from other account
          await pokemons.approve(ercBundle.address, ratata, {from:user2});
          await ercBundle.addERC721ToBundle(bundleId, pokemons.address, [ratata], {from:user});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        try { // try to add a empty array of non fungible token
          await ercBundle.addERC721ToBundle(bundleId, pokemons.address, [], {from:user});
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }

        // add more non fungible token in a registered ERC721
        await magicCards.approve(ercBundle.address, ent, {from:user});
        await ercBundle.addERC721ToBundle(bundleId, magicCards.address, [ent], {from: user});

        // check ownership
        assert.equal(await pokemons.ownerOf(pikachu), ercBundle.address);
        assert.equal(await pokemons.ownerOf(clefairy), ercBundle.address);
        assert.equal(await zombies.ownerOf(theFirst), ercBundle.address);
        assert.equal(await magicCards.ownerOf(orc), ercBundle.address);
        assert.equal(await magicCards.ownerOf(ent), ercBundle.address);
        // check ERC721 addresses
        const addrs = await ercBundle.getERC721Addrs(bundleId);
        assert.equal(addrs.length, 3);
        assert.equal(addrs[0], pokemons.address);
        assert.equal(addrs[1], zombies.address);
        assert.equal(addrs[2], magicCards.address);
        // check ERC721 non fungible tokens
        const pokemonsNfts = await ercBundle.getERC721Nfts(bundleId, pokemons.address);
        assert.equal(pokemonsNfts.length, 2);
        assert.equal(pokemonsNfts[0], pikachu);
        assert.equal(pokemonsNfts[1], clefairy);
        const zombiesNfts = await ercBundle.getERC721Nfts(bundleId, zombies.address);
        assert.equal(zombiesNfts.length, 1);
        assert.equal(zombiesNfts[0], theFirst);
        const magicCardsNfts = await ercBundle.getERC721Nfts(bundleId, magicCards.address);
        assert.equal(magicCardsNfts.length, 2);
        assert.equal(magicCardsNfts[0], orc);
        assert.equal(magicCardsNfts[1], ent);
    });

    it("test withdraw erc20 from a bundle", async() => {
        await ercBundle.createBundle({from: user});
        const prevRcnBal = await rcn.balanceOf(user);
        const prevPepeCoinBal = await pepeCoin.balanceOf(user);
        const bundleId = 0;
        // add erc20
        await rcn.approve(ercBundle.address, web3.toWei(5), {from:user});
        await pepeCoin.approve(ercBundle.address, web3.toWei(6), {from:user});
        await ercBundle.addERC20ToBundle(bundleId, rcn.address, web3.toWei(5), {from:user});
        await ercBundle.addERC20ToBundle(bundleId, pepeCoin.address, web3.toWei(6), {from:user});
        // withdraw RCN
        let prevUserBal = new BigNumber(await rcn.balanceOf(user));
        let prevUser2Bal = new BigNumber(await rcn.balanceOf(user2));
        let prevErcBundleBal = new BigNumber(await rcn.balanceOf(ercBundle.address));
        const rcnId = await ercBundle.getERC20Id(bundleId, rcn.address);
        let prevUserBalOnBundle = (await ercBundle.getAllERC20(bundleId))[1][rcnId];

        await ercBundle.withdrawERC20(bundleId, rcnId, user2, web3.toWei(2.5), {from:user});
        assert.equal((await rcn.balanceOf(user2)).toString(), prevUser2Bal.plus(web3.toWei(2.5)).toString(), "check user2 Balance");
        assert.equal((await rcn.balanceOf(user)).toString(), prevUserBal.toString(), "check user Balance");
        assert.equal((await rcn.balanceOf(ercBundle.address)).toString(), prevErcBundleBal.minus(web3.toWei(2.5)).toString(), "check ercBundle Balance");
        assert.equal(((await ercBundle.getAllERC20(bundleId))[1][rcnId]).toString(), (prevUserBalOnBundle.minus(web3.toWei(2.5))).toString());
        // withdraw ALL pepeCoin
        prevUserBal = new BigNumber(await pepeCoin.balanceOf(user));
        prevErcBundleBal = new BigNumber(await pepeCoin.balanceOf(ercBundle.address));
        let pepeCoinId = await ercBundle.getERC20Id(bundleId, pepeCoin.address);

        await ercBundle.withdrawERC20(bundleId, pepeCoinId, user, web3.toWei(6), {from:user});
        assert.equal((await pepeCoin.balanceOf(user)).toString(), prevUserBal.plus(web3.toWei(6)).toString(), "check user2 Balance");
        assert.equal((await pepeCoin.balanceOf(ercBundle.address)).toString(), prevErcBundleBal.minus(web3.toWei(6)).toString(), "check ercBundle Balance");

        assert.equal((await ercBundle.getAllERC20(bundleId))[0].length, 1);
        assert.equal((await ercBundle.getAllERC20(bundleId))[1].length, 1);

        try { // try to get a delete ERC20 id
          await ercBundle.getERC20Id(bundleId, pepeCoin.address);
          assert(false, "throw was expected in line above.")
        } catch(e){
          assert(Helper.isRevertErrorMessage(e), "expected throw but got: " + e);
        }
    });

    it("test withdraw erc721 from a bundle", async() => {
        await ercBundle.createBundle({from: user});
        const bundleId = 0;

        // pokemons
        await pokemons.approve(ercBundle.address, pikachu, {from:user});
        await pokemons.approve(ercBundle.address, clefairy, {from:user});
        await ercBundle.addERC721ToBundle(bundleId, pokemons.address, [pikachu, clefairy], {from: user});
        // zombies
        await zombies.approve(ercBundle.address, theFirst, {from:user});
        await ercBundle.addERC721ToBundle(bundleId, zombies.address, [theFirst], {from: user});
        // magic cards
        await magicCards.approve(ercBundle.address, orc, {from:user});
        await ercBundle.addERC721ToBundle(bundleId, magicCards.address, [orc], {from: user});

        let pokemonsId = await ercBundle.getERC721Id(bundleId, pokemons.address);
        let clefairyId = await ercBundle.getNftId(bundleId, pokemons.address, clefairy);
        let pikachuId = await ercBundle.getNftId(bundleId, pokemons.address, pikachu);

        const prevAddrs = await ercBundle.getERC721Addrs(bundleId);
        assert.equal(prevAddrs.length, 3);
        const prevPokemonsNfts = await ercBundle.getERC721Nfts(bundleId, pokemons.address);
        assert.equal(prevPokemonsNfts.length, 2);
        await ercBundle.withdrawERC721(bundleId, pokemonsId, user, clefairyId, {from: user});
        await ercBundle.withdrawERC721(bundleId, pokemonsId, user, pikachuId, {from: user});
        const postPokemonsNfts = await ercBundle.getERC721Nfts(bundleId, pokemons.address);
        assert.equal(postPokemonsNfts.length, 0);

        const postAddrs = await ercBundle.getERC721Addrs(bundleId);
        assert.equal(postAddrs.length, 2);
        assert.equal(await pokemons.ownerOf(clefairy), user);
        assert.equal(await pokemons.ownerOf(pikachu), user);
    });
});
