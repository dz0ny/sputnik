'use strict';

describe('opml', function () {
    
    var opml = require('../app/helpers/opml');
    var feedsStorage = require('../app/models/feedsStorage');
    var xmldoc = require('xmldoc');
    
    describe('importing', function () {
        
        var opmlContent = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<opml version="1.0">' +
                '<head>' +
                    '<title>My subscriptions</title>' +
                '</head>' +
                '<body>' +
                    '<outline text="Category A">' + // lack of title attr
                        '<outline text="a" title="a" type="rss" xmlUrl="http://a.com/feed" htmlUrl="http://a.com"/>' +
                        '<outline text="b" title="b" type="rss" xmlUrl="http://b.com/feed" htmlUrl="http://b.com"/>' +
                        '<outline text="c" title="c" type="rss" xmlUrl="http://c.com/feed" htmlUrl="http://c.com"/>' +
                    '</outline>' +
                    '<outline text="Wazup?" title="Category B">' + // attr title should be favored over text
                        '<outline text="d" title="d" type="rss" xmlUrl="http://d.com/feed" htmlUrl="http://d.com"/>' +
                        '<outline text="Category C" title="Category C">' + // double nesting should be flattened
                            '<outline text="z" title="z" type="rss" xmlUrl="http://z.com/feed" htmlUrl="http://z.com"/>' +
                        '</outline>' +
                    '</outline>' +
                    '<outline text="e" type="rss" xmlUrl="http://e.com/feed" htmlUrl="http://e.com"/>' + // lack of title attr
                    '<outline text="f" title="f" type="rss" xmlUrl="http://f.com/feed"/>' + // lack of htmlUrl attr
                    '<outline text="g" title="g" type="rss" xmlUrl="http://g.com/feed" htmlUrl="http://g.com"/>' +
                    '<outline text="song.mp3" type="song"/>' + // should be ignored if is different type
                    '<outline text="Wazup?"/>' + // should be ignored if no type attr
                    '<outline text="Wazup again?" type="rss"/>' + // should be ignored if lack of xmlUrl attr
                '</body>' +
            '</opml>';
        
        it('should say if it is OPML format or not', function () {
            expect(opml.isOpml(opmlContent)).toBeTruthy();
            expect(opml.isOpml('<data><item>Hello!</item></data>')).toBeFalsy();
            expect(opml.isOpml('Something, something.')).toBeFalsy();
        });
        
        it('should add categories and feeds to storage', function () {
            var fst = feedsStorage.make();
            opml.import(opmlContent, fst);
            
            expect(fst.categories.length).toBe(2);
            expect(fst.feeds.length).toBe(8);
            
            // nested categories not supported in sputnik
            expect(fst.categories).not.toContain('Category C');
            
            expect(fst.feeds[0].url).toBe('http://a.com/feed');
            expect(fst.feeds[0].siteUrl).toBe('http://a.com');
            expect(fst.feeds[0].title).toBe('a');
            expect(fst.feeds[0].category).toBe('Category A');
            
            expect(fst.feeds[7].title).toBe('g');
            expect(fst.feeds[7].category).toBeUndefined();
        });
        
        it('should do nothing if not valid OPML was given', function () {
            var fst = feedsStorage.make();
            opml.import('<data><item>Hello!</item></data>', fst);
            expect(fst.categories.length).toBe(0);
            expect(fst.feeds.length).toBe(0);
        });
    });
    
    describe('exporting', function () {
        
        it('should create empty OPML from empty storage', function () {
            var fst = feedsStorage.make();
            var opmlContent = opml.export(fst);
            var xml = new xmldoc.XmlDocument(opmlContent);
            expect(xml.name).toBe('opml');
            expect(xml.childNamed('head').children.length).toBe(1);
            expect(xml.childNamed('body').children.length).toBe(0);
        });
        
        it('should create OPML', function () {
            var fst = feedsStorage.make();
            
            fst.addFeed({
                url: 'a.com/feed',
                siteUrl: 'a.com',
                title: 'a',
                category: 'First Category ąĄłŁ', // utf8 test
            });
            fst.addFeed({
                url: 'b.com/feed',
                siteUrl: 'b.com',
                title: 'b',
                category: 'First Category ąĄłŁ',
            });
            fst.addFeed({
                url: 'c.com/feed',
            });
            fst.addFeed({
                url: 'd.com/feed',
            });
            
            var opmlContent = opml.export(fst);
            var xml = new xmldoc.XmlDocument(opmlContent);
            
            expect(xml.childNamed('body').children.length).toBe(3);
            
            expect(xml.childNamed('body').children[0].attr.title).toBe('First Category ąĄłŁ');
            expect(xml.childNamed('body').children[0].attr.text).toBe('First Category ąĄłŁ');
            expect(xml.childNamed('body').children[0].children.length).toBe(2);
            expect(xml.childNamed('body').children[0].children[0].attr.text).toBe('a');
            expect(xml.childNamed('body').children[0].children[1].attr.text).toBe('b');
            
            expect(xml.childNamed('body').children[1].attr.text).toBe('Feed');
            expect(xml.childNamed('body').children[1].attr.title).toBe('Feed');
            expect(xml.childNamed('body').children[1].attr.type).toBe('rss');
            expect(xml.childNamed('body').children[1].attr.xmlUrl).toBe('c.com/feed');
            expect(xml.childNamed('body').children[1].attr.htmlUrl).toBeUndefined();
        });
    });
    
});