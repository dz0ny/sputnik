'use strict';

describe('articlesCentral', function () {
    
    var articlesCentral = require('../../models/articlesCentral');
    
    // things in format returned by FeedParser/feedsHarvester
    var meta = {
        title: "Feed for site A",
        link: "http://a.com/new"
    };
    var harvest1 = [{
        url: 'http://a.com/feed',
        meta: meta,
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
                "enclosures": [
                    {
                        "url": "audioUrl/1",
                        "type": "audio/mpeg",
                        "length": "123"
                    },
                    {
                        "url": "audioUrl/2",
                        "type": "something",
                        "length": "456"
                    },
                    {
                        "type": "lackOfUrl",
                        "length": "456"
                    }
                ]
            }
        ]
    }];
    var harvest2 = [{
        url: 'http://a.com/feed',
        meta: meta,
        articles: [
            {
                "title": "art4",
                "description": "description4",
                "link": "link4",
                "pubDate": new Date(4),
            },
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
        ]
    }];
    var harvestNoPubDate = [{
        url: 'http://a.com/feed',
        meta: meta,
        articles: [
            {
                "title": "art4",
                "description": "description4",
                "link": "link4"
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
    
    it('should digest data from feedsHarvester and store them', function () {
        var done = false;
        var ac = articlesCentral.make();
        ac.digest(harvest1)
        .then(function () {
            return ac.getArticles(['http://a.com/feed'], 0, 100);
        })
        .then(function (result) {
            var articles = result.articles;
            expect(articles.length).toBe(3);
            
            var art = getArt(articles, 'link1');
            expect(art.guid).toBe('link1');
            expect(art.title).toBe('art1');
            expect(art.content).toBe('description1');
            expect(art.pubTime).toBe(1);
            expect(art.isRead).toBe(false);
            
            art = getArt(articles, 'guid2');
            expect(art.guid).toBe('guid2');
            expect(art.pubTime).toBe(2);
            expect(art.isRead).toBe(false);
            
            art = getArt(articles, 'link3');
            expect(art.guid).toBe('link3');
            expect(art.title).toBe('art3');
            expect(art.content).toBe('description3');
            expect(art.pubTime).toBe(3);
            expect(art.isRead).toBe(false);
            
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it('should paginate results, sorted: 0-newest, last-oldest', function () {
        var done = false;
        var ac = articlesCentral.make();
        ac.digest(harvest1)
        .then(function () {
            return ac.getArticles(['http://a.com/feed'], 0, 3);
        })
        .then(function (result) {
            expect(result.articles.length).toBe(3);
            expect(result.numAll).toBe(3);
            expect(result.articles[0].guid).toBe('link3');
            expect(result.articles[1].guid).toBe('guid2');
            expect(result.articles[2].guid).toBe('link1');
            
            return ac.getArticles(['http://a.com/feed'], 1, 3);
        })
        .then(function (result) {
            expect(result.articles.length).toBe(2);
            expect(result.articles[0].guid).toBe('guid2');
            expect(result.articles[1].guid).toBe('link1');
            
            return ac.getArticles(['http://a.com/feed'], 1, 2);
        })
        .then(function (result) {
            expect(result.articles.length).toBe(1);
            expect(result.articles[0].guid).toBe('guid2');
            
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it('should not duplicate same articles when digested many times', function () {
        var done = false;
        var ac = articlesCentral.make();
        ac.digest(harvest1)
        .then(function () {
            return ac.digest(harvest2);
        })
        .then(function () {
            return ac.getArticles(['http://a.com/feed'], 0, 100);
        })
        .then(function (result) {
            var articles = result.articles;
            expect(articles.length).toBe(4);
            expect(getArt(articles, 'link4')).not.toBeNull();
            expect(getArt(articles, 'link3')).not.toBeNull();
            expect(getArt(articles, 'guid2')).not.toBeNull();
            expect(getArt(articles, 'link1')).not.toBeNull();
            
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it('should do fine when 2 identical jobs executed simultaneously', function () {
        var doneTasks = 0;
        var ac = articlesCentral.make();
        
        ac.digest(harvest1)
        .then(function () {
            return ac.getArticles(['http://a.com/feed'], 0, 100);
        })
        .then(function (result) {
            expect(result.articles.length).toBe(3);
            
            doneTasks += 1;
        });
        
        ac.digest(harvest1)
        .then(function () {
            return ac.getArticles(['http://a.com/feed'], 0, 100);
        })
        .then(function (result) {
            expect(result.articles.length).toBe(3);
            
            doneTasks += 1;
        });
        
        waitsFor(function () { return doneTasks === 2; }, "timeout", 500);
    });
    
    it('should mark articles which not appear in feeds xml any more as abandoned', function () {
        var done = false;
        var ac = articlesCentral.make();
        ac.digest(harvest1)
        .then(function () {
            return ac.digest(harvest2);
        })
        .then(function () {
            return ac.getArticles(['http://a.com/feed'], 0, 100);
        })
        .then(function (result) {
            var articles = result.articles;
            expect(getArt(articles, 'link4').isAbandoned).toBe(false);
            expect(getArt(articles, 'link3').isAbandoned).toBe(false);
            expect(getArt(articles, 'guid2').isAbandoned).toBe(false);
            expect(getArt(articles, 'link1').isAbandoned).toBe(true);
            
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it('should mark article as read', function () {
        var done = false;
        var ac = articlesCentral.make();
        ac.digest(harvest1)
        .then(function () {
            return ac.setArticleReadState('guid2', true);
        })
        .then(function () {
            return ac.getArticles(['http://a.com/feed'], 0, 100);
        })
        .then(function (result) {
            var articles = result.articles;
            expect(getArt(articles, 'link3').isRead).toBe(false);
            expect(getArt(articles, 'guid2').isRead).toBe(true);
            expect(getArt(articles, 'link1').isRead).toBe(false);
            
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it('should count unread articles for given feed', function () {
        var done = false;
        var ac = articlesCentral.make();
        ac.digest(harvest1)
        .then(function () {
            return ac.countUnread('http://a.com/feed');
        })
        .then(function (count) {
            expect(count).toBe(3);
            return ac.setArticleReadState('guid2', true);
        })
        .then(function () {
            return ac.countUnread('http://a.com/feed');
        })
        .then(function (count) {
            expect(count).toBe(2);
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it('should sweep from database read, abandoned articles older than X', function () {
        var done = false;
        var ac = articlesCentral.make();
        ac.digest(harvest1)
        .then(function () {
            return ac.digest(harvest2);
        })
        .then(function () {
            return ac.setArticleReadState('link1', true);
        })
        .then(function () {
            // is not abandoned, so should not be removed even though isRead == true
            return ac.setArticleReadState('guid2', true);
        })
        .then(function () {
            return ac.sweepArticlesOlderThan(3);
        })
        .then(function () {
            return ac.getArticles(['http://a.com/feed'], 0, 100);
        })
        .then(function (result) {
            var articles = result.articles;
            expect(articles.length).toBe(3);
            expect(getArt(articles, 'link4')).not.toBeNull();
            expect(getArt(articles, 'link3')).not.toBeNull();
            expect(getArt(articles, 'guid2')).not.toBeNull();
            expect(getArt(articles, 'link1')).toBeNull();
            
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it('should set "now" date for article if pubDate was not provided in feed xml', function () {
        var done = false;
        var ac = articlesCentral.make();
        ac.digest(harvestNoPubDate)
        .then(function () {
            return ac.getArticles(['http://a.com/feed'], 0, 100);
        })
        .then(function (result) {
            var articles = result.articles;
            var now = Date.now();
            // now with 1 second toleration for test to pass
            expect(articles[0].pubTime).toBeGreaterThan(now - 500);
            expect(articles[0].pubTime).toBeLessThan(now + 500);
            
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it('should parse audio enclosures', function () {
        var done = false;
        var ac = articlesCentral.make();
        ac.digest(harvest1)
        .then(function () {
            return ac.getArticles(['http://a.com/feed'], 0, 100);
        })
        .then(function (result) {
            var articles = result.articles;
            var art = getArt(articles, 'link1');
            // should have one enclosure, the second one is of different type
            expect(art.enclosures.length).toBe(1);
            expect(art.enclosures[0].url).toBe('audioUrl/1');
            expect(art.enclosures[0].type).toBe('audio/mpeg');
            
            art = getArt(articles, 'guid2');
            // if no enclosures specified this field should be undefined
            expect(art.enclosures).toBe(undefined);
            
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
});