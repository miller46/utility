const IpfsAPI = require('ipfs-api');
var Buffer = IpfsAPI().Buffer;

var ipfs;

function initIpfs(url, port) {
    if (!ipfs) {
        if (url.indexOf("://") === -1) {
            throw "IPFS host url must specify protocol (e.g. http:// or https://)"
        } else {
            protocol = host.substring(0, host.indexOf("://"));
            host = host.substring(host.indexOf("://") + "://".length, host.length);
            ipfs = IpfsAPI({host: host, port: port, protocol: protocol})
        }
    }
    return ipfs;
}

function saveIpfsFile(name, data, callback) {
    var reader = new FileReader();
    reader.onloadend = function(event) {
        console.log(event.target.result);

        var ipfs = initIpfs();

        var buffer = Buffer.from(reader.result);
        ipfs.files.add(buffer, function(error, response) {
            if (error) {
                console.log(error);
                callback(error, undefined);
            } else {
                console.log(response);
                callback(undefined, response);
            }
        });
    };

    var file = new File([data], name, {
        type: "text/plain"
    });
    reader.readAsText(file);
}

function fetchIpfsFile(ipfsPointer, callback) {
    if (!ipfsPointer) {
        callback(new Error("multihash required"), undefined);
    } else {
        var ipfs = initIpfs();

        ipfs.files.cat("/ipfs/" + ipfsPointer, function (error, stream) {
            if (error) {
                console.log(error);
                callback(error, undefined);
            } else {
                var fileParts = [];
                stream.on("data", function (part) {
                    fileParts.push(part.toString());
                });

                stream.on("end", function () {
                    var fileContents = "";
                    for (var i = 0; i < fileParts.length; i++) {
                        fileContents += fileParts[i];
                    }

                    console.log(fileContents);
                    callback(undefined, fileContents);
                });
            }
        });
    }
}

exports.saveIpfsFile = saveIpfsFile;
exports.fetchIpfsFile = fetchIpfsFile;