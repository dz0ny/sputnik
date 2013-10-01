'use strict';

describe('feedScout', function () {
    
    var fs = require('fs');
    
    var netMock = require('./mocks/net');
    var feedParser = require('../app/helpers/feedParser');
    var scout = require('../app/helpers/feedScout');
    
    var atomXml = fs.readFileSync('./data/atom.xml');
    var rss2Xml = fs.readFileSync('./data/rss2.xml');
    
    var htmlLinkAtom = '<html><head><link href="http://atom-xml" title="The Site" type="application/atom+xml"></head></html>';
    var htmlLinkRss = '<html><head><link href="http://rss2-xml" title="The Site" type="application/rss+xml"></head></html>';
    // sometimes relative links are given
    var htmlLinkRelativeRss = '<html><head><link href="/rss2-xml" title="The Site" type="application/rss+xml"></head></html>';
    // HTML has link to RSS, but this link returns 404
    var htmlLink404 = '<html><head><link href="http://404" title="The Site" type="application/rss+xml"></head></html>';
    // HTML has link to RSS, but this link returns invalid RSS
    var htmlLinkHtml = '<html><head><link href="http://html-link-rss" title="The Site" type="application/rss+xml"></head></html>';
    var htmlNoLink = '<html><head></head></html>';
    
    netMock.injectUrlMap({
        "http://atom-xml": atomXml,
        "http://rss2-xml": rss2Xml,
        "http://html-link-atom": htmlLinkAtom,
        "http://html-link-rss": htmlLinkRss,
        "http://html-link-relative-rss": htmlLinkRelativeRss,
        "http://html-link-relative-rss/rss2-xml": rss2Xml,
        "http://html-no-link": htmlNoLink,
        "http://html-link-404": htmlLink404,
        "http://html-link-html": htmlLinkHtml,
    });

    
    it("should return nothing if 404", function () {
        var done = false;
        scout.scout('http://404', netMock, feedParser).fail(function () {
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it("should deal with Atom XML", function () {
        var done = false;
        scout.scout('http://atom-xml', netMock, feedParser).then(function (feedUrl) {
            expect(feedUrl).toBe('http://atom-xml');
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it("should deal with RSS XML", function () {
        var done = false;
        scout.scout('http://rss2-xml', netMock, feedParser).then(function (feedUrl) {
            expect(feedUrl).toBe('http://rss2-xml');
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it("should deal with HTML with <link> to Atom", function () {
        var done = false;
        scout.scout('http://html-link-atom', netMock, feedParser).then(function (feedUrl) {
            expect(feedUrl).toBe('http://atom-xml');
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it("should deal with HTML with <link> to RSS", function () {
        var done = false;
        scout.scout('http://html-link-rss', netMock, feedParser).then(function (feedUrl) {
            expect(feedUrl).toBe('http://rss2-xml');
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it("should deal with HTML with RELATIVE <link> to RSS", function () {
        var done = false;
        scout.scout('http://html-link-relative-rss', netMock, feedParser).then(function (feedUrl) {
            expect(feedUrl).toBe('http://html-link-relative-rss/rss2-xml');
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it("should return nothing if HTML has no <link> tag", function () {
        var done = false;
        scout.scout('http://html-no-link', netMock, feedParser).fail(function () {
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it("should return nothing if HTMLs <link> gets 404", function () {
        var done = false;
        scout.scout('http://html-link-404', netMock, feedParser).fail(function () {
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
    it("should return nothing if HTMLs <link> gets HTML instead of feed format", function () {
        var done = false;
        scout.scout('http://html-link-html', netMock, feedParser).fail(function () {
            done = true;
        });
        waitsFor(function () { return done; }, "timeout", 500);
    });
    
});