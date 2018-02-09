var fs = require('fs');
var NetworkUtility = require('./network.js');

function readLocalFile(baseUrl, filename, callback) {
    try {
        if (typeof(window) === 'undefined') {
            fs.readFile(filename, { encoding: 'utf8' }, function(error, data) {
                if (error) {
                    callback(error, undefined);
                } else {
                    callback(undefined, data);
                }
            });
        } else {
            NetworkUtility.get(baseUrl + "/" + filename, {}, function(error, body) {
                if (error) {
                    callback(error, undefined);
                } else {
                    callback(undefined, body);
                }
            });
        }
    } catch (err) {
        callback(err, undefined);
    }
}

exports.readLocalFile = readLocalFile;