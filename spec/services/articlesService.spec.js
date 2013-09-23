'use strict';

describe('articlesService', function () {
    
    var articlesStorage = require('../app/models/articlesStorage');
    
    // format returned by feedsHarvester
    var harvest = [
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
    ];
    
    beforeEach(module('sputnik', function($provide) {
        $provide.value('articlesStorage', articlesStorage.make());
        $provide.value('feedsService', {
            getFeedByUrl: function (feedUrl) {
                return {};
            },
            feeds: []
        });
    }));
    
    it('should know its database size', inject(function (articlesService) {
        expect(typeof articlesService.dbSize).toBe('number');
    }));
    
    it('should pass to storage this methods', inject(function (articlesService) {
        expect(articlesService.countUnread).toBeDefined();
        expect(articlesService.removeAllForFeed).toBeDefined();
    }));
    
    it('article object spec', inject(function (articlesService) {
        var done = false;
        articlesService.digest('a.com/feed', harvest)
        .then(function () {
            return articlesService.getArticles(['a.com/feed'], 0, 3);
        })
        .then(function (result) {
            var art = result.articles[0];
            expect(art.id).toBeDefined();
            expect(art.pubDate.getTime()).toBe(art.pubTime);
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    }));
    
    describe('tagging', function () {
        
        it('should have tags list (sorted)', inject(function (articlesService) {
            var done = false;
            expect(articlesService.allTags.length).toBe(0);
            articlesService.addTag('ź')
            .then(function () {
                return articlesService.addTag('ą');
            })
            .then(function () {
                return articlesService.addTag('ć');
            })
            .then(function () {
                expect(articlesService.allTags.length).toBe(3);
                expect(articlesService.allTags[0].name).toBe('ą');
                expect(articlesService.allTags[1].name).toBe('ć');
                expect(articlesService.allTags[2].name).toBe('ź');
                done = true;
            });
            waitsFor(function () { return done; }, "timeout", 500);
        }));
        
        it('should fire event when tags list change', inject(function ($rootScope, articlesService) {
            var done = false;
            var addSpy = jasmine.createSpy('add');
            var changeSpy = jasmine.createSpy('change');
            var removeSpy = jasmine.createSpy('remove');
            $rootScope.$on('tagsListChanged', addSpy);
            articlesService.addTag('tag1')
            .then(function (tag) {
                expect(addSpy).toHaveBeenCalled();
                $rootScope.$on('tagsListChanged', changeSpy);
                return tag.setName('other name');
            })
            .then(function () {
                expect(changeSpy).toHaveBeenCalled();
                $rootScope.$on('tagsListChanged', removeSpy);
                var tag = articlesService.allTags[0];
                return tag.remove();
            })
            .then(function () {
                expect(removeSpy).toHaveBeenCalled();
                done = true;
            });
            waitsFor(function () { return done; }, "timeout", 500);
        }));
        
        it('article can be tagged, tags list is sorted', inject(function (articlesService) {
            var done = false;
            var tag1;
            var tag2;
            var tag3;
            var art;
            articlesService.digest('a.com/feed', harvest)
            .then(function () {
                return articlesService.addTag('ź');
            })
            .then(function (addedTag) {
                tag1 = addedTag;
                return articlesService.addTag('ą');
            })
            .then(function (addedTag) {
                tag2 = addedTag;
                return articlesService.addTag('ć');
            })
            .then(function (addedTag) {
                tag3 = addedTag;
                return articlesService.getArticles(['a.com/feed'], 0, 3);
            })
            .then(function (result) {
                art = result.articles[0];
                return art.toggleTag(tag1.id);
            })
            .then(function () {
                return art.toggleTag(tag2.id);
            })
            .then(function () {
                return art.toggleTag(tag3.id);
            })
            .then(function () {
                expect(art.tags.length).toBe(3);
                expect(art.tags[0].name).toBe('ą');
                expect(art.tags[1].name).toBe('ć');
                expect(art.tags[2].name).toBe('ź');
                done = true;
            });
            waitsFor(function () { return done; }, "timeout", 500);
        }));
        
    });
    
});