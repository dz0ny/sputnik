'use strict';

sputnik.factory('feedsService', function ($rootScope, feedsStorage, opml) {
    
    var Q = require('q');
    
    var feeds;
    var tree;
    var treeObsolete = true;
    var totalUnreadCount = 0;
    
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
            return a.title.localeCompare(b.title);
        }
        return 0;
    }
    
    function rebuildTree() {
        tree = [];
        feedsStorage.categories.forEach(function (categoryName) {
            tree.push(constructCategory(categoryName));
        });
        feeds.forEach(function (feed) {
            if (!feed.category) {
                tree.push(feed);
            }
        });
        tree.sort(treeSort);
        treeObsolete = false;
    }
    
    function getFeedsForCategory(categoryName) {
        var catFeeds = [];
        feeds.forEach(function (feed) {
            if (feed.category === categoryName) {
                catFeeds.push(feed);
            }
        });
        return catFeeds;
    }
    
    function constructFeed(feedModel) {
        return {
            type: 'feed',
            unreadArticlesCount: 0,
            get url() {
                return feedModel.url;
            },
            
            get title() {
                return feedModel.title || '...';
            },
            set title(value) {
                if (feedModel.title !== value) {
                    feedsStorage.setFeedValue(feedModel.url, 'title', value);
                }
            },
            get siteUrl() {
                return feedModel.siteUrl;
            },
            set siteUrl(value) {
                if (feedModel.siteUrl !== value) {
                    feedsStorage.setFeedValue(feedModel.url, 'siteUrl', value);
                }
            },
            get favicon() {
                return feedModel.favicon;
            },
            set favicon(value) {
                if (feedModel.favicon !== value) {
                    feedsStorage.setFeedValue(feedModel.url, 'favicon', value);
                }
            },
            
            get category() {
                return feedModel.category;
            },
            set category(value) {
                feedsStorage.setFeedValue(feedModel.url, 'category', value);
                treeObsolete = true;
            },
            
            get averageActivity() {
                return feedModel.averageActivity;
            },
            set averageActivity(value) {
                if (feedModel.averageActivity !== value) {
                    feedsStorage.setFeedValue(feedModel.url, 'averageActivity', value);
                }
            },
            
            remove: function () {
                feedsStorage.removeFeed(feedModel.url);
                constructFeedsList();
                
                $rootScope.$broadcast('feedRemoved', this);
            },
        };
    }
    
    function constructCategory(categoryName) {
        var categoryFeeds = getFeedsForCategory(categoryName);
        categoryFeeds.sort(treeSort);
        return {
            type: 'category',
            title: categoryName,
            feeds: categoryFeeds,
            unreadArticlesCount: 0,
            setTitle : function (newName) {
                feedsStorage.changeCategoryName(categoryName, newName);
                treeObsolete = true;
            },
            remove: function () {
                feedsStorage.removeCategory(categoryName);
                constructFeedsList();
            },
        };
    }
    
    function constructFeedsList() {
        feeds = [];
        feedsStorage.feeds.forEach(function (feedModel) {
            feeds.push(constructFeed(feedModel));
        });
        treeObsolete = true;
    }
    
    //-----------------------------------------------------
    // Init
    //-----------------------------------------------------
    
    constructFeedsList();
    rebuildTree();
    
    $rootScope.$on('unreadArticlesCountChanged', function (evt, feedUrl, count) {
        var feed = getFeedByUrl(feedUrl);
        feed.unreadArticlesCount = count;
        totalUnreadCount = 0;
        tree.forEach(function (treeItem) {
            if (treeItem.type === 'category') {
                var catCount = 0;
                treeItem.feeds.forEach(function (feed) {
                    catCount += feed.unreadArticlesCount;
                });
                treeItem.unreadArticlesCount = catCount;
                totalUnreadCount += catCount;
            } else {
                totalUnreadCount += treeItem.unreadArticlesCount;
            }
        });
    });
    
    //-----------------------------------------------------
    // API methods
    //-----------------------------------------------------
    
    function importOpml(fileContent) {
        opml.import(fileContent, feedsStorage);
        
        $rootScope.$broadcast('feedsImported');
    }
    
    function exportOpml() {
        return opml.export(feedsStorage);
    }
    
    function getFeedByUrl(url) {
        for (var i = 0; i < feeds.length; i += 1) {
            if (feeds[i].url === url) {
                return feeds[i];
            }
        }
        return null;
    }
    
    function addFeed(feedModel) {
        var storedFeed = feedsStorage.addFeed(feedModel);
        constructFeedsList();
        
        $rootScope.$broadcast('feedAdded', getFeedByUrl(feedModel.url));
    }
    
    function addCategory(categoryName) {
        feedsStorage.addCategory(categoryName);
        treeObsolete = true;
    }
    
    function digestFeedMeta(feedUrl, meta) {
        var feed = getFeedByUrl(feedUrl);
        feed.title = meta.title;
        feed.siteUrl = meta.link;
    }
    
    return  {
        importOpml: importOpml,
        exportOpml: exportOpml,
        
        addFeed: addFeed,
        getFeedByUrl: getFeedByUrl,
        addCategory: addCategory,
        
        digestFeedMeta: digestFeedMeta,
        
        get tree() {
            if (treeObsolete) {
                rebuildTree();
            }
            return tree;
        },
        
        get categoriesNames() {
            var cats = feedsStorage.categories.concat();
            cats.sort(localeSort);
            return cats;
        },
        
        get feeds() {
            return feeds;
        },
        get title() {
            return 'All';
        },
        get unreadArticlesCount() {
            return totalUnreadCount;
        },
    };
});