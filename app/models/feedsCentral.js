'use strict';

var Q = require('q');
var EventEmitter = require('events').EventEmitter;

exports.make = function (initialData) {
    
    var categories = [];
    var feeds = [];
    var tree = [];
    var treeObsolete = false;
    var events = new EventEmitter();
    
    //-----------------------------------------------------
    // Init
    //-----------------------------------------------------
    
    if (initialData) {
        categories = initialData.categories;
        initialData.feeds.forEach(function (feedBaseModel) {
            constructFeedObject(feedBaseModel);
        });
    }
    
    //-----------------------------------------------------
    // Helper functions
    //-----------------------------------------------------
    
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
        if ((a.type === 'category' && b.type === 'category') ||
            (a.type === 'feed' && b.type === 'feed')) {
            return a.name.localeCompare(b.name);
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
    
    function constructFeedObject(feedModel) {
        feedModel.type = 'feed';
        
        // contains array with itself
        feedModel.feeds = [feedModel];
        
        feedModel.__defineGetter__('name', function () {
            return this.title || '...';
        });
        
        feedModel.setFavicon = function (path) {
            if (this.favicon !== path) {
                this.favicon = path;
                events.emit('modelChanged');
            }
        };
        
        feedModel.setName = function (name) {
            if (this.title !== name) {
                this.title = name;
                events.emit('modelChanged');
            }
        };
        
        feedModel.setSiteUrl = function (siteUrl) {
            if (this.siteUrl !== siteUrl) {
                this.siteUrl = siteUrl;
                events.emit('modelChanged');
            }
        };
        
        feeds.push(feedModel);
        treeObsolete = true;
        
        return feedModel;
    }
    
    //-----------------------------------------------------
    // API methods
    //-----------------------------------------------------
    
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
            model.feeds.push({
                "url": feed.url,
                "siteUrl": feed.siteUrl,
                "title": feed.name,
                "category": feed.category,
                "favicon": feed.favicon
            });
        });
        return model;
    }
    
    function digest(harvest) {
        harvest.forEach(function (parsedFeed) {
            var feed = getFeedByUrl(parsedFeed.url);
            feed.setName(parsedFeed.meta.title);
            feed.setSiteUrl(parsedFeed.meta.link);
        });
    }
    
    function getArticlesOf(feedsList) {
        var arts = [];
        feedsList.forEach(function (feed) {
            arts = arts.concat(feed.articles);
        });
        return arts;
    }
    
    function countUnreadArticlesIn(feedsList) {
        return feedsList.reduce(function (prev, curr) {
            return prev + curr.unreadArticlesCount;
        }, 0);
    }
    
    return {
        get tree() {
            if (treeObsolete) {
                rebuildTree();
            }
            return tree;
        },
        get feeds() {
            return feeds.concat();
        },
        get name() {
            return 'All';
        },
        get categoriesNames() {
            return categories.concat();
        },
        get unreadArticlesCount() {
            return countUnreadArticlesIn(feeds) || '?';
        },
        getFeedByUrl: getFeedByUrl,
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