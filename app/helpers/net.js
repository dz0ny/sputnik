'use strict';

var Q = require('q');
var request = require('request');
var zlib = require('zlib');

exports.getUrl = function (url) {
    var deferred = Q.defer();
    
    var options = {
        url: url,
        encoding: null,
        headers: {
            "User-Agent": "Sputnik News Reader",
            "Accept-Encoding": "gzip, deflate",
        },
        timeout: 5000
    };
    
    request(options, function (err, response, body) {
        if (err) {
            deferred.reject(err);
        } else {
            // if response comed compressed
            var encoding = response.headers['content-encoding'];

            if (encoding === 'gzip') {
                zlib.gunzip(body, function (err, decoded) {
                    deferred.resolve(decoded);
                });
            } else if (encoding === 'deflate') {
                zlib.inflate(body, function (err, decoded) {
                    deferred.resolve(decoded);
                });
            } else {
                deferred.resolve(body);
            }
        }
    });
    
    return deferred.promise;
};