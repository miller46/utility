var Web3 = require('web3');
var SolidityFunction = require('web3/lib/web3/function.js');
var keythereum = require('keythereum');
var ethUtil = require('ethereumjs-util');
var utils = require('web3/lib/utils/utils.js');
var sha3 = require('web3/lib/utils/sha3.js');
var coder = require('web3/lib/solidity/coder.js');
var Tx = require('ethereumjs-tx');

var fileUtility = require('./file.js');
var networkUtility = require('./network.js');

var etherscanApiKey = "";
var networkName = "";

function initWeb3(web3, provider, proxyConfig) {
    if (typeof web3 !== 'undefined' && typeof Web3 !== 'undefined') {
        //is MetaMask
        web3 = new Web3(web3.currentProvider);
    } else {
        web3 = new Web3(new Web3.providers.HttpProvider(provider));
    }

    if (proxyConfig) {
        if (proxyConfig.network) {
            networkName = proxyConfig.network;
        } else {
            networkName = "mainnet";
        }

        if (!proxyConfig.etherscanApiKey) {
            throw "Etherscan API key required for proxy"
        } else {
            etherscanApiKey = proxyConfig.etherscanApiKey;
        }
    }

    return web3;
}

function hexToString(web3, hex) {
    return web3.utils.hexToAscii(hex)
}

function loadContract(web3, baseUrl, contractAbiFile, address, callback) {
    fileUtility.readLocalFile(baseUrl, contractAbiFile, function(readError, abi) {
        if (readError) {
            callback(readError, undefined);
        } else {
            try {
                var contract = web3.eth.contract(JSON.parse(abi)).at(address);
                callback(undefined, contract);
            } catch (contractError) {
                callback(contractError, undefined);
            }
        }
    });
}

function call(web3, contract, address, functionName, args, callback) {
    function proxy(retries) {
        var web3 = new Web3();
        var data = contract[functionName].getData.apply(null, args);
        var result = undefined;
        var url = getProxyUrlForCall(address, data);

        networkUtility.get(url, {}, function(err, body){
            if (!err) {
                try {
                    result = JSON.parse(body);
                    var functionAbi = contract.abi.find(function(element, index, array) {return element.name === functionName});
                    var solidityFunction = new SolidityFunction(web3.Eth, functionAbi, address);
                    var result = solidityFunction.unpackOutput(result['result']);
                    callback(undefined, result);
                } catch (err) {
                    if (retries > 0) {
                        setTimeout(function(){
                            proxy(retries - 1);
                        }, 1000);
                    } else {
                        callback(err, undefined);
                    }
                }
            } else {
                callback(err, undefined);
            }
        });
    }
    proxy(1);

    try {
        if (web3.currentProvider) {
            var data = contract[functionName].getData.apply(null, args);
            web3.eth.call({to: address, data: data}, function(err, result){
                if (!err) {
                    var functionAbi = contract.abi.find(function(element, index, array) {return element.name === functionName});
                    var solidityFunction = new SolidityFunction(web3.Eth, functionAbi, address);
                    try {
                        var unpackedResult = solidityFunction.unpackOutput(result);
                        callback(undefined, unpackedResult);
                    } catch (err) {
                        proxy(1);
                    }
                } else {
                    proxy(1);
                }
            });
        } else {
            proxy(1);
        }
    } catch(err) {
        proxy(1);
    }
}

function callContractFunction(web3, contract, address, functionName, args, callback) {
    function proxy(retries) {
        const web3 = new Web3();
        const data = contract[functionName].getData.apply(null, args);
        var url = getProxyUrlForCall(address, data);
        networkUtility.get(url, {}, function(err, body) {
            if (!err) {
                try {
                    var result = JSON.parse(body);
                    var functionAbi = contract.abi.find(function(element, index, array) {return element.name === functionName});
                    var solidityFunction = new SolidityFunction(web3.Eth, functionAbi, address);
                    var resultUnpacked = solidityFunction.unpackOutput(result.result);
                    callback(undefined, resultUnpacked);
                } catch (errJson) {
                    if (retries > 0) {
                        setTimeout(function() {
                            proxy(retries - 1);
                        }, 1000);
                    } else {
                        callback(errJson, undefined);
                    }
                }
            } else {
                callback(err, undefined);
            }
        });
    }
    try {
        if (web3.currentProvider) {
            var data = contract[functionName].getData.apply(null, args);
            web3.eth.call({to: address, data: data}, function(callError, result) {
                if (!callError) {
                    var functionAbi = contract.abi.find(function(element, index, array) {
                        return element.name === functionName
                    });
                    var solidityFunction = new SolidityFunction(web3.Eth, functionAbi, address);
                    try {
                        var output = solidityFunction.unpackOutput(result);
                        callback(undefined, output);
                    } catch (resultError) {
                        callback(resultError, undefined);
                    }
                } else {
                    callback(callError, undefined);
                }
            });
        } else {
            proxy(1);
        }
    } catch(contractError) {
        callback(contractError, undefined);
    }
}

