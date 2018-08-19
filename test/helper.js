function toInterestRate(interest, time) {
    return Math.trunc((10000000 / interest) * 360 * time);
}

function now() {
    return web3.eth.getBlock('latest').timestamp;
};

async function timeTravel(seconds) {
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [seconds], id: 0});
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});
};

function isRevertErrorMessage( error ) {
    if( error.message.search('invalid opcode') >= 0 ) return true;
    if( error.message.search('revert') >= 0 ) return true;
    if( error.message.search('out of gas') >= 0 ) return true;
    return false;
};

function toBytes32(source) {
    source = web3.toHex(source);
    const rl = 64;
    source = source.toString().replace("0x", "");
    if (source.length < rl) {
        const diff = 64 - source.length;
        source = "0".repeat(diff) + source;
    }
    return "0x" + source;
}

function hexArrayToBytesOfBytes32(array) {
    let bytes = "0x";
    for(let i = 0; i < array.length; i++){
        let bytes32 = array[i].toString().replace("0x", "");
        if (bytes32.length < 64) {
            const diff = 64 - bytes32.length;
            bytes32 = "0".repeat(diff) + bytes32;
        }
        bytes += bytes32;
    }

    return bytes;
}

async function approveAll(owner, to, nftArray) {
    for(let i = 0; i < nftArray.length; i++)
        await erc721.approve(to, nftArray[i], {from: owner});
};

module.exports = {toInterestRate, now, timeTravel, isRevertErrorMessage, toBytes32, hexArrayToBytesOfBytes32, approveAll};
