'use strict';

var Q = require('q');

var urlMap = {};

exports.injectUrlMap = function (passedUrlMap) {
    urlMap = passedUrlMap;
};

function get(url) {
    var deferred = Q.defer();
    if (urlMap[url]) {
        deferred.resolve(urlMap[url]);
    } else {
        deferred.reject();
    }
    return deferred.promise;
}

exports.getUrl = get;