module.exports.address0x = '0x0000000000000000000000000000000000000000';
module.exports.bytes320x = '0x0000000000000000000000000000000000000000000000000000000000000000';

module.exports.increaseTime = async (delta) => {
    await web3.currentProvider.send({ jsonrpc: '2.0', method: 'evm_increaseTime', params: [delta], id: 0 });
    await web3.currentProvider.send({ jsonrpc: '2.0', method: 'evm_mine', params: [], id: 0 });
};

module.exports.now = async () => {
    return (await web3.eth.getBlock('pending')).timestamp;
};

module.exports.assertThrow = async (promise) => {
    try {
        await promise;
    } catch (error) {
        const invalidJump = error.message.search('invalid JUMP') >= 0;
        const revert = error.message.search('revert') >= 0;
        const invalidOpcode = error.message.search('invalid opcode') > 0;
        const outOfGas = error.message.search('out of gas') >= 0;
        assert(
            invalidJump || outOfGas || revert || invalidOpcode,
            'Expected throw, got \'' + error + '\' instead',
        );
        return;
    }
    assert.fail('Expected throw not received');
};

// the promiseFunction should be a function
module.exports.tryCatchRevert = async (promise, message) => {
    let headMsg = 'revert ';
    if (message === '') {
        headMsg = headMsg.slice(0, headMsg.length - 1);
        console.warn('    \u001b[93m\u001b[2m\u001b[1m⬐ Warning:\u001b[0m\u001b[30m\u001b[1m There is an empty revert/require message');
    }
    try {
        if (promise instanceof Function) {
            await promise();
        } else {
            await promise;
        }
    } catch (error) {
        assert(
            error.message.search(headMsg + message) >= 0 || process.env.SOLIDITY_COVERAGE,
            'Expected a revert \'' + headMsg + message + '\', got ' + error.message + '\' instead'
        );
        return;
    }
    assert.fail('Expected throw not received');
};

module.exports.toInterestRate = (interest) => {
    return Math.floor((10000000 / interest) * 360 * 86400);
};
