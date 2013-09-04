'use strict';

var Datastore = require('nedb');
var Q = require('q');

exports.make = function (dbPath) {
    
    var db = new Datastore({
        filename : dbPath,
        autoload: true
    });
    
    var digestInProgress;
    
    function indexOfArticle(list, article) {
        var guid = article.guid || article.link;
        for (var i = 0; i < list.length; i += 1) {
            if (list[i].guid === guid) {
                return i;
            }
        }
        return null;
    }
    
    function digestFeed(feedUrl, articles) {
        var deferred = Q.defer();
        var totalOperations = 0;
        var completedOperations = 0;
        
        function operationTick() {
            completedOperations += 1;
            if (totalOperations === completedOperations) {
                deferred.resolve();
            }
        }
        
        // get from database all articles for this feed
        db.find({ feedUrl: feedUrl }, function (err, storedArticles) {
            
            // now iterate through new articles and add only new ones
            articles.forEach(function (article) {
                
                var index = indexOfArticle(storedArticles, article);
                if (typeof index === 'number') {
                    // this article already exists in database
                    storedArticles.splice(index, 1);
                } else {
                    
                    // this is new article, not yet in database
                    
                    // specify publication date
                    var pubTime;
                    if (article.pubDate) {
                        pubTime = article.pubDate.getTime();
                    } else {
                        // RSS cpec doesn't require for publication date to be specified,
                        // so we use the moment article was first time fetched as its pubDate.
                        pubTime = Date.now();
                    }
                    
                    // create article document and save it
                    var art = {
                        feedUrl: feedUrl,
                        link: article.link,
                        guid: article.guid || article.link, // if guid not specified use link as guid
                        title: article.title,
                        content: article.description,
                        pubTime: pubTime,
                        isRead: false,
                        isAbandoned: false
                    };
                    if (article.enclosures) {
                        art.enclosures = [];
                        article.enclosures.forEach(function (enclosure) {
                            if (enclosure.url && enclosure.type === 'audio/mpeg') {
                                art.enclosures.push({
                                    url: enclosure.url,
                                    type: enclosure.type
                                });
                            }
                        });
                    }
                    totalOperations += 1;
                    db.insert(art, operationTick);
                }
                
            });
            
            // Here we have in storedArticles only articles
            // which should be marked as abandoned.
            // Article isAbandoned if no longer appears on feed's xml.
            if (storedArticles.length > 0) {
                var articlesGuids = [];
                storedArticles.forEach(function (article) {
                    if (!article.isAbandoned) {
                        articlesGuids.push(article.guid);
                    }
                });
                totalOperations += 1;
                db.update({ guid: { $in: articlesGuids } }, { $set: { isAbandoned: true } }, { multi: true }, operationTick);
            }
            
            if (totalOperations === 0) {
                // no new article in feed, return immediately
                deferred.resolve();
            }
            
        });
        
        return deferred.promise;
    }
    
    function digest(harvest) {
        var digestPromise = Q.defer();
        
        function doDigest() {
            digestInProgress = digestPromise.promise;
            var feedsPromises = [];
            harvest.forEach(function (parsedFeed) {
                feedsPromises.push(digestFeed(parsedFeed.url, parsedFeed.articles));
            });
            Q.all(feedsPromises).then(function () {
                digestInProgress = null;
                digestPromise.resolve();
            });
        }
        
        // for database synchronization only one digest can run at a time
        if (digestInProgress) {
            digestInProgress.then(doDigest);
        } else {
            doDigest();
        }
        
        return digestPromise.promise;
    }
    
    function getArticles(feedUrls, from, to) {
        var deferred = Q.defer();
        
        db.find({ feedUrl: { $in: feedUrls } }, function (err, docs) {
            
            // sort chronologically
            docs.sort(function (a, b) {
                return b.pubTime - a.pubTime;
            });
            
            deferred.resolve({
                articles: docs.slice(from, to),
                numAll: docs.length
            });
        });
        
        return deferred.promise;
    }
    
    function setArticleReadState(guid, readState) {
        var deferred = Q.defer();
        
        db.update({ guid: guid }, { $set: { isRead: readState } }, function (err, numReplaced) {
            deferred.resolve();
        });
        
        return deferred.promise;
    }
    
    function countUnread(feedUrl) {
        var deferred = Q.defer();
        
        db.count({ feedUrl: feedUrl, isRead: false }, function (err, count) {
            deferred.resolve(count);
        });
        
        return deferred.promise;
    }
    
    function sweepArticlesOlderThan(time) {
        var deferred = Q.defer();
        
        db.remove({
            isRead: true,
            isAbandoned: true,
            pubTime: { $lt: time }
        }, function (err, numRemoved) {
            deferred.resolve();
        });
        
        return deferred.promise;
    }
    
    function removeAllForFeed(feedUrl) {
        var deferred = Q.defer();
        
        db.remove({
            feedUrl: feedUrl
        }, {
            multi: true
        }, function (err, numRemoved) {
            deferred.resolve();
        });
        
        return deferred.promise;
    }
    
    function getDbSize() {
        var fs = require('fs');
        if (!fs.existsSync(dbPath)) {
            return 0;
        }
        return fs.statSync(dbPath).size;
    }
    
    return {
        digest: digest,
        getArticles: getArticles,
        setArticleReadState: setArticleReadState,
        countUnread: countUnread,
        sweepArticlesOlderThan: sweepArticlesOlderThan,
        removeAllForFeed: removeAllForFeed,
        getDbSize: getDbSize
    };
}