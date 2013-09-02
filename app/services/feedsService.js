'use strict';

sputnik.factory('feedsService', function (configService, faviconsService) {
    var Q = require('q');
    var fs = require('fs');
    var feedsCentral = require('./models/feedsCentral');
    var articlesCentral = require('./models/articlesCentral');
    var feedsHarvester = require('./helpers/feedsHarvester');
    
    var feedsDataPath = configService.dataHomeFolder + '/feeds.json';
    var ac;
    var fc;
    var savingFired = false;
    
    var feedsData = null;
    if (fs.existsSync(feedsDataPath)) {
        var dataJson = fs.readFileSync(feedsDataPath);
        feedsData = JSON.parse(dataJson);
    }
    
    ac = articlesCentral.make(configService.dataHomeFolder + '/articles.nedb');
    fc = feedsCentral.make(feedsData, ac);
    
    fc.events.on('modelChanged', function () {
        // this event is fired if any single one property of feeds model has changed,
        // so we can save actual state to disc
        if (!savingFired) {
            process.nextTick(save);
            savingFired = true;
        }
    });
    
    fc.events.on('feedRemoved', function (feed) {
        // if feed was removed, delete also its data
        faviconsService.deleteFaviconIfHas(feed);
        ac.removeAllForFeed(feed.url);
    });
    
    function save() {
        savingFired = false;
        var deferred = Q.defer();
        
        var feedsDataJson = JSON.stringify(fc.getBaseModel(), null, 4);
        fs.writeFile(feedsDataPath, feedsDataJson, function (err) {
            deferred.resolve();
        });
        
        return deferred.promise;
    }
    
    function downloadFeeds(feedsList) {
        var deferred = Q.defer();
        
        feedsHarvester.getFeeds(feedsList)
        .progress(function (progress) {
            deferred.notify(progress);
        })
        .then(function (harvest) {
            fc.digest(harvest);
            var articlesObsolescenceTime = Date.now() - 4 * 7 * 24 * 60 * 60 * 1000; // now - 4 weeks
            return ac.digest(harvest, articlesObsolescenceTime);
        })
        .then(deferred.resolve);
        
        return deferred.promise;
    }
    
    function loadParticularFeed(feedUrl) {
        var deferred = Q.defer();
        
        feedsHarvester.getFeeds([feedUrl])
        .done(function (harvest) {
            fc.digest(harvest);
            var articlesObsolescenceTime = Date.now() - 4 * 7 * 24 * 60 * 60 * 1000; // now - 4 weeks
            ac.digest(harvest, articlesObsolescenceTime)
            .then(deferred.resolve);
        });
        
        return deferred.promise;
    }
    
    return  {
        get central() {
            return fc;
        },
        get articlesDbSize() {
            return ac.getDbSize();
        },
        downloadFeeds: downloadFeeds,
        loadParticularFeed: loadParticularFeed,
        discoverFeedUrl: feedsHarvester.discoverFeedUrl
    };
});