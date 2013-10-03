'use strict';

sputnik.factory('downloadService', function (net, feedParser, config, feedsService, articlesService) {
    
    var Q = require('q');
    
    var isWorking = false;
    
    //-----------------------------------------------------
    // Helper functions
    //-----------------------------------------------------
    
    function daysToMs(days) {
        return days * 24 * 60 * 60 * 1000;
    }
    
    function getActivityBaskets() {
        var hi = [];
        var lo = [];
        
        var now = Date.now();
        var lastDownload = config.lastFeedsDownload;
        
        // if lastDownload was more than 3 days ago we want to download everything as hi basket
        // because if someone launches the app every 3 days or less often he/she can see the article 6 days after its publication
        if (now - lastDownload > daysToMs(3)) {
            lastDownload = 0;
        }
        
        // force lastDownload to be at least 24 hours ago even if it was 1 minute ago
        if (now - lastDownload < daysToMs(1)) {
            lastDownload = now - daysToMs(1);
        }
        
        var hoursSinceLast = (now - lastDownload) / (60 * 60 * 1000);
        
        feedsService.feeds.forEach(function (feed) {
            // if probability that there is something new on this feed is greater than 33%
            // put it into hi basket, otherwise into lo
            var feedAverageActivity = feed.averageActivity || 0;
            if (hoursSinceLast >= feedAverageActivity * 0.33) {
                hi.push(feed.url);
            } else {
                lo.push(feed.url);
            }
        });
        
        // if hi basket is empty switch lo as hi
        if (hi.length === 0) {
            hi = lo;
            lo = [];
        }
        
        return {
            hi: hi,
            lo: lo
        };
    }
    
    /**
     * Returns average time gap (in hours) between most recent articles publications.
     */
    function calculateAverageActivity(articles) {
        var index = 0;
        // count gap for 5 latest articles, or less if list not that long
        var endIndex = Math.min(5, articles.length);
        // now as the reference point to first article
        var prev = Date.now();
        var gaps = [];
        
        while (index < endIndex) {
            var curr = articles[index].pubDate.getTime();
            gaps.push(prev - curr);
            prev = curr;
            index += 1;
        }
        
        if (gaps.length === 0) {
            return 0;
        }
        var sum = gaps.reduce(function(a, b) { return a + b }, 0);
        // average in miliseconds
        var avg = sum / gaps.length;
        
        // avarage in hours
        return Math.round(avg / (1000 * 60 * 60));
    }
    
    function fetchFeeds(feedUrls, mode) {
        var deferred = Q.defer();
        var index = -1;
        var completed = 0;
        var simultaneousTasks = 5;
        var workingTasks = 0;
        var timeoutsInARow = 0;
        var timeout = 3000;
        
        if (mode === 'background') {
            simultaneousTasks = 3;
            timeout = 8000;
        }
        
        function notify(url, status, meta, articles) {
            
            workingTasks -= 1;
            completed += 1;
            
            if (status === 'notFound' || status === 'timeout') {
                timeoutsInARow += 1;
            } else {
                timeoutsInARow = 0;
            }
            
            if (timeoutsInARow >= 5) {
                deferred.reject('No connection');
                return;
            }
            
            deferred.notify({
                completed: completed,
                total: feedUrls.length,
                url: url,
                status: status,
                meta: meta || {},
                articles: articles || []
            });
            
            if (completed === feedUrls.length) {
                deferred.resolve();
            } else {
                if (workingTasks < simultaneousTasks) {
                    next();
                }
            }
        }
        
        function fetch(url) {
            
            workingTasks += 1;
            
            net.getUrl(url, { timeout: timeout }).then(function (buff) {
                
                feedParser.parse(buff).then(function (result) {
                    notify(url, 'ok', result.meta, result.articles);
                }, function (err) {
                    notify(url, 'parseError');
                });
                
            }, function (err) {
                switch (err.code) {
                    case '404':
                        notify(url, '404');
                        break;
                    case 'ENOTFOUND':
                        notify(url, 'notFound');
                        break;
                    case 'ETIMEDOUT':
                    case 'ESOCKETTIMEDOUT':
                        notify(url, 'timeout');
                        break;
                    default:
                        notify(url, 'unknownError');
                }
            });
        }
        
        function next() {
            index += 1;
            if (index < feedUrls.length) {
                
                fetch(feedUrls[index]);
                
                if (workingTasks < simultaneousTasks) {
                    next();
                }
            }
        }
        
        next();
        
        if (feedUrls.length === 0) {
            deferred.resolve();
        }
        
        return deferred.promise;
    };
    
    function downloadJob(feedUrls, mode) {
        var deferred = Q.defer();
        
        fetchFeeds(feedUrls, mode)
        .then(null, deferred.reject, function progress(prog) {
            
            function passOn() {
                deferred.notify(prog);
                
                if (prog.completed === prog.total) {
                    deferred.resolve();
                }
            }
            
            if (prog.status === 'ok') {
                feedsService.digestFeedMeta(prog.url, prog.meta);
                articlesService.digest(prog.url, prog.articles)
                .then(function () {
                    // notify after articles digested and saved
                    passOn();
                });
                var feed = feedsService.getFeedByUrl(prog.url);
                feed.averageActivity = calculateAverageActivity(prog.articles);
            } else {
                passOn();
            }
        });
        
        return deferred.promise;
    }
    
    //-----------------------------------------------------
    // API methods
    //-----------------------------------------------------
    
    function download() {
        var deferred = Q.defer();
        var baskets = getActivityBaskets();
        
        console.log('Baskets to download ->');
        console.log(baskets);
        
        isWorking = true;
        
        config.lastFeedsDownload = Date.now();
        
        downloadJob(baskets.hi, 'normal')
        .then(function () {
            // after main job start lo basket in background
            isWorking = false;
            deferred.resolve({
                backgroundJob: downloadJob(baskets.lo, 'background')
            });
        },
        function (message) {
            isWorking = false;
            deferred.reject(message);
        },
        function (prog) {
            if (prog.status === 'timeout') {
                // if timeout occured try to download again with lo basket,
                // which is more timeout friendly
                baskets.lo.push(prog.url);
            }
            deferred.notify(prog);
        });
        
        return deferred.promise;
    }
    
    return  {
        download: download,
        get isWorking() {
            return isWorking;
        },
        
        // exposed only for testing
        calculateAverageActivity: calculateAverageActivity,
        getActivityBaskets: getActivityBaskets,
        fetchFeeds: fetchFeeds,
    };
});