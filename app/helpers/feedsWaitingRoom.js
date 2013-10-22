'use strict'

var Q = require('q');
var fs = require('fs');
var pathUtil = require('path');
var crypto = require('crypto');

exports.init = function (waitingPlacePath) {
    
    function storeOne(data) {
        var def = Q.defer();
        
        var name = crypto.pseudoRandomBytes(8).toString('hex');
        var dataPath = pathUtil.resolve(waitingPlacePath, name);
        fs.writeFile(dataPath, data, function (err) {
            def.resolve();
        });
        
        return def.promise;
    }
    
    function getOne() {
        var def = Q.defer();
        
        fs.readdir(waitingPlacePath, function (err, files) {
            if (files.length > 0) {
                var dataPath = pathUtil.resolve(waitingPlacePath, files[0]);
                fs.readFile(dataPath, function (err, data) {
                    fs.unlink(dataPath, function (err) {
                        def.resolve(data);
                    });
                });
            } else {
                def.reject();
            }
        });
        
        return def.promise;
    }
    
    if (!fs.existsSync(waitingPlacePath)) {
        fs.mkdirSync(waitingPlacePath);
    }
    
    return {
        storeOne: storeOne,
        getOne: getOne
    };
};