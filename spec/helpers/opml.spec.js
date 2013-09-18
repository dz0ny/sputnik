'use strict';

describe('opml', function () {
    
    var opml = require('../app/helpers/opml');
    var xmldoc = require('xmldoc');
    var feedsCentral = require('../app/models/feedsCentral');
    
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
            expect(opml.isOpml(opmlContent)).toBe(true);
            expect(opml.isOpml('<data><item>Hello!</item></data>')).toBe(false);
            expect(opml.isOpml('Something, something.')).toBe(false);
        });
        
        it('should add categories and feeds to tree', function () {
            var fc = feedsCentral.make();
            opml.import(opmlContent, fc.addFeed);
            
            expect(fc.tree.length).toBe(5);
            expect(fc.feeds.length).toBe(8);
            
            expect(fc.tree[0].type).toBe('category');
            expect(fc.tree[0].name).toBe('Category A');
            expect(fc.tree[0].feeds.length).toBe(3);
            expect(fc.tree[0].feeds[0].url).toBe('http://a.com/feed');
            expect(fc.tree[0].feeds[1].url).toBe('http://b.com/feed');
            expect(fc.tree[0].feeds[2].url).toBe('http://c.com/feed');
            
            expect(fc.tree[1].type).toBe('category');
            expect(fc.tree[1].name).toBe('Category B');
            expect(fc.tree[1].feeds.length).toBe(2);
            expect(fc.tree[1].feeds[0].url).toBe('http://d.com/feed');
            expect(fc.tree[1].feeds[1].url).toBe('http://z.com/feed');
            
            expect(fc.tree[2].type).toBe('feed');
            expect(fc.tree[2].url).toBe('http://e.com/feed');
            expect(fc.tree[2].siteUrl).toBe('http://e.com');
            
            expect(fc.tree[3].siteUrl).toBe(undefined);
        });
        
        it('should do nothing if not valid OPML was given', function () {
            var fc = feedsCentral.make();
            opml.import('<data><item>Hello!</item></data>', fc, 0);
            expect(fc.tree.length).toBe(0);
            expect(fc.feeds.length).toBe(0);
        });
    });
    
    
    describe('exporting', function () {
        
        function getFeedsData() {
            var fs = require('fs');
            return JSON.parse(fs.readFileSync('./data/feeds.json'));
        }
        
        it('should create empty OPML from empty tree', function () {
            var opmlContent = opml.export([]);
            var xml = new xmldoc.XmlDocument(opmlContent);
            expect(xml.name).toBe('opml');
            expect(xml.childNamed('head').children.length).toBe(1);
            expect(xml.childNamed('body').children.length).toBe(0);
        });
        
        it('should create OPML', function () {
            var data = getFeedsData();
            var fc = feedsCentral.make(data);
            var opmlContent = opml.export(fc.tree);
            var xml = new xmldoc.XmlDocument(opmlContent);
            
            expect(xml.childNamed('body').children.length).toBe(3);
            
            expect(xml.childNamed('body').children[0].attr.title).toBe('First Category');
            expect(xml.childNamed('body').children[0].attr.text).toBe('First Category');
            expect(xml.childNamed('body').children[0].children.length).toBe(1);
            expect(xml.childNamed('body').children[0].children[0].attr.text).toBe('Site A');
            
            expect(xml.childNamed('body').children[1].attr.text).toBe('Site B');
            expect(xml.childNamed('body').children[1].attr.title).toBe('Site B');
            expect(xml.childNamed('body').children[1].attr.type).toBe('rss');
            expect(xml.childNamed('body').children[1].attr.xmlUrl).toBe('http://b.com/feed');
            expect(xml.childNamed('body').children[1].attr.htmlUrl).toBe('http://b.com/');
        });
    });
    
});