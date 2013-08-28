'use strict';

var Q = require('q');
var net = require('./net');
var urlUtil = require('url');
var cheerio = require('cheerio');
var iconv = require('iconv-lite');
var FeedParser = require('feedparser');

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

function parseFeed(body) {
    var Stream = require('stream');
    var deferred = Q.defer();
    var meta;
    var articles = [];
    
    var s = new Stream();
    s.readable = true;
    
    s.pipe(new FeedParser())
    .on('error', deferred.reject)
    .on('meta', function (m) {
        meta = m;
    })
    .on('readable', function () {
        var stream = this;
        var item = stream.read();
        while (item) {
            articles.push(item);
            item = stream.read();
        }
    })
    .on('end', function () {
        deferred.resolve({
            meta: meta,
            articles: articles
        });
    });
    
    s.emit('data', body);
    s.emit('end');
    
    return deferred.promise;
}

function normalizeEncoding(bodyBuf) {
    var body = bodyBuf.toString();
    var encoding;
    
    var xmlDeclaration = body.match(/^<\?xml .*\?>/);
    if (xmlDeclaration) {
        var encodingDeclaration = xmlDeclaration[0].match(/encoding=("|').*("|')/);
        if (encodingDeclaration) {
            encoding = encodingDeclaration[0].substring(10, encodingDeclaration[0].length - 1);
        }
    }
    
    if (encoding && encoding.toLowerCase() !== 'utf-8') {
        try {
            body = iconv.decode(bodyBuf, encoding);
        } catch (err) {
            // detected encoding is not supported, leave it as it is
        }
    }
    
    return body;
}

exports.discoverFeedUrl = function (url, requester) {
    var deferred = Q.defer();
    requester = requester || net;
    
    if (!url.match(/^http/)) {
        url = 'http://' + url;
    }
    
    // download given url
    requester.getUrl(url).then(function (body) {
        body = body.toString();
        // see if it is feed xml or something else
        parseFeed(body).then(function () {
            deferred.resolve(url);
        }, function () {
            // if not, treat it as html and try to find rss tag inside
            var foundFeedUrl = findFeedUrlInHtml(body, url);
            if (foundFeedUrl) {
                // download found url, and check if it is appropriate format
                requester.getUrl(foundFeedUrl).then(function (body) {
                    body = body.toString();
                    // check if feed format to be sure url works
                    parseFeed(body).then(function () {
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

exports.getFeeds = function (feedUrls, requester) {
    var deferred = Q.defer();
    requester = requester || net;
    var completedTasks = 0;
    var results = [];
    
    function tickTask() {
        completedTasks += 1;
        deferred.notify({
            completed: completedTasks,
            total: feedUrls.length
        });
        if (completedTasks === feedUrls.length) {
            deferred.resolve(results);
        }
    }
    
    feedUrls.forEach(function (url) {
        requester.getUrl(url).then(function (bodyBuf) {
            
            var body = normalizeEncoding(bodyBuf);
            
            parseFeed(body).then(function (result) {
                result.url = url;
                results.push(result);
                tickTask();
            }, function (err) {
                //console.log(err)
                //console.log(url)
                tickTask();
            });
            
        }, function (err) {
            //console.log(err)
            //console.log(url)
            tickTask();
        });
    });
    
    return deferred.promise;
};