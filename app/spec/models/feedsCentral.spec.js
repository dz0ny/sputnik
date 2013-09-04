'use strict';

describe('feedsCentral', function () {
    
    var feedsCentral = require('../../models/feedsCentral');
    var feedsData;
    
    beforeEach(function () {
        feedsData = {
            "version": "1.0",
            "categories": [
                "First Category"
            ],
            "feeds": [
                {
                    "url": "http://a.com/feed",
                    "siteUrl": "http://a.com",
                    "title": "Site A",
                    "category": "First Category",
                    "favicon": null
                },
                {
                    "url": "http://b.com/feed",
                    "siteUrl": "http://b.com/",
                    "title": "Site B",
                    "category": null,
                    "favicon": null
                },
                {
                    "url": "http://c.com/feed",
                    "siteUrl": "http://c.com",
                    "title": "Site C",
                    "category": null,
                    "favicon": null
                }
            ]
        };
    });
    
    it('should init without data', function () {
        var fc = feedsCentral.make(null);
        expect(fc.tree.length).toBe(0);
        expect(fc.feeds.length).toBe(0);
    });
    
    it('| feed object spec', function () {
        var fc = feedsCentral.make(null);
        var f = fc.addFeed({
            "url": "http://a.com/feed/",
            "siteUrl": "http://a.com",
            "title": "Site A",
            "category": "Category 1",
            "favicon": "./path/to/favicon.png"
        });
        
        expect(f.type).toBe('feed');
        expect(f.url).toBe('http://a.com/feed/');
        expect(f.siteUrl).toBe('http://a.com');
        expect(f.name).toBe('Site A');
        expect(f.favicon).toBe('./path/to/favicon.png');
        
        f.setName('ABC');
        expect(f.name).toBe('ABC');
        
        f.setSiteUrl('something.com');
        expect(f.siteUrl).toBe('something.com');
        
        f.setFavicon('favicon.gif');
        expect(f.favicon).toBe('favicon.gif');
    });
    
    it('should add new feed and set defaults', function () {
        var fc = feedsCentral.make(null);
        fc.addFeed({
            url: "http://a.com/feed/"
        });
        expect(fc.tree.length).toBe(1);
        expect(fc.tree[0].type).toBe('feed');
        expect(fc.tree[0].url).toBe('http://a.com/feed/');
        expect(fc.tree[0].siteUrl).toBe(undefined);
        expect(fc.tree[0].name).toBe('...');
        expect(fc.tree[0].favicon).toBe(undefined);
        expect(fc.feeds.length).toBe(1);
        expect(fc.feeds[0] === fc.tree[0]).toBe(true); // it should be the same instance in two different places
    });
    
    it('should add new feed with proper data', function () {
        var fc = feedsCentral.make(null);
        fc.addFeed({
            "url": "http://a.com/feed/",
            "siteUrl": "http://a.com",
            "title": "Site A",
            "category": null,
            "favicon": "./path/to/favicon.png"
        });
        expect(fc.tree.length).toBe(1);
        expect(fc.tree[0].type).toBe('feed');
        expect(fc.tree[0].url).toBe('http://a.com/feed/');
        expect(fc.tree[0].siteUrl).toBe('http://a.com');
        expect(fc.tree[0].name).toBe('Site A');
        expect(fc.tree[0].favicon).toBe('./path/to/favicon.png');
    });
    
    it('should add new category', function () {
        var fc = feedsCentral.make(null);
        fc.addCategory("Cool Category");
        expect(fc.tree.length).toBe(1);
        expect(fc.tree[0].type).toBe('category');
        expect(fc.tree[0].name).toBe('Cool Category');
        expect(fc.tree[0].feeds.length).toBe(0);
        expect(fc.feeds.length).toBe(0);
    });
    
    it('should have list of categories names ordered alphabetically', function () {
        var fc = feedsCentral.make(null);
        fc.addCategory("First Category");
        fc.addCategory("Second Category");
        fc.addCategory("Cool Category");
        expect(fc.categoriesNames.length).toBe(3);
        expect(fc.categoriesNames[0]).toBe('Cool Category');
        expect(fc.categoriesNames[1]).toBe('First Category');
        expect(fc.categoriesNames[2]).toBe('Second Category');
    });
    
    it('should not allow to add 2 categories with same name', function () {
        var fc = feedsCentral.make(null);
        fc.addCategory("Cool Category");
        fc.addCategory("Cool Category");
        expect(fc.tree.length).toBe(1);
        expect(fc.tree[0].name).toBe("Cool Category");
        expect(fc.categoriesNames.length).toBe(1);
    });
    
    it('should add new feed to category', function () {
        var fc = feedsCentral.make(null);
        fc.addFeed({
            url: "http://site2.com/feed/",
            category: "Cool Category"
        });
        expect(fc.tree.length).toBe(1);
        expect(fc.tree[0].type).toBe('category');
        expect(fc.tree[0].name).toBe('Cool Category');
        expect(fc.tree[0].feeds[0].url).toBe('http://site2.com/feed/');
    });
    
    it('should order everything in tree alphabetically, categories first', function () {
        var fc = feedsCentral.make(null);
        fc.addFeed({
            url: "http://site2.com/feed/",
            title: 'Site ż'
        });
        fc.addFeed({
            url: "http://site3.com/feed/",
            title: 'Site ć'
        });
        fc.addFeed({
            url: "http://site1.com/feed/",
            title: 'Site ą'
        });
        fc.addCategory('CategoryC');
        fc.addFeed({
            url: "http://site6.com/feed/",
            title: 'Site6',
            category: "CategoryA"
        });
        fc.addFeed({
            url: "http://site4.com/feed/",
            title: 'Site4',
            category: "CategoryA"
        });
        fc.addFeed({
            url: "http://site5.com/feed/",
            title: 'Site5',
            category: "CategoryA"
        });
        fc.addCategory('CategoryB');
        
        expect(fc.tree[0].name).toBe('CategoryA');
        expect(fc.tree[1].name).toBe('CategoryB');
        expect(fc.tree[2].name).toBe('CategoryC');
        expect(fc.tree[3].name).toBe('Site ą');
        expect(fc.tree[4].name).toBe('Site ć');
        expect(fc.tree[5].name).toBe('Site ż');
        expect(fc.tree[0].feeds[0].name).toBe('Site4');
        expect(fc.tree[0].feeds[1].name).toBe('Site5');
        expect(fc.tree[0].feeds[2].name).toBe('Site6');
    });
    
    it('should init with given data', function () {
        var fc = feedsCentral.make(feedsData);
        expect(fc.tree.length).toBe(3);
        expect(fc.tree[0].type).toBe('category');
        expect(fc.tree[0].feeds[0].url).toBe('http://a.com/feed');
        expect(fc.tree[1].type).toBe('feed');
        expect(fc.tree[1].url).toBe('http://b.com/feed');
        expect(fc.feeds.length).toBe(3);
    });
    
    it('should delete not-empty category', function () {
        var fc = feedsCentral.make(feedsData);
        fc.removeCategory('First Category');
        expect(fc.tree.length).toBe(2);
        expect(fc.feeds.length).toBe(2);
    });
    
    it('should return previous instance if same feed added many times', function () {
        var fc = feedsCentral.make(feedsData);
        var feed1 = fc.addFeed({ url: "http://a.com/feed" });
        var feed2 = fc.addFeed({ url: "http://a.com/feed" });
        expect(fc.tree.length).toBe(3);
        expect(fc.feeds.length).toBe(3);
        expect(feed1 === feed2).toBe(true);
    });
    
    it('should move feed from category to main list', function () {
        var fc = feedsCentral.make(feedsData);
        fc.changeFeedCategory('http://a.com/feed', null);
        expect(fc.tree.length).toBe(4);
        expect(fc.tree[0].feeds.length).toBe(0);
        
        // the same behaviour for empty string as parameter
        fc = feedsCentral.make(feedsData);
        fc.changeFeedCategory('http://a.com/feed', '');
        expect(fc.tree.length).toBe(4);
        expect(fc.tree[0].feeds.length).toBe(0);
    });
    
    it('should move feed from main list to category', function () {
        var fc = feedsCentral.make(feedsData);
        fc.changeFeedCategory('http://b.com/feed', 'First Category');
        expect(fc.tree.length).toBe(2);
        expect(fc.tree[0].feeds.length).toBe(2);
        expect(fc.tree[0].feeds[0].url).toBe('http://a.com/feed');
        expect(fc.tree[0].feeds[1].url).toBe('http://b.com/feed');
    });
    
    it('should move feed from category to category', function () {
        var fc = feedsCentral.make(feedsData);
        fc.addCategory('Second Category');
        fc.changeFeedCategory('http://a.com/feed', 'Second Category');
        expect(fc.tree.length).toBe(4);
        expect(fc.tree[0].feeds.length).toBe(0);
        expect(fc.tree[1].feeds.length).toBe(1);
        expect(fc.tree[1].feeds[0].url).toBe('http://a.com/feed');
    });
    
    it('should remove feed from main list', function () {
        var fc = feedsCentral.make(feedsData);
        fc.removeFeed('http://b.com/feed');
        expect(fc.tree.length).toBe(2);
        expect(fc.tree[1].url).toBe('http://c.com/feed');
    });
    
    it('should change category name', function () {
        var fc = feedsCentral.make(feedsData);
        fc.changeCategoryName('First Category', 'Better Name');
        expect(fc.tree[0].name).toBe('Better Name');
        expect(fc.tree[0].feeds.length).toBe(1);
        expect(fc.tree[0].feeds[0].url).toBe('http://a.com/feed');
    });
    
    it('should discard category name changing if new name already exists', function () {
        var fc = feedsCentral.make(feedsData);
        fc.addCategory('Second Category');
        fc.changeCategoryName('Second Category', 'First Category');
        expect(fc.tree[0].name).toBe('First Category');
        expect(fc.tree[1].name).toBe('Second Category');
    });
    
    it('should remove feed from category and then remove empty category', function () {
        var fc = feedsCentral.make(feedsData);
        fc.removeFeed('http://a.com/feed');
        expect(fc.tree.length).toBe(3);
        expect(fc.tree[0].feeds.length).toBe(0);
        fc.removeCategory('First Category');
        expect(fc.tree.length).toBe(2);
        expect(fc.tree[0].type).toBe('feed');
    });
    
    it('should give base model with changes', function () {
        var fc = feedsCentral.make(feedsData);
        fc.addCategory('Second Category');
        fc.removeFeed('http://b.com/feed');
        var model = fc.getBaseModel();
        expect(model.categories.length).toBe(2);
        expect(model.categories[0]).toBe('First Category');
        expect(model.categories[1]).toBe('Second Category');
        expect(model.feeds.length).toBe(2);
    });
    
    it('should emit event when new feed was added', function () {
        var fc = feedsCentral.make();
        var eventEmitted = false;
        fc.events.on('feedAdded', function (feed) {
            expect(feed.url).toBe('http://a.com/feed');
            eventEmitted = true;
        });
        fc.addFeed({
            url: 'http://a.com/feed'
        });
        expect(eventEmitted).toBe(true);
    });
    
    it('should emit event when some feed has been removed', function () {
        var fc = feedsCentral.make(feedsData);
        var eventEmitted = false;
        fc.events.on('feedRemoved', function (feed) {
            expect(feed.url).toBe('http://a.com/feed');
            eventEmitted = true;
        });
        fc.removeFeed('http://a.com/feed');
        expect(eventEmitted).toBe(true);
    });
    
    it('should emit events on any model change', function () {
        var fc = feedsCentral.make(feedsData);
        
        var addFeed = false;
        var removeFeed = false;
        var changeFeedCategory = false;
        var addCategory = false;
        var removeCategory = false;
        var changeCategoryName = false;
        
        fc.events.on('modelChanged', function () {
            addFeed = true;
        });
        fc.addFeed({ url: 'http://z.com/feed' });
        
        fc.events.on('modelChanged', function () {
            removeFeed = true;
        });
        fc.removeFeed('http://z.com/feed');
        
        fc.events.on('modelChanged', function () {
            addCategory = true;
        });
        fc.addCategory('Second Category');
        
        fc.events.on('modelChanged', function () {
            removeCategory = true;
        });
        fc.removeCategory('Second Category');
        
        fc.events.on('modelChanged', function () {
            changeFeedCategory = true;
        });
        fc.changeFeedCategory('http://b.com/feed', 'First Category');
        
        fc.events.on('modelChanged', function () {
            changeCategoryName = true;
        });
        fc.changeCategoryName('First Category', 'Something');
        
        expect(addFeed).toBe(true);
        expect(removeFeed).toBe(true);
        expect(changeFeedCategory).toBe(true);
        expect(addCategory).toBe(true);
        expect(removeCategory).toBe(true);
        expect(changeCategoryName).toBe(true);
    });
    
    it('should re-emit events when some of feeds model change', function () {
        var fc = feedsCentral.make(feedsData);
        var feed = fc.feeds[0];
        
        var name = false;
        var siteUrl = false;
        var favicon = false;
        
        fc.events.on('modelChanged', function () {
            name = true;
        });
        feed.setName('newTitle');
        
        fc.events.on('modelChanged', function () {
            siteUrl = true;
        });
        feed.setSiteUrl('newlink');
        
        fc.events.on('modelChanged', function () {
            favicon = true;
        });
        feed.setFavicon('new/favicon.png');
        
        expect(name).toBe(true);
        expect(siteUrl).toBe(true);
        expect(favicon).toBe(true);
    });
    
});