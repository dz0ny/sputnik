'use strict';

describe('feedsStorage', function () {
    
    var feedsStorage = require('../app/models/feedsStorage');
    
    it('should init with no data', function () {
        var fst = feedsStorage.make();
        expect(fst.categories.length).toBe(0);
        expect(fst.feeds.length).toBe(0);
    });
    
    it('can add feed', function () {
        var fst = feedsStorage.make();
        var feedData = {
            url: "a.com/feed/",
            siteUrl: "a.com",
            title: "Site A",
            category: "Category 1",
            favicon: "./path/to/favicon.png"
        };
        var addedFeed = fst.addFeed(feedData);
        expect(feedData).toEqual(addedFeed);
        expect(feedData).toEqual(fst.feeds[0]);
    });
    
    it('should not allow to add same feed many times', function () {
        var fst = feedsStorage.make();
        var feedData = {
            url: "a.com/feed"
        };
        var f1 = fst.addFeed(feedData);
        var f2 = fst.addFeed(feedData);
        expect(fst.feeds.length).toBe(1);
        expect(f1).toEqual(f2);
    });
    
    it('can add new category', function () {
        var fst = feedsStorage.make();
        fst.addCategory('Cool Category');
        expect(fst.categories.length).toBe(1);
        expect(fst.categories).toContain('Cool Category');
    });
    
    it('should not allow to add 2 categories with same name', function () {
        var fst = feedsStorage.make();
        fst.addCategory("Cool Category");
        fst.addCategory("Cool Category");
        expect(fst.categories.length).toBe(1);
    });
    
    it('can add new feed with category set', function () {
        var fst = feedsStorage.make();
        fst.addFeed({
            url: "a.com/feed",
            category: "Cool Category"
        });
        expect(fst.feeds.length).toBe(1);
        expect(fst.categories.length).toBe(1);
        expect(fst.categories).toContain('Cool Category');
    });
    
    it('can change any feed value', function () {
        var fst = feedsStorage.make();
        var f = fst.addFeed({
            url: "a.com/feed"
        });
        
        f = fst.setFeedValue(f.url, 'favicon', 'favicon.gif');
        expect(f.favicon).toBe('favicon.gif');
    });
    
    it('can delete feed', function () {
        var fst = feedsStorage.make();
        fst.addFeed({
            url: 'a.com/feed'
        });
        fst.removeFeed('a.com/feed');
        expect(fst.feeds.length).toBe(0);
    });
    
    it('should delete category and feeds assigned to that category', function () {
        var fst = feedsStorage.make();
        fst.addFeed({
            url: 'a.com/feed',
            category: 'Cool Category'
        });
        fst.addFeed({
            url: 'b.com/feed',
            category: 'Cool Category'
        });
        fst.removeCategory('Cool Category');
        expect(fst.categories.length).toBe(0);
        expect(fst.feeds.length).toBe(0);
    });
    
    it('can change category name', function () {
        var fst = feedsStorage.make();
        fst.addFeed({
            url: 'a.com/feed',
            category: 'Cool Category'
        });
        fst.changeCategoryName('Cool Category', 'Better Name');
        expect(fst.categories).toContain('Better Name');
        expect(fst.feeds[0].category).toBe('Better Name');
    });
    
    it('can create new category via feed property', function () {
        var fst = feedsStorage.make();
        var f = fst.addFeed({
            url: 'a.com/feed',
            category: 'Cool Category'
        });
        f = fst.setFeedValue(f.url, 'category', 'Better Name');
        expect(f.category).toBe('Better Name');
        expect(fst.categories.length).toBe(2);
        expect(fst.categories).toContain('Better Name');
        expect(fst.feeds[0].category).toBe('Better Name');
    });
    
    it('should merge two categories if name of one was changed to name of the other', function () {
        var fst = feedsStorage.make();
        fst.addFeed({
            url: 'a.com/feed',
            category: 'Cool Category'
        });
        fst.addFeed({
            url: 'b.com/feed',
            category: 'Second Category'
        });
        fst.changeCategoryName('Second Category', 'Cool Category');
        expect(fst.categories.length).toBe(1);
        expect(fst.feeds.length).toBe(2);
        expect(fst.feeds[0].category).toBe('Cool Category');
        expect(fst.feeds[1].category).toBe('Cool Category');
    });
    
    describe('disk persistance', function () {
        
        var fs = require('fs');
        
        var filePath = './temp/feeds.json';
        var feedsData = {
            "categories": [
                "First Category", "Second Category"
            ],
            "feeds": [
                {
                    "url": "a.com/feed",
                    "siteUrl": "a.com",
                    "title": "Site A",
                    "category": "First Category",
                    "favicon": "fav.png"
                },
                {
                    "url": "b.com/feed",
                    "siteUrl": "b.com/",
                    "title": "Site B",
                }
            ]
        };
        
        beforeEach(function () {
            fs.writeFileSync(filePath, JSON.stringify(feedsData), { encoding: 'utf8' });
        });
        
        function eraseFile() {
            fs.unlinkSync(filePath);
        }
        
        function grabFromDisk() {
            return JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));
        }
        
        it("should init when data file doesn't exist", function () {
            
            eraseFile();
            
            var fst = feedsStorage.make(filePath);
            
            expect(fst.categories.length).toBe(0);
            expect(fst.feeds.length).toBe(0);
        });
        
        // should save recent data to disk after any of this actions:
        
        it('test addFeed', function () {
            
            eraseFile();
            
            var fst = feedsStorage.make(filePath);
            var f1 = {
                url: 'a.com/feed',
                category: 'Cool Category'
            };
            fst.addFeed(f1);
            
            var savedData = grabFromDisk();
            
            expect(savedData.categories).toContain('Cool Category');
            expect(savedData.feeds[0]).toEqual(f1);
        });
        
        it('test removeFeed', function () {
            var fst = feedsStorage.make(filePath);
            fst.removeFeed('b.com/feed');
            var savedData = grabFromDisk();
            expect(savedData.feeds.length).toBe(1);
        });
        
        it('test setFeedValue', function () {
            var fst = feedsStorage.make(filePath);
            fst.setFeedValue('b.com/feed', 'favicon', 'abc');
            var savedData = grabFromDisk();
            expect(savedData.feeds[1].favicon).toBe('abc');
        });
        
        it('test addCategory', function () {
            var fst = feedsStorage.make(filePath);
            fst.addCategory('Third Category');
            var savedData = grabFromDisk();
            expect(savedData.categories).toContain('Third Category');
        });
        
        it('test changeCategoryName', function () {
            var fst = feedsStorage.make(filePath);
            fst.changeCategoryName('First Category', 'New Name');
            var savedData = grabFromDisk();
            expect(savedData.categories).toContain('New Name');
        });
        
        it('test removeCategory', function () {
            var fst = feedsStorage.make(filePath);
            fst.removeCategory('First Category');
            var savedData = grabFromDisk();
            expect(savedData.categories).not.toContain('First Category');
        });
        
    });
    
});