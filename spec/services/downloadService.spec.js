'use strict';

describe('downloadService', function () {
    
    var Q = require('q');
    var fs = require('fs');
    var moment = require('moment');
    
    var feedsStorage = require('../app/models/feedsStorage');
    var articlesStorage = require('../app/models/articlesStorage');
    var feedParser = require('../app/helpers/feedParser');
    var netMock = require('./mocks/net.mock');
    
    var net = netMock.make({
        "http://atom-xml": fs.readFileSync('./data/atom.xml'),
        "http://rss2-xml": fs.readFileSync('./data/rss2.xml'),
        "http://html": '<html><head></head></html>',
        
        // just pass on this values
        "a.com/feed": 'a.com/feed',
        "b.com/feed": 'b.com/feed',
    });
    
    beforeEach(module('sputnik', function($provide) {
        $provide.value('feedsStorage', feedsStorage.make());
        $provide.value('articlesStorage', articlesStorage.make());
        $provide.value('net', net);
        $provide.value('opml', {});
        $provide.value('feedParser', feedParser);
        $provide.value('config', {});
    }));
    
    describe('calculating feeds average activity', function () {
        
        it('should assume super active if no article on the list', inject(function (downloadService) {
            var avgAct = downloadService.calculateAverageActivity([]);
            expect(avgAct).toBe(0);
        }));
        
        it('should calculate if only one article provided', inject(function (downloadService) {
            var avgAct = downloadService.calculateAverageActivity([
                { pubDate: moment().subtract('hours', 12)._d },
            ]);
            expect(avgAct).toBe(12);
        }));
        
        it('should calculate typical case', inject(function (downloadService) {
            var avgAct = downloadService.calculateAverageActivity([
                { pubDate: moment().subtract('hours', 1)._d },
                { pubDate: moment().subtract('hours', 2)._d },
                { pubDate: moment().subtract('hours', 3)._d },
                { pubDate: moment().subtract('hours', 4)._d },
                { pubDate: moment().subtract('hours', 5)._d },
            ]);
            expect(avgAct).toBe(1);
            avgAct = downloadService.calculateAverageActivity([
                { pubDate: moment().subtract('hours', 2)._d },
                { pubDate: moment().subtract('hours', 4)._d },
                { pubDate: moment().subtract('hours', 6)._d },
                { pubDate: moment().subtract('hours', 8)._d },
                { pubDate: moment().subtract('hours', 10)._d },
            ]);
            expect(avgAct).toBe(2);
        }));
        
    });
    
    describe('preparing fetch baskets', function () {
        
        it('if no averageActivity place everything in HI basket', inject(function (feedsService, config, downloadService) {
            config.lastFeedsDownload = moment().valueOf();
            feedsService.addFeed({
                url: 'a.com/feed'
            });
            feedsService.addFeed({
                url: 'b.com/feed'
            });
            var baskets = downloadService.getActivityBaskets()
            expect(baskets.hi).toEqual(['a.com/feed', 'b.com/feed']);
            expect(baskets.lo).toEqual([]);
        }));
        
        it('if last download was more than 3 days ago place everything in HI basket', inject(function (feedsService, config, downloadService) {
            config.lastFeedsDownload = moment().subtract('hours', 73).valueOf();
            feedsService.addFeed({
                url: 'a.com/feed',
                averageActivity: 1,
            });
            feedsService.addFeed({
                url: 'b.com/feed',
                averageActivity: 250, // should be in hi basket although activity not indicates that
            });
            var baskets = downloadService.getActivityBaskets()
            expect(baskets.hi).toEqual(['a.com/feed', 'b.com/feed']);
            expect(baskets.lo).toEqual([]);
            
        }));
        
        // if someone hits refresh after 10min from last one none feeds will go into hi basket, so force more sensible behaviour then
        it('if last download was less than 24h ago place in HI basket things like it was 24h ago', inject(function (feedsService, config, downloadService) {
            config.lastFeedsDownload = moment().subtract('hours', 1).valueOf();
            feedsService.addFeed({
                url: 'a.com/feed',
                averageActivity: 25,
            });
            feedsService.addFeed({
                url: 'b.com/feed',
                averageActivity: 73,
            });
            var baskets = downloadService.getActivityBaskets()
            expect(baskets.hi).toEqual(['a.com/feed']);
            expect(baskets.lo).toEqual(['b.com/feed']);
        }));
        
        it('if HI basket is empty LO basket should be switched to HI', inject(function (feedsService, config, downloadService) {
            config.lastFeedsDownload = moment().subtract('hours', 1).valueOf();
            feedsService.addFeed({
                url: 'a.com/feed',
                averageActivity: 73,
            });
            feedsService.addFeed({
                url: 'b.com/feed',
                averageActivity: 74,
            });
            var baskets = downloadService.getActivityBaskets()
            expect(baskets.hi).toEqual(['a.com/feed', 'b.com/feed']);
            expect(baskets.lo).toEqual([]);
        }));
        
    });
    
    describe('xmls fetching', function () {
        
        it("should fetch feeds' xmls", inject(function (downloadService) {
            var done = false;
            var firedProgressCount = 0;
            var feedUrls = [
                'timeout',
                'not-found',
                'unknown-error',
                'http://404',
                'http://html', // html instead of feed xml to test edge case
                'http://atom-xml',
                'http://rss2-xml',
            ];
            downloadService.fetchFeeds(feedUrls, 'normal')
            .then(
                function () {
                    expect(firedProgressCount).toBe(7);
                    done = true;
                },
                null,
                // progress fired with any just fetched feed
                function (progress) {
                    
                    firedProgressCount += 1;
                    
                    expect(progress.completed).toBeGreaterThan(0);
                    expect(progress.completed).toBeLessThan(feedUrls.length + 1);
                    expect(progress.total).toBe(feedUrls.length);
                    
                    switch (progress.url) {
                        case 'not-found':
                            expect(progress.status).toBe('notFound');
                            expect(progress.meta).toEqual({});
                            expect(progress.articles).toEqual([]);
                            break;
                        case 'timeout':
                            expect(progress.status).toBe('timeout');
                            expect(progress.meta).toEqual({});
                            expect(progress.articles).toEqual([]);
                            break;
                        case 'unknown-error':
                            expect(progress.status).toBe('unknownError');
                            expect(progress.meta).toEqual({});
                            expect(progress.articles).toEqual([]);
                            break;
                        case 'http://404':
                            expect(progress.status).toBe('404');
                            expect(progress.meta).toEqual({});
                            expect(progress.articles).toEqual([]);
                            break;
                        case 'http://html-no-link':
                            expect(progress.status).toBe('parseError');
                            expect(progress.meta).toEqual({});
                            expect(progress.articles).toEqual([]);
                            break;
                        case 'http://atom-xml':
                            expect(progress.status).toBe('ok');
                            break;
                        case 'http://rss2-xml':
                            expect(progress.status).toBe('ok');
                            break;
                    }
                }
            );
            waitsFor(function () { return done; }, null, 500);
        }));
        
        it("should terminate if 5 errors in a row (what means we don't have connection)", inject(function (downloadService) {
            var done = false;
            var feedUrls = [
                'timeout',
                'not-found',
                'timeout',
                'not-found',
                'timeout',
                'not-found',
            ];
            downloadService.fetchFeeds(feedUrls, 'normal')
            .then(
                null,
                function (err) {
                    expect(err).toBe('No connection');
                    done = true;
                }
            );
            waitsFor(function () { return done; }, null, 500);
        }));
        
    });
    
    describe('main API', function () {
        
        function generateArticles(num, timeGap) {
            var arts = [];
            while (num > 0) {
                arts.push({
                    title: "title",
                    description: "description",
                    link: "link" + num,
                    pubDate: moment().subtract('hours', (arts.length + 1) * timeGap)._d,
                });
                num -= 1;
            }
            return arts;
        }
        
        var articles = {
            'a.com/feed': generateArticles(3, 48),
            'b.com/feed': generateArticles(9, 600),
        };
        
        beforeEach(module('sputnik', function($provide) {
            $provide.value('feedParser', {
                parse: function (key) {
                    var deferred = Q.defer();
                    deferred.resolve({
                        meta: {},
                        articles: articles[key]
                    });
                    return deferred.promise;
                }
            });
        }));
        
        it('should work', inject(function (config, feedsService, articlesService, downloadService) {
            var doneCount = 0;
            
            config.lastFeedsDownload = moment().subtract('days', 2).valueOf();
            
            feedsService.addFeed({
                url: 'a.com/feed',
                averageActivity: 5
            });
            feedsService.addFeed({
                url: 'b.com/feed',
                averageActivity: 999
            });
            
            var feedA = feedsService.getFeedByUrl('a.com/feed');
            var feedB = feedsService.getFeedByUrl('b.com/feed');
            
            expect(feedA.averageActivity).toBe(5);
            expect(feedB.averageActivity).toBe(999);
            
            expect(downloadService.isWorking).toBe(false);
            
            downloadService.download()
            .then(function (backgroundDownloadPromise) {
                
                expect(feedA.averageActivity).toBe(48);
                
                // only main job is indicated by isWorking
                expect(downloadService.isWorking).toBe(false);
                
                // should have saved time of this download
                expect(config.lastFeedsDownload).toBeGreaterThan(moment().subtract('minute', 1).valueOf());
                
                // digested articles should be accesible through articlesService
                articlesService.getArticles(['a.com/feed'], 0, 100)
                .then(function (result) {
                    expect(result.numAll).toBe(3);
                    doneCount += 1;
                });
                
                return backgroundDownloadPromise;
            })
            .then(function () {
                
                expect(feedB.averageActivity).toBe(600);
                
                // digested articles should be accesible through articlesService
                articlesService.getArticles(['b.com/feed'], 0, 100)
                .then(function (result) {
                    expect(result.numAll).toBe(9);
                    doneCount += 1;
                });
                
            });
            
            expect(downloadService.isWorking).toBe(true);
            
            waitsFor(function () { return doneCount === 2; }, null, 500);
        }));
        
        it('should try to download again in background feed which in normal mode got timeout', inject(function (net, feedsService, downloadService) {
            var done = false;
            var spy = jasmine.createSpy();
            net.injectGeturlSpy(spy);
            feedsService.addFeed({
                url: 'timeout',
            });
            downloadService.download()
            .then(function (backgroundDownloadPromise) {
                return backgroundDownloadPromise;
            })
            .then(function () {
                expect(spy.callCount).toBe(2);
                done = true;
            });
            waitsFor(function () { return done; }, null, 500);
        }));
        
        it('should give up when 5 timeoust in a row', inject(function (net, feedsService, downloadService) {
            var done = false;
            feedsService.addFeed({
                url: 'timeout1',
            });
            feedsService.addFeed({
                url: 'timeout2',
            });
            feedsService.addFeed({
                url: 'timeout3',
            });
            feedsService.addFeed({
                url: 'timeout4',
            });
            feedsService.addFeed({
                url: 'timeout5',
            });
            downloadService.download()
            .then(null, 
            function (message) {
                expect(message).toBe('No connection');
                expect(downloadService.isWorking).toBe(false);
                done = true;
            });
            waitsFor(function () { return done; }, null, 500);
        }));
        
    });
    
});