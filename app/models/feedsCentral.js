'use strict';

var Q = require('q');
var feedModel = require('./feed');
var EventEmitter = require('events').EventEmitter;

exports.make = function (initialData, articlesCentral) {
    var categories = [];
    var feeds = [];
    var tree = [];
    var treeObsolete = false;
    var events = new EventEmitter();
    
    if (initialData) {
        categories = initialData.categories;
        initialData.feeds.forEach(function (feedBaseModel) {
            constructFeedObject(feedBaseModel);
        });
    }
    
    function localeSort(a, b) {
        return a.localeCompare(b);
    }
    
    function treeSort(a, b) {
        if (a.type === 'category' && b.type === 'feed') {
            return -1;
        }
        if (a.type === 'feed' && b.type === 'category') {
            return 1;
        }
        if (a.type === 'category' && b.type === 'category') {
            return a.name.localeCompare(b.name);
        }
        if (a.type === 'feed' && b.type === 'feed') {
            return a.title.localeCompare(b.title);
        }
        return 0;
    }
    
    function rebuildTree() {
        tree = [];
        categories.forEach(function (categoryName) {
            var categoryFeeds = getFeedsForCategory(categoryName);
            categoryFeeds.sort(treeSort);
            tree.push({
                type: "category",
                name: categoryName,
                feeds: categoryFeeds,
                get articles() {
                    return getArticlesOf(this.feeds);
                },
                get unreadArticlesCount() {
                    return countUnreadArticlesIn(this.feeds);
                }
            });
        });
        feeds.forEach(function (feed) {
            if (!feed.category) {
                tree.push(feed);
            }
        });
        tree.sort(treeSort);
        treeObsolete = false;
    }
    
    function getFeedByUrl(url) {
        for (var i = 0; i < feeds.length; i += 1) {
            if (feeds[i].url === url) {
                return feeds[i];
            }
        }
        return null;
    }
    
    function getFeedsForCategory(categoryName) {
        var f = [];
        feeds.forEach(function (feed) {
            if (feed.category === categoryName) {
                f.push(feed);
            }
        });
        return f;
    }
    
    function constructFeedObject(baseModel) {
        var feed = feedModel.make(baseModel, articlesCentral);
        feed.events.on('modelChanged', function () {
            events.emit('modelChanged');
        });
        feeds.push(feed);
        treeObsolete = true;
        return feed;
    }
    
    function addFeed(baseModel) {
        var feed = getFeedByUrl(baseModel.url);
        if (feed) {
            return feed;
        }
        feed = constructFeedObject(baseModel);
        
        if (baseModel.category && categories.indexOf(baseModel.category) === -1) {
            // add category to model if not present
            categories.push(baseModel.category);
        }
        
        events.emit('feedAdded', feed);
        events.emit('modelChanged');
        
        return feed;
    }
    
    function removeFeed(url) {
        for (var i = 0; i < feeds.length; i += 1) {
            if (feeds[i].url === url) {
                var feed = feeds.splice(i, 1)[0];
                feed.events.removeAllListeners('modelChanged');
                treeObsolete = true;
                
                events.emit('feedRemoved', feed);
                events.emit('modelChanged');
                
                break;
            }
        }
    }
    
    function addCategory(name) {
        if (categories.indexOf(name) === -1) {
            categories.push(name);
            categories.sort(localeSort);
            treeObsolete = true;
            
            events.emit('modelChanged');
        }
    }
    
    function changeCategoryName(currentName, newName) {
        var index = categories.indexOf(currentName);
        if (index !== -1 && categories.indexOf(newName) === -1) {
            categories[index] = newName;
            categories.sort(localeSort);
            var categoryFeeds = getFeedsForCategory(currentName);
            categoryFeeds.forEach(function (feed) {
                feed.category = newName;
            });
            treeObsolete = true;
            
            events.emit('modelChanged');
        }
    }
    
    function removeCategory(name) {
        for (var i = 0; i < categories.length; i += 1) {
            if (categories[i] === name) {
                categories.splice(i, 1);
                treeObsolete = true;
                
                events.emit('modelChanged');
                
                break;
            }
        }
        var categoryFeeds = getFeedsForCategory(name);
        categoryFeeds.forEach(function (feed) {
            removeFeed(feed.url);
        });
    }
    
    function changeFeedCategory(feedUrl, newCategoryName) {
        var feed = getFeedByUrl(feedUrl);
        if (feed) {
            feed.category = newCategoryName;
            treeObsolete = true;
            
            events.emit('modelChanged');
        }
    }
    
    function getBaseModel() {
        var model = {
            "categories": categories,
            "feeds": []
        };
        feeds.forEach(function (feed) {
            model.feeds.push(feed.baseModel);
        });
        return model;
    }
    
    function digest(harvest) {
        var someFeedsMetaChanged = false;
        harvest.forEach(function (parsedFeed) {
            var feed = getFeedByUrl(parsedFeed.url);
            if (feed.digestMeta(parsedFeed.meta)) {
                someFeedsMetaChanged = true;
            }
        });
        if (someFeedsMetaChanged) {
            events.emit('modelChanged');
        }
    }
    
    function loadUnreadArticles() {
        var deferred = Q.defer();
        
        var promises = [];
        feeds.forEach(function (feed) {
            promises.push(feed.loadUnreadArticles());
        });
        
        Q.all(promises).done(function () {
            deferred.resolve();
        });
        
        return deferred.promise;
    }
    
    function getArticlesOf(feedsList) {
        var arts = [];
        feedsList.forEach(function (feed) {
            arts = arts.concat(feed.articles);
        });
        return arts;
    }
    
    function countUnreadArticlesIn(feedsList) {
        var count = 0;
        for (var i = 0; i < feedsList.length; i += 1) {
            for (var j = 0; j < feedsList[i].articles.length; j += 1) {
                if (!feedsList[i].articles[j].isRead) {
                    count += 1;
                }
            }
        }
        return count;
    }
    
    return {
        get tree() {
            if (treeObsolete) {
                rebuildTree();
            }
            return tree;
        },
        get all() {
            return feeds.concat();
        },
        get name() {
            return 'All';
        },
        get categoriesNames() {
            return categories.concat();
        },
        get feedUrls() {
            return feeds.map(function (feed) {
                return feed.url;
            });
        },
        get articles() {
            return getArticlesOf(feeds);
        },
        get unreadArticlesCount() {
            return countUnreadArticlesIn(feeds);
        },
        loadUnreadArticles: loadUnreadArticles,
        addFeed: addFeed,
        changeFeedCategory: changeFeedCategory,
        removeFeed: removeFeed,
        addCategory: addCategory,
        changeCategoryName: changeCategoryName,
        removeCategory: removeCategory,
        getBaseModel: getBaseModel,
        digest: digest,
        events: events
    };
}