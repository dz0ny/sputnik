'use strict';

var Q = require('q');

var urlMap = {};

exports.injectUrlMap = function (passedUrlMap) {
    urlMap = passedUrlMap;
};

function get(url, options) {
    var deferred = Q.defer();
    
    if (urlMap[url]) {
        deferred.resolve(urlMap[url]);
    } else {
        switch (url) {
            case 'http://404':
                deferred.reject({
                    code: '404'
                });
                break;
            case 'not-found':
                deferred.reject({
                    code: 'ENOTFOUND'
                });
                break;
            case 'timeout':
                deferred.reject({
                    code: 'ETIMEDOUT'
                });
                break;
            case 'unknown-error':
            default:
                deferred.reject({
                    code: '???'
                });
        }
    }
    
    return deferred.promise;
}

exports.getUrl = get;