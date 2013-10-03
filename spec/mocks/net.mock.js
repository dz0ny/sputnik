'use strict';

var Q = require('q');

exports.make = function (urlMap) {
    
    var gerUrlSpy;
    
    function isTiemout(str) {
        return str.substr(0, 7) === 'timeout';
    }
    
    function get(url, options) {
        var deferred = Q.defer();
        
        if (urlMap[url]) {
            deferred.resolve(urlMap[url]);
        } else if (isTiemout(url)) {
            deferred.reject({
                code: 'ETIMEDOUT'
            });
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
                case 'unknown-error':
                default:
                    deferred.reject({
                        code: '???'
                    });
            }
        }
        
        if (gerUrlSpy) {
            gerUrlSpy(url, options);
        }
        
        return deferred.promise;
    }

    return {
        getUrl: get,
        injectGeturlSpy: function (spy) {
            gerUrlSpy = spy;
        }
    };
};