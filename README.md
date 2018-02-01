# Utility classes

*web3.js*

Initialize and use this custom wrapper to simplify interacting with web3

Initialize takes 3 params

`initWeb3(web3, provider, proxyConfig)`

provider and proxyConfig are optional

proxyConfig allows proxy through Etherscan API if web3 request fails

Example:

`var web3Utility = require('./utility/web3.js');`

`var web3 = web3Utility.initWeb3(window.web3);`

or with additional options

`var web3 = web3Utility.initWeb3(window.web3, "https://infura.io/myInfuraKey", {network: "kovan", "etherscanApiKey": "myEtherscanApiKey"});`


*ipfs.js*

Initialize and use this custom wrapper to simplify interacting with ipfs

Initialize takes 2 params

`function initIpfs(url, port)`

Example:

`var ipfsUtility = require('./utility/ipfs.js');`

`var ipfs = initIpfs("https://infura.io/ipfs/myInfuraKey", 5001)`

NOTE: the protocol is required, e.g. http:// or https://


*network.js*

Wrapper around `requests`

`get(url, headers, function(error, response) {

});`

`post(url, headers, data, function(error, response) {

});'

`put(url, headers, data, function(error, response) {

});`

*file.js*

Wrapper that uses `fs`

`var fileUtility = require('./utility/file.js');`
`var file = fileUtility.readLocalFile("myFileName.json", function(error, file) {

});`