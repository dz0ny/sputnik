'use strict';

var Datastore = require('nedb');
var Q = require('q');

exports.make = function (dbPath) {
    
    var db = new Datastore({
        filename : dbPath,
        autoload: true
    });
    
    var digestInProgress;
    var tags = [];
    
    function init() {
        return reloadTags();
    }
    
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
        
        // get from database all not abandoned articles for this feed
        db.find({ feedUrl: feedUrl, isAbandoned: false }, function (err, storedArticles) {
            
            // now iterate through new articles and add only new ones
            articles.forEach(function (article) {
                
                var index = indexOfArticle(storedArticles, article);
                if (typeof index === 'number') {
                    // this article already exists in database
                    var storedArt = storedArticles.splice(index, 1)[0];
                    // update article content and title if changed
                    if (storedArt.title !== article.title || storedArt.content !== article.description) {
                        totalOperations += 1;
                        db.update({ guid: storedArt.guid }, { $set: { title: article.title, content: article.description } }, {}, operationTick);
                    }
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
                if (Array.isArray(parsedFeed.articles) && parsedFeed.articles.length > 0) {
                    feedsPromises.push(digestFeed(parsedFeed.url, parsedFeed.articles));
                }
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
    
    function getArticles(feedUrls, from, to, options) {
        var deferred = Q.defer();
        
        var query = { feedUrl: { $in: feedUrls } };
        
        if (options && options.tag) {
            query.tags = options.tag;
        }
        
        db.find(query, function (err, docs) {
            
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
        
        db.update({ guid: guid }, { $set: { isRead: readState } }, { multi: true }, function (err, numReplaced) {
            deferred.resolve();
        });
        
        return deferred.promise;
    }
    
    function markAllAsRead(feedUrls) {
        var deferred = Q.defer();
        
        db.update({ feedUrl: { $in: feedUrls} }, { $set: { isRead: true } }, { multi: true }, function (err, numReplaced) {
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
    
    //-----------------------------------------------------
    // Tags
    //-----------------------------------------------------
    
    function reloadTags() {
        var deferred = Q.defer();
        
        db.find({ type: 'tag' }, function (err, docs) {
            
            docs.sort(function (a, b) {
                return a.name.localeCompare(b.name);
            });
            
            tags = docs;
            
            deferred.resolve();
        });
        
        return deferred.promise;
    }
    
    function addTag(tagName) {
        var deferred = Q.defer();
        
        db.findOne({ type: 'tag', name: tagName }, function (err, doc) {
            if (doc) {
                deferred.resolve(doc);
            } else {
                db.insert({
                    type: 'tag',
                    name: tagName
                }, function (err, newDoc) {
                    reloadTags()
                    .then(function () {
                        deferred.resolve(newDoc);
                    });
                });
            }
        });
        
        return deferred.promise;
    }
    
    function changeTagName(tagId, name) {
        var deferred = Q.defer();
        
        db.update({ _id: tagId }, { $set: { name: name } }, {}, function () {
            reloadTags()
            .then(function () {
                deferred.resolve();
            });
        });
        
        return deferred.promise;
    }
    
    function tagArticle(artGuid, tagId) {
        var deferred = Q.defer();
        
        db.update({ guid: artGuid }, { $addToSet: { tags: tagId } }, {}, function (err, numReplaced) {
            db.findOne({ guid: artGuid }, function (err, doc) {
                deferred.resolve(doc);
            });
        });
        
        return deferred.promise;
    }
    
    function untagArticle(artGuid, tagId) {
        var deferred = Q.defer();
        
        db.findOne({ guid: artGuid }, function (err, doc) {
            var replacement = { $set: { tags: doc.tags } };
            if (doc.tags) {
                var index = doc.tags.indexOf(tagId);
                doc.tags.splice(index, 1);
                if (doc.tags.length === 0) {
                    replacement = { $unset: { tags: true } };
                    doc.tags = undefined;
                }
            }
            db.update({ guid: artGuid }, replacement, {}, function (err) {
                deferred.resolve(doc);
            });
        });
        
        return deferred.promise;
    }
    
    function removeTag(tagId) {
        var deferred = Q.defer();
        
        db.find({ tags: tagId }, function (err, docs) {
            
            var promises = docs.map(function (art) {
                return untagArticle(art.guid, tagId);
            });
            
            Q.all(promises)
            .then(function () {
                db.remove({ _id: tagId }, {}, function (err, numRemoved) {
                    reloadTags()
                    .then(deferred.resolve);
                });
            });
        });
        
        return deferred.promise;
    }
    
    return {
        init: init,
        
        digest: digest,
        getArticles: getArticles,
        setArticleReadState: setArticleReadState,
        markAllAsRead: markAllAsRead,
        countUnread: countUnread,
        sweepArticlesOlderThan: sweepArticlesOlderThan,
        removeAllForFeed: removeAllForFeed,
        getDbSize: getDbSize,
        
        get tags() {
            return tags.concat();
        },
        addTag: addTag,
        changeTagName: changeTagName,
        tagArticle: tagArticle,
        untagArticle: untagArticle,
        removeTag: removeTag
    };
}