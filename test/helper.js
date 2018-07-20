module.exports.toInterestRate = function(r) {
    return Math.trunc(10000000/r);
}

module.exports.now = function() {
    return web3.eth.getBlock('latest').timestamp;
};

module.exports.timeTravel = async seconds => {
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [seconds], id: 0});
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});
};

module.exports.isRevertErrorMessage = function( error ) {
    if( error.message.search('invalid opcode') >= 0 ) return true;
    if( error.message.search('revert') >= 0 ) return true;
    if( error.message.search('out of gas') >= 0 ) return true;
    return false;
};

module.exports.hexArrayToBytesOfBytes32 = function(array) {
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

module.exports.approveAll = async (owner, to, nftArray) => {
    for(let i = 0; i < nftArray.length; i++)
        await erc721.approve(to, nftArray[i], {from: owner});
};
