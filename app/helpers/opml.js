'use strict';

var xmldoc = require('xmldoc');

exports.isOpml = function (fileContent) {
    var xml = new xmldoc.XmlDocument(fileContent);
    return xml.name === 'opml';
};

exports.import = function (fileContent, addFeedFunc) {
    var xml = new xmldoc.XmlDocument(fileContent);
    
    function addFeed(xmlNode, categoryName) {
        if (!xmlNode.attr.xmlUrl) {
            return;
        }
        addFeedFunc({
            'url': xmlNode.attr.xmlUrl,
            'siteUrl': xmlNode.attr.htmlUrl,
            'title': xmlNode.attr.title || xmlNode.attr.text,
            'category': categoryName
        });
    }
    
    function addCategory(categoryNode, categoryName) {
        categoryNode.eachChild(function (subOutline) {
            if (subOutline.attr.type === 'rss') {
                // feed
                addFeed(subOutline, categoryName);
            } else if (subOutline.children.length > 0) {
                // subcategory
                // not supported in Sputnik, flatten it to main category
                addCategory(subOutline, categoryName);
            }
        });
    }
    
    if (xml.name === 'opml') {
        xml.childNamed('body').eachChild(function (outline) {
            if (outline.attr.type === 'rss') {
                // feed
                addFeed(outline, null);
            } else if (outline.children.length > 0) {
                // category
                var categoryName = outline.attr.title || outline.attr.text;
                addCategory(outline, categoryName);
            }
        });
    }
};

exports.export = function (tree) {
    var builder = require('xmlbuilder');
    
    function feedAttributes(xmlElement, feed) {
        xmlElement.att('text', feed.title);
        xmlElement.att('title', feed.title);
        xmlElement.att('type', 'rss');
        xmlElement.att('xmlUrl', feed.url);
        xmlElement.att('htmlUrl', feed.siteUrl);
    }
    
    var root = builder.create('opml', { 'version': '1.0', 'encoding': 'UTF-8' }).att('version', '1.0');
    root.ele('head').ele('title', 'Subscriptions from Sputnik News Reader');
    var body = root.ele('body');
    tree.forEach(function (item) {
        var element = body.ele('outline');
        if (item.type === 'category') {
            element.att('title', item.name);
            element.att('text', item.name);
            item.feeds.forEach(function (feed) {
                var categoryElement = element.ele('outline');
                feedAttributes(categoryElement, feed);
            });
        } else {
            feedAttributes(element, item);
        }
    });
    
    return root.end({pretty: true});
};