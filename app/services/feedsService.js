'use strict';

sputnik.factory('feedsService', function (configService) {
    
    var Q = require('q');
    var fs = require('fs');
    var feedsCentral = require('./models/feedsCentral');
    var articlesCentral = require('./models/articlesCentral');
    var feedsHarvester = require('./helpers/feedsHarvester');
    
    var ac;
    var fc;
    var feedsDataSaving = false;
    var feedsDataPath = configService.dataHomeFolder + '/feeds.json';
    
    //-----------------------------------------------------
    // Init
    //-----------------------------------------------------
    
    function init() {
        var feedsData = null;
        if (fs.existsSync(feedsDataPath)) {
            feedsData = JSON.parse(fs.readFileSync(feedsDataPath));
        }
        fc = feedsCentral.make(feedsData);
        
        ac = articlesCentral.make(configService.dataHomeFolder + '/articles.nedb');
    }
    
    init();
    
    //-----------------------------------------------------
    // Listening to events on model
    //-----------------------------------------------------
    
    function saveFeedsData() {
        
        if (feedsDataSaving) {
            return;
        }
        
        feedsDataSaving = true;
        
        // save on next tick, to write once many changes
        // to model which could happen at this turn
        process.nextTick(function () {
            
            feedsDataSaving = false;
            
            var feedsDataJson = JSON.stringify(fc.getBaseModel(), null, 4);
            fs.writeFile(feedsDataPath, feedsDataJson, function (err) {
                // saved
            });
        });
    }
    
    // this event is fired if any single one property of any feed model has changed
    fc.events.on('modelChanged', saveFeedsData);
    
    fc.events.on('feedRemoved', function (feed) {
        // remove all articles for this feed
        ac.removeAllForFeed(feed.url);
    });
    
    function countUnreadArticlesForFeed(feed) {
        var deferred = Q.defer();
        
        ac.countUnread(feed.url)
        .then(function (count) {
            feed.unreadArticlesCount = count;
            deferred.resolve();
        });
        
        return deferred.promise;
    }
    
    function downloadListedFeeds(feedUrls) {
        var deferred = Q.defer();
        
        feedsHarvester.getFeeds(feedUrls)
        .progress(function (progress) {
            deferred.notify(progress);
        })
        .then(function (harvest) {
            fc.digest(harvest);
            return ac.digest(harvest);
        })
        .then(function () {
            return Q.all(fc.feeds.map(countUnreadArticlesForFeed));
        })
        .then(deferred.resolve);
        
        return deferred.promise;
    }
    
    //-----------------------------------------------------
    // API methods
    //-----------------------------------------------------
    
    function addFeed(feedBaseModel) {
        var deferred = Q.defer();
        
        var feed = fc.addFeed(feedBaseModel);
        
        downloadListedFeeds([feed.url])
        .then(function () {
            deferred.resolve(feed);
        });
        
        return deferred.promise;
    }
    
    function downloadFeeds() {
        var feedUrls = fc.feeds.map(function (feed) {
            return feed.url;
        });
        
        return downloadListedFeeds(feedUrls);
    }
    
    function getArticles(feedUrls, from, to) {
        var deferred = Q.defer();
        
        ac.getArticles(feedUrls, from, to)
        .then(function (result) {
            
            // add to every article's base data extra stuff
            result.articles.forEach(function (art) {
                art.id = 'article-' + art._id;
                art.content = art.content || '';
                art.pubDate = new Date(art.pubTime);
                
                art.setIsRead = function (newIsRead) {
                    this.isRead = newIsRead;
                    return ac.setArticleReadState(this.guid, newIsRead)
                    .then(function () {
                        return countUnreadArticlesForFeed(this.feed);
                    });
                };
                
                art.feed = fc.getFeedByUrl(art.feedUrl);
            });
            
            deferred.resolve(result);
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
        discoverFeedUrl: feedsHarvester.discoverFeedUrl,
        addFeed: addFeed,
        downloadFeeds: downloadFeeds,
        getArticles: getArticles
    };
});