'use strict';

var Q = require('q');
var EventEmitter = require('events').EventEmitter;

exports.make = function (baseModel, articlesCentral) {
    
    var events = new EventEmitter();
    var articles = [];
    
    var api;
    
    function loadUnreadArticles() {
        var deferred = Q.defer();
        
        articlesCentral.getUnreadForFeed(baseModel.url)
        .done(function (rawArticles) {
            articles = rawArticles.map(function (rawArt) {
                var art = {
                    title: rawArt.title,
                    content: rawArt.content || '',
                    link: rawArt.link,
                    id: 'article-' + rawArt._id,
                    guid: rawArt.guid,
                    pubDate: new Date(rawArt.pubTime),
                    isRead: rawArt.isRead,
                    setIsRead: function (newIsRead) {
                        this.isRead = newIsRead;
                        return articlesCentral.setArticleReadState(this.guid, newIsRead);
                    },
                    enclosures: rawArt.enclosures,
                    feed: api
                };
                return art;
            });
            
            deferred.resolve(articles);
        });
        
        return deferred.promise;
    }
    
    function digestMeta(meta) {
        if (baseModel.title !== meta.title) {
            baseModel.title = meta.title;
            events.emit('modelChanged', 'title');
        }
        if (baseModel.siteUrl !== meta.link) {
            baseModel.siteUrl = meta.link;
            events.emit('modelChanged', 'siteUrl');
        }
    }
    
    api = {
        get type() {
            return 'feed';
        },
        get url() {
            return baseModel.url;
        },
        get siteUrl() {
            return baseModel.siteUrl;
        },
        get name() {
            return baseModel.title || '...';
        },
        get title() {
            return baseModel.title || '...';
        },
        get category() {
            return baseModel.category;
        },
        set category(value) {
            baseModel.category = value;
        },
        get favicon() {
            return baseModel.favicon;
        },
        set favicon(path) {
            baseModel.favicon = path;
            events.emit('modelChanged', 'favicon');
        },
        get hasFavicon() {
            return (typeof baseModel.favicon === 'string');
        },
        get baseModel() {
            return baseModel;
        },
        get articles() {
            return articles;
        },
        get unreadArticlesCount() {
            var count = 0;
            for (var i = 0; i < articles.length; i += 1) {
                if (!articles[i].isRead) {
                    count += 1;
                }
            }
            return count;
        },
        loadUnreadArticles: loadUnreadArticles,
        digestMeta: digestMeta,
        events: events
    };
    
    return api;
};