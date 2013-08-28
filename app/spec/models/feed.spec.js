'use strict';

describe('feed model', function () {
    
    var articlesCentral = require('../../models/articlesCentral');
    var feed = require('../../models/feed');
    
    var harvest = [{
        url: 'http://a.com/feed',
        meta: null,
        articles: [
            {
                "title": "art3",
                "description": "description3",
                "link": "link3",
                "pubDate": new Date(3),
            },
            {
                "title": "art2",
                "description": "description2",
                "link": "link2",
                "guid": "guid2",
                "pubDate": new Date(2),
            },
            {
                "title": "art1",
                "description": "description1",
                "link": "link1",
                "pubDate": new Date(1),
            }
        ]
    }];
    
    var getArt = function (list, guid) {
        for (var i = 0; i < list.length; i += 1) {
            if (list[i].guid === guid) {
                return list[i];
            }
        }
        return null;
    };
    
    it('should init even when only url is specified and give safe defaults', function () {
        var f = feed.make({
            url: 'http://a.com/feed'
        }, null);
        expect(f.url).toBe("http://a.com/feed");
        expect(f.siteUrl).toBe(undefined);
        expect(f.title).toBe("...");
        expect(f.category).toBe(undefined);
        expect(f.favicon).toBe(undefined);
    });
    
    it('should init with full data', function () {
        var f = feed.make({
            url: 'http://a.com/feed',
            siteUrl: 'http://a.com',
            title: 'Site A',
            category: 'Category A',
            favicon: './path/to/favicon.png'
        }, null);
        expect(f.url).toBe("http://a.com/feed");
        expect(f.siteUrl).toBe('http://a.com');
        expect(f.title).toBe("Site A");
        expect(f.category).toBe('Category A');
        expect(f.favicon).toBe('./path/to/favicon.png');
    });
    
    it('should digest meta from FeedParser', function () {
        var f = feed.make({
            url: 'http://a.com/feed'
        }, null);
        f.digestMeta({
            "title": "Feed for site A",
            "link": "http://a.com/new"
        });
        expect(f.title).toBe('Feed for site A');
        expect(f.siteUrl).toBe('http://a.com/new');
    });
    
    it('should list articles which belongs to it', function () {
        var done = false;
        var ac = articlesCentral.make();
        var f = feed.make({
            url: 'http://a.com/feed',
            title: 'Site A',
            favicon: './path/to/favicon.png'
        }, ac);
        ac.digest(harvest)
        .then(function () {
            return f.loadUnreadArticles();
        })
        .then(function (articles) {
            expect(articles.length).toBe(3);
            expect(f.unreadArticlesCount).toBe(3);
            
            var art = getArt(articles, 'link3');
            expect(art.title).toBe('art3');
            expect(art.content).toBe('description3');
            expect(art.link).toBe('link3');
            expect(art.pubDate.getTime()).toBe(3);
            expect(art.isRead).toBe(false);
            expect(art.feed).toBe(f);
            
            art = getArt(articles, 'link1');
            expect(art.title).toBe('art1');
            expect(art.content).toBe('description1');
            expect(art.link).toBe('link1');
            expect(art.pubDate.getTime()).toBe(1);
            expect(art.isRead).toBe(false);
            expect(art.feed).toBe(f);
            
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it('should watch article read state and save it if changed', function () {
        var done = false;
        var ac = articlesCentral.make();
        var f = feed.make({
            url: 'http://a.com/feed'
        }, ac);
        ac.digest(harvest)
        .then(function () {
            return f.loadUnreadArticles();
        })
        .then(function (articles) {
            var art = getArt(articles, 'link3');
            expect(art.isRead).toBe(false);
            var promise = art.setIsRead(true);
            // instantly new value should be set in memory...
            expect(art.isRead).toBe(true);
            return promise;
        })
        .then(function () {
            return ac.getAllForFeed(f.url);
        })
        .then(function (articles) {
            // ...and in database eather
            var art = getArt(articles, 'link3');
            expect(art.isRead).toBe(true);
            
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
});