'use strict';

function AppCtrl($scope, $location, configService, feedsService, faviconsService, updateService) {
    
    var os = require('os');
    var analytics = require('./helpers/analytics');
    var gui = require('nw.gui');
    var win = gui.Window.get();
    var scheduleInterval;
    var messageForReadCtrl = 'firstRun';
    
    $scope.config = configService;
    
    updateService.init(configService.checkUpdatesUrl, configService.version);
    analytics.init(configService.analyticsUrl);
    
    var winState = configService.windowState;
    if (winState) {
        win.x = winState.x;
        win.y = winState.y;
        win.width = winState.width;
        win.height = winState.height;
    } else {
        winState = {
            mode: 'normal',
            x: win.x,
            y: win.y,
            width: win.width,
            height: win.height
        };
    }
    
    function saveWindowState() {
        if (winState.mode === 'normal') {
            winState.x = win.x;
            winState.y = win.y;
            winState.width = win.width;
            winState.height = win.height;
        }
        configService.windowState = winState;
    }
    
    win.on('maximize', function () {
        winState.mode = 'maximized';
    });
    win.on('unmaximize', function () {
        winState.mode = 'normal';
        win.resizeTo(winState.width, winState.height);
        win.moveTo(winState.x, winState.y);
    });
    
    win.show();
    
    if (winState.mode === 'maximized') {
        win.maximize();
    }
    
    
    
    // operations to do when application is about to close
    win.on('close', function () {
        this.hide(); // pretend to be closed already
        saveWindowState();
        this.close(true);
    });
    
    
    
    function updateFaviconFor(feed) {
        faviconsService.updateOne(feed)
        .done(function () {
            $scope.$apply();
        });
    }
    
    feedsService.central.events.on('feedAdded', function (feed) {
        // if new feed added, try to load favicon for it
        if (feed.siteUrl) {
            updateFaviconFor(feed);
        } else {
            // if no siteUrl specified new feed will be updating its model
            // and finally we should get the site url
            feed.events.on('modelChanged', function (whatChanged) {
                if (whatChanged === 'siteUrl') {
                    updateFaviconFor(feed);
                }
            });
        }
        messageForReadCtrl = 'feedAdded';
    });
    
    $scope.$on('importFeedsSuccess', function (evt) {
        messageForReadCtrl = 'feedsImported';
    });
    
    $scope.$on('readCtrlInstantiated', function (evt, messageFunc) {
        if (messageForReadCtrl) {
            messageFunc(messageForReadCtrl);
            messageForReadCtrl = undefined;
        }
    });
    
    // catch all link clicks and open them in external browser
    angular.element('body').on('click', function (ev) {
        
        var href;
        var isExternal = false;
        
        function crawlEventChain(element) {
            if (element.nodeName.toLowerCase() === 'a') {
                href = element.getAttribute('href');
            }
            if (angular.element(element).hasClass('js-external-link')) {
                isExternal = true;
            }
            if (element.parentElement) {
                crawlEventChain(element.parentElement);
            }
        }
        
        if (ev.originalEvent) {
            crawlEventChain(ev.originalEvent.target);
        }
        
        if (href && isExternal) {
            gui.Shell.openExternal(href);
            ev.preventDefault();
        }
    });
    
    //-----------------------
    // CHECKING FOR NEW VERSION
    //-----------------------
    
    function checkNewVersion() {
        updateService.checkUpdates()
        .then(function (newVersion) {
            configService.newAppVersion = {
                version: newVersion
            };
            displayNewVersionAvailable();
        });
    }
    
    function displayNewVersionAvailable() {
        if (configService.newAppVersion) {
            if (configService.newAppVersion.version === configService.version) {
                // app was updated
                configService.newAppVersion = null;
            } else {
                $scope.newVersionAvailable = configService.newAppVersion.version;
            }
        }
    }
    
    displayNewVersionAvailable();
    //checkNewVersion();
    
    //-----------------------
    // SCHEDULE
    //-----------------------
    
    function daysToMs(numDays) {
        return numDays * 24 * 60 * 60 * 1000;
    }
    
    function getAnalyticsBaseObj() {
        return {
            guid: configService.guid,
            version: configService.version
        };
    }
    
    function walkThroughSchedule() {
        
        var today = new Date();
        var nowTime = Date.now();
        
        // once every day send analytics daily hit
        var lastAnalyticsDailyHit = configService.getSchedule('lastAnalyticsDailyHit');
        var todayDate = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
        if (todayDate !== lastAnalyticsDailyHit) {
            analytics.dailyHit(getAnalyticsBaseObj());
            configService.setSchedule('lastAnalyticsDailyHit', todayDate);
        }
        
        // once every month send reaport about basic usage informations
        var nextAnalyticsMonthlyReaport = configService.getSchedule('nextAnalyticsMonthlyReaport') || 0;
        if (nextAnalyticsMonthlyReaport === 0) {
            // first reaport in 7 days
            configService.setSchedule('nextAnalyticsMonthlyReaport', nowTime + daysToMs(7));
        } else if (nextAnalyticsMonthlyReaport <= nowTime) {
            var a = getAnalyticsBaseObj();
            a.feedsCount = feedsService.central.all.length;
            a.categoriesCount = feedsService.central.categoriesNames.length;
            a.articlesDbSize = feedsService.articlesDbSize;
            a.platform = configService.targetPlatform + '|' + os.platform() + '|' + os.type() + '|' + os.release();
            a.windowSize = win.width + 'x' + win.height;
            analytics.monthlyReaport(a);
            configService.setSchedule('nextAnalyticsMonthlyReaport', nowTime + daysToMs(30));
        }
        
        var nextCheckForUpdates = configService.getSchedule('nextCheckForUpdates') || 0;
        if (nextCheckForUpdates <= nowTime) {
            configService.setSchedule('nextCheckForUpdates', nowTime + daysToMs(14));
            checkNewVersion();
        }
        
        // update all feeds' favicons every 7 days
        var nextFaviconUpdate = configService.getSchedule('nextFaviconUpdate') || 0;
        if (nextFaviconUpdate <= nowTime) {
            faviconsService.updateMany(feedsService.central.all);
            configService.setSchedule('nextFaviconUpdate', nowTime + daysToMs(2));
        }
        
    }
    
    // every 30min walk through schedule
    scheduleInterval = setInterval(walkThroughSchedule, 1800000);
    walkThroughSchedule();
}