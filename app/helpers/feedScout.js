'use strict';

var Q = require('q');
var urlUtil = require('url');
var cheerio = require('cheerio');

function findFeedUrlInHtml(body, url) {
    var dom = cheerio.load(body);
    var href = dom('link[type="application/rss+xml"]').attr('href');
    if (!href) {
        href = dom('link[type="application/atom+xml"]').attr('href');
    }
    if (href) {
        if (!href.match(/^http/)) {
            href = urlUtil.resolve(url, href);
        }
        return href;
    }
    return null;
}

exports.scout = function (url, net, feedParser) {
    var deferred = Q.defer();
    
    if (!url.match(/^http/)) {
        url = 'http://' + url;
    }
    
    // download given url
    net.getUrl(url).then(function (buff) {
        // see if it is feed xml or something else
        feedParser.parse(buff).then(function () {
            deferred.resolve(url);
        }, function () {
            // if not, treat it as html and try to find rss tag inside
            var foundFeedUrl = findFeedUrlInHtml(buff.toString(), url);
            console.log(foundFeedUrl)
            if (foundFeedUrl) {
                // download found url, and check if it is appropriate format
                net.getUrl(foundFeedUrl).then(function (buff) {
                    // check if feed format to be sure url works
                    feedParser.parse(buff).then(function () {
                        deferred.resolve(foundFeedUrl);
                    }, deferred.reject);
                }, deferred.reject);
            } else {
                deferred.reject();
            }
        });
    }, deferred.reject);
    
    return deferred.promise;
};