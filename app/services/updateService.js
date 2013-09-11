'use strict';

sputnik.factory('updateService', function () {
    
    var Q = require('q');
    var net = require('./helpers/net');
    
    var checkUpdatesUrl;
    var appVersion;
    
    function init(passedCheckUpdatesUrl, passedAppVersion) {
        checkUpdatesUrl = passedCheckUpdatesUrl;
        appVersion = passedAppVersion;
    }
    
    /**
     * Compares given version with application version,
     * and returns true if given version is greater.
     * Only format MAJOR.MINOR.PATCH is supported.
     */
    function isNewerVersion(version) {
        var appV = appVersion.split('.');
        var v = version.split('.');
        if (v[0] > appV[0]) {
            return true;
        } else if (v[0] === appV[0]) {
            if (v[1] > appV[1]) {
                return true;
            } else if (v[1] === appV[1]) {
                if (v[2] > appV[2]) {
                    return true;
                }
            }
        }
        return false;
    }
    
    function checkUpdates() {
        var deferred = Q.defer();
        
        net.getUrl(checkUpdatesUrl)
        .then(function (data) {
            var updatesData = JSON.parse(data);
            var latesVersion = updatesData.version;
            if (isNewerVersion(latesVersion)) {
                deferred.resolve(latesVersion);
            } else {
                deferred.reject();
            }
        });
        
        return deferred.promise;
    }
    
    return  {
        init: init,
        checkUpdates: checkUpdates,
        isNewerVersion: isNewerVersion
    };
    
});