function send(web3, contract, address, functionName, args, fromAddress, privateKey, nonce, callback) {
    if (privateKey && privateKey.substring(0,2) === '0x') {
        privateKey = privateKey.substring(2,privateKey.length);
    }
    function encodeConstructorParams(abi, params) {
        return abi.filter(function (json) {
            return json.type === 'constructor' && json.inputs.length === params.length;
        }).map(function (json) {
            return json.inputs.map(function (input) {
                return input.type;
            });
        }).map(function (types) {
            return coder.encodeParams(types, params);
        })[0] || '';
    }
    args = Array.prototype.slice.call(args).filter(function (a) {return a !== undefined; });
    var options = {};
    if (typeof(args[args.length - 1]) === 'object' && args[args.length - 1].gas !== undefined) {
        args[args.length - 1].gasPrice = args[args.length - 1].price;
        args[args.length - 1].gasLimit = args[args.length - 1].gas;
        delete args[args.length - 1].gas;
        delete args[args.length - 1].price;
    }
    if (utils.isObject(args[args.length - 1])) {
        options = args.pop();
    }
    getNextNonce(web3, fromAddress, function(err, nextNonce) {
        if (nonce === undefined || nonce < nextNonce) {
            nonce = nextNonce;
        }
        console.log("Nonce:", nonce);
        options.nonce = nonce;
        if (functionName === "constructor") {
            if (options.data.slice(0,2) !== "0x") {
                options.data = '0x' + options.data;
            }
            var encodedParams = encodeConstructorParams(contract.abi, args);
            console.log(encodedParams);
            options.data += encodedParams;
        } else if (contract === undefined || functionName === undefined) {
            options.to = address;
        } else {
            options.to = address;
            var functionAbi = contract.abi.find(function(element, index, array) {
                return element.name === functionName
            });
            var inputTypes = functionAbi.inputs.map(function(x) {return x.type});
            var typeName = inputTypes.join();
            options.data = '0x' + sha3(functionName + '(' + typeName+')').slice(0, 8) + coder.encodeParams(inputTypes, args);
        }
        var tx;
        try {
            tx = new Tx(options);
            function proxy() {
                if (privateKey) {
                    signTx(web3, fromAddress, tx, privateKey, function (errSignTx, txSigned) {
                        if (!errSignTx) {
                            var serializedTx = txSigned.serialize().toString('hex');
                            var url = getBaseProxyUrl();
                            var formData = {module: 'proxy', action: 'eth_sendRawTransaction', hex: serializedTx, apikey: etherscanApiKey};
                            networkUtility.post(url, {}, formData, function (errPostURL, body) {
                                if (!errPostURL) {
                                    try {
                                        const result = JSON.parse(body);
                                        if (result.result) {
                                            callback(undefined, {txHash: result.result, nonce: nonce + 1});
                                        } else if (result.error) {
                                            callback(result.error.message, {txHash: undefined, nonce: nonce});
                                        }
                                    } catch (errTry) {
                                        callback(errTry, {txHash: undefined, nonce: nonce});
                                    }
                                } else {
                                    callback(err, {txHash: undefined, nonce: nonce});
                                }
                            });
                        } else {
                            console.log(err);
                            callback('Failed to sign transaction', {txHash: undefined, nonce: nonce});
                        }
                    });
                } else {
                    callback('Failed to sign transaction', {txHash: undefined, nonce: nonce});
                }
            }
        } catch (err) {
            callback(err, undefined);
        }

        try {
            if (web3.currentProvider) {
                options.from = fromAddress;
                options.gas = options.gasLimit;
                delete options.gasLimit;
                web3.eth.sendTransaction(options, function(err, hash) {
                    if (!err) {
                        callback(undefined, {txHash: hash, nonce: nonce + 1});
                    } else {
                        console.log(err);
                        proxy();
                    }
                })
            } else {
                proxy();
            }
        } catch (err) {
            proxy();
        }
    });
}

