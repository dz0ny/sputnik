'use strict';

var mockNet = require('./mocks/net');
var fs = require('fs');
var fh = require('../app/helpers/feedsHarvester');

var atomXml = fs.readFileSync('./data/atom.xml');
var rss2Xml = fs.readFileSync('./data/rss2.xml');
var isoEncoded = fs.readFileSync('./data/iso-encoded.xml');
var htmlLinkAtom = '<html><head><link href="http://atom-xml" title="The Site" type="application/atom+xml"></head></html>';
var htmlLinkRss = '<html><head><link href="http://rss2-xml" title="The Site" type="application/rss+xml"></head></html>';
// sometimes relative links are given
var htmlLinkRelativeRss = '<html><head><link href="/rss2-xml" title="The Site" type="application/rss+xml"></head></html>';
// HTML has link to RSS, but this link returns 404
var htmlLink404 = '<html><head><link href="http://404" title="The Site" type="application/rss+xml"></head></html>';
// HTML has link to RSS, but this link returns invalid RSS
var htmlLinkHtml = '<html><head><link href="http://html-link-rss" title="The Site" type="application/rss+xml"></head></html>';
var htmlNoLink = '<html><head></head></html>';

mockNet.injectUrlMap({
    "http://404": null,
    "http://atom-xml": atomXml,
    "http://rss2-xml": rss2Xml,
    "http://iso-encoded": isoEncoded,
    "http://html-link-atom": htmlLinkAtom,
    "http://html-link-rss": htmlLinkRss,
    "http://html-link-relative-rss": htmlLinkRelativeRss,
    "http://html-link-relative-rss/rss2-xml": rss2Xml,
    "http://html-no-link": htmlNoLink,
    "http://html-link-404": htmlLink404,
    "http://html-link-html": htmlLinkHtml,
});

describe('feedsHarvester', function () {

    describe('feed url discovery', function () {
        
        it("should return nothing if 404", function () {
            var done = false;
            fh.discoverFeedUrl('http://404', mockNet).fail(function () {
                done = true;
            });
            waitsFor(function () { return done; }, "timeout", 500);
        });
        
        it("should deal with Atom XML", function () {
            var done = false;
            fh.discoverFeedUrl('http://atom-xml', mockNet).then(function (feedUrl) {
                expect(feedUrl).toBe('http://atom-xml');
                done = true;
            });
            waitsFor(function () { return done; }, "timeout", 500);
        });
        
        it("should deal with RSS XML", function () {
            var done = false;
            fh.discoverFeedUrl('http://rss2-xml', mockNet).then(function (feedUrl) {
                expect(feedUrl).toBe('http://rss2-xml');
                done = true;
            });
            waitsFor(function () { return done; }, "timeout", 500);
        });
        
        it("should deal with HTML with <link> to Atom", function () {
            var done = false;
            fh.discoverFeedUrl('http://html-link-atom', mockNet).then(function (feedUrl) {
                expect(feedUrl).toBe('http://atom-xml');
                done = true;
            });
            waitsFor(function () { return done; }, "timeout", 500);
        });
        
        it("should deal with HTML with <link> to RSS", function () {
            var done = false;
            fh.discoverFeedUrl('http://html-link-rss', mockNet).then(function (feedUrl) {
                expect(feedUrl).toBe('http://rss2-xml');
                done = true;
            });
            waitsFor(function () { return done; }, "timeout", 500);
        });
        
        it("should deal with HTML with RELATIVE <link> to RSS", function () {
            var done = false;
            fh.discoverFeedUrl('http://html-link-relative-rss', mockNet).then(function (feedUrl) {
                expect(feedUrl).toBe('http://html-link-relative-rss/rss2-xml');
                done = true;
            });
            waitsFor(function () { return done; }, "timeout", 500);
        });
        
        it("should return nothing if HTML has no <link> tag", function () {
            var done = false;
            fh.discoverFeedUrl('http://html-no-link', mockNet).fail(function () {
                done = true;
            });
            waitsFor(function () { return done; }, "timeout", 500);
        });
        
        it("should return nothing if HTMLs <link> gets 404", function () {
            var done = false;
            fh.discoverFeedUrl('http://html-link-404', mockNet).fail(function () {
                done = true;
            });
            waitsFor(function () { return done; }, "timeout", 500);
        });
        
        it("should return nothing if HTMLs <link> gets HTML instead of feed format", function () {
            var done = false;
            fh.discoverFeedUrl('http://html-link-html', mockNet).fail(function () {
                done = true;
            });
            waitsFor(function () { return done; }, "timeout", 500);
        });
        
    });
    
    describe('feed content fetching', function () {
        
        it("should fetch feeds' xmls", function () {
            var done = false;
            var feedUrls = [
                'http://404', // to test edge case
                'http://html-no-link', // html instead of feed xml to test edge case
                'http://atom-xml',
                'http://rss2-xml',
            ];
            fh.getFeeds(feedUrls, mockNet).then(
                function (result) {
                    expect(result.length).toBe(2);
                    expect(result[0].url).toBe('http://atom-xml');
                    expect(result[1].url).toBe('http://rss2-xml');
                    done = true;
                },
                null,
                function (progress) {
                    expect(progress.completed).toBeGreaterThan(0);
                    expect(progress.completed).toBeLessThan(feedUrls.length + 1);
                    expect(progress.total).toBe(feedUrls.length);
                }
            );
            waitsFor(function () { return done; }, "timeout", 500);
        });
        
        it("should convert to UTF-8 any feed encoded in different charset", function () {
            var done = false;
            fh.getFeeds(['http://iso-encoded'], mockNet).then(function (result) {
                expect(result[0].articles[0].title).toBe('ąśćńłóżźĄŚŻĆŃÓŁ');
                expect(result[0].articles[0].description).toBe('ąśćńłóżźĄŚŻĆŃÓŁ');
                done = true;
            });
            waitsFor(function () { return done; }, "timeout", 500);
        });
        
    });
    
});