'use strict';

sputnik.factory('updateService', function (config, net) {
    
    var Q = require('q');
    
    /**
     * Compares given version with application version,
     * and returns true if given version is greater.
     * Only format MAJOR.MINOR.PATCH is supported.
     */
    function isNewerVersion(version) {
        var appV = config.appVersion.split('.');
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
        
        net.getUrl(config.checkUpdatesUrl)
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
        checkUpdates: checkUpdates,
        isNewerVersion: isNewerVersion
    };
    
});