function signTx(web3, address, tx, privateKey, callback) {
    if (privateKey) {
        tx.sign(new Buffer(privateKey, 'hex'));
        callback(undefined, tx);
    } else {
        var msgHash = '0x' + tx.hash(false).toString('hex');
        web3.eth.sign(web3, address, msgHash, function(err, sig) {
            if (!err) {
                try {
                    function hexToUint8array(s) {
                        if (s.slice(0,2) === '0x') s=s.slice(2);
                        var ua = new Uint8Array(s.length);
                        for (var i = 0; i < s.length; i++) {
                            ua[i] = s.charCodeAt(i);
                        }
                        return ua;
                    }
                    var r = sig.slice(0, 66);
                    var s = '0x' + sig.slice(66, 130);
                    var v = web3.toDecimal('0x' + sig.slice(130, 132));
                    if (v !== 27 && v !== 28) v += 27;
                    sig = {r: hexToUint8array(r), s: hexToUint8array(s), v: hexToUint8array(v.toString(16))};
                    tx.r = r;
                    tx.s = s;
                    tx.v = v;
                    callback(undefined, tx);
                } catch (err) {
                    callback(err, undefined);
                }
            } else {
                callback(err, undefined);
            }
        });
    }
}

function sign(web3, address, value, privateKey, callback) {
    if (privateKey) {
        if (privateKey.substring(0,2) === '0x') {
            privateKey = privateKey.substring(2,privateKey.length);
        }
        if (value.substring(0,2) === '0x') {
            value = value.substring(2, value.length);
        }
        try {
            var sig = ethUtil.ecsign(new Buffer(value, 'hex'), new Buffer(privateKey, 'hex'));
            var r = '0x' + sig.r.toString('hex');
            var s = '0x' + sig.s.toString('hex');
            var v = sig.v;
            var result = {r: r, s: s, v: v};
            callback(undefined, result);
        } catch (err) {
            callback(err, undefined);
        }
    } else {
        web3.eth.sign(address, value, function(err, sig) {
            if (err && value.slice(0,2) !== '0x') {
                sign(web3, address, '0x' + value, privateKey, callback);
            } else if (!err) {
                try {
                    var r = sig.slice(0, 66);
                    var s = '0x' + sig.slice(66, 130);
                    var v = web3.toDecimal('0x' + sig.slice(130, 132));
                    if (v !== 27 && v !== 28) v+=27;
                    callback(undefined, {r: r, s: s, v: v});
                } catch (err) {
                    callback(err, undefined);
                }
            } else {
                callback(err, undefined);
            }
        });
    }
}

function getNextNonce(web3, address, callback) {
    function proxy() {
        var url = getProxyUrlForNonce(address);
        networkUtility.get(url, {}, function(err, body) {
            if (!err) {
                var result = JSON.parse(body);
                var nextNonce = Number(result['result']);
                callback(undefined, nextNonce);
            } else {
                callback(err, undefined);
            }
        });
    }

    try {
        if (web3.currentProvider) {
            web3.eth.getTransactionCount(address, function(err, result) {
                if (!err) {
                    var nextNonce = Number(result);
                    //Note. initial nonce is 2^20 on testnet, but getTransactionCount already starts at 2^20.
                    callback(undefined, nextNonce);
                } else {
                    proxy();
                }
            });
        } else {
            proxy();
        }
    } catch(err) {
        proxy();
    }
}

function createAccount() {
    var privateKey = keythereum.create().privateKey;
    var publicKey = ethUtil.privateToPublic(privateKey);
    var address = ethUtil.privateToAddress(privateKey);
    address = ethUtil.toChecksumAddress(address.toString('hex'));
    publicKey = publicKey.toString('hex');
    privateKey = privateKey.toString('hex');
    return {
        address: address,
        publicKey: publicKey,
        privateKey: privateKey
    };
}

function getProxyUrlForCall(address, data) {
    var baseUrl = getBaseProxyUrl();
    return baseUrl + "?module=proxy&action=eth_Call&to=" + address + "&data=" + data + "&apikey=" + etherscanApiKey;
}

function getProxyUrlForNonce(address, data) {
    var baseUrl = getBaseProxyUrl();
    return baseUrl + '?module=proxy&action=' + 'eth_getTransactionCount&address=' + address + '&tag=latest'
        + '&apikey=' + etherscanApiKey;
}

function getBaseProxyUrl() {
    return networkName !== "mainnet" ? "https://" + networkName + ".etherscan.io/api" : "https://etherscan.io/api";
}

exports.initWeb3 = initWeb3;
exports.hexToString = hexToString;
exports.loadContract = loadContract;
exports.callContractFunction = callContractFunction;
exports.call = call;
exports.send = send;
exports.createAccount = createAccount;