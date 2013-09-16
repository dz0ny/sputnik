'use strict';

function AppCtrl($scope, $location, configService, feedsService, faviconsService, updateService) {
    
    var os = require('os');
    var analytics = require('./helpers/analytics');
    var gui = require('nw.gui');
    
    var win = gui.Window.get();
    var scheduleInterval;
    var messageForReadCtrl = 'firstRun';
    
    $scope.config = configService;
    $scope.allTags = [];
    
    feedsService.init()
    .then(function () {
        $scope.allTags = feedsService.allTags;
    });
    
    updateService.init(configService.checkUpdatesUrl, configService.version);
    analytics.init(configService.analyticsUrl, configService.guid, configService.version);
    
    //-----------------------------------------------------
    // Preserving window size
    //-----------------------------------------------------
    
    var winState;
    var currWinMode;
    var resizeTimeout;
    var isMaximizationEvent = false;
    
    function initWindowState() {
        winState = JSON.parse(localStorage.windowState || 'null');
        
        if (winState) {
            currWinMode = winState.mode;
            if (currWinMode === 'maximized') {
                win.maximize();
            } else {
                restoreWindowState();
            }
        } else {
            currWinMode = 'normal';
            dumpWindowState();
        }
        
        win.show();
    }
    
    function dumpWindowState() {
        if (!winState) {
            winState = {};
        }
        
        // we don't want to save minimized state, only maximized or normal
        if (currWinMode === 'maximized') {
            winState.mode = 'maximized';
        } else {
            winState.mode = 'normal';
        }
        
        // when window is maximized you want to preserve normal
        // window dimensions to restore them later (even between sessions)
        if (currWinMode === 'normal') {
            winState.x = win.x;
            winState.y = win.y;
            winState.width = win.width;
            winState.height = win.height;
        }
    }
    
    function restoreWindowState() {
        win.resizeTo(winState.width, winState.height);
        win.moveTo(winState.x, winState.y);
    }
    
    function saveWindowState() {
        dumpWindowState();
        localStorage.windowState = JSON.stringify(winState);
    }
    
    initWindowState();
    
    win.on('maximize', function () {
        isMaximizationEvent = true;
        currWinMode = 'maximized';
    });
    
    win.on('unmaximize', function () {
        currWinMode = 'normal';
        restoreWindowState();
    });
    
    win.on('minimize', function () {
        currWinMode = 'minimized';
    });
    
    win.on('restore', function () {
        currWinMode = 'normal';
    });
    
    win.window.addEventListener('resize', function () {
        // resize event is fired many times on one resize action,
        // this hack with setTiemout forces it to fire only once
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function () {
            
            // on MacOS you can resize maximized window, so it's no longer maximized
            if (isMaximizationEvent) {
                // first resize after maximization event should be ignored
                isMaximizationEvent = false;
            } else {
                if (currWinMode === 'maximized') {
                    currWinMode = 'normal';
                }
            }
            
            dumpWindowState();
            
        }, 500);
    }, false);
    
    //-----------------------------------------------------
    // App about to close
    //-----------------------------------------------------
    
    win.on('close', function () {
        this.hide(); // pretend to be closed already
        saveWindowState();
        this.close(true);
    });
    
    //-----------------------------------------------------
    // Misc feeds stuff
    //-----------------------------------------------------
    
    $scope.$on('feedAdded', function (evt, feed) {
        // if new feed added, try to load favicon for it
        if (feed.siteUrl) {
            faviconsService.updateOne(feed)
            .then(function () {
                $scope.$apply();
            });
        }
        messageForReadCtrl = 'feedAdded';
    });
    
    feedsService.central.events.on('feedRemoved', function (feed) {
        faviconsService.deleteFaviconIfHas(feed);
    });
    
    $scope.$on('importFeedsSuccess', function (evt) {
        messageForReadCtrl = 'feedsImported';
        faviconsService.updateMany(feedsService.central.feeds);
    });
    
    $scope.$on('readCtrlInstantiated', function (evt, messageFunc) {
        if (messageForReadCtrl) {
            messageFunc(messageForReadCtrl);
            messageForReadCtrl = undefined;
        }
    });
    
    $scope.$on('tagsChanged', function (evt) {
        $scope.allTags = feedsService.allTags;
        $scope.$apply();
    });
    
    //-----------------------------------------------------
    // Open link in system default browser,
    // if has class 'js-external-link' somewhere in DOM chain.
    //-----------------------------------------------------
    
    function supportExternalLinks(event) {
        
        var href;
        var isExternal = false;
        
        function crawlDom(element) {
            if (element.nodeName.toLowerCase() === 'a') {
                href = element.getAttribute('href');
            }
            if (element.classList.contains('js-external-link')) {
                isExternal = true;
            }
            
            if (href && isExternal) {
                gui.Shell.openExternal(href);
                event.preventDefault();
            } else if (element.parentElement) {
                crawlDom(element.parentElement);
            }
        }
        
        crawlDom(event.target);
    }
    
    document.body.addEventListener('click', supportExternalLinks, false);
    
    //-----------------------------------------------------
    // Checking for new version
    //-----------------------------------------------------
    
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
            if (!updateService.isNewerVersion(configService.newAppVersion.version)) {
                // app was updated to latest version, so we can erase this info
                configService.newAppVersion = null;
            } else {
                $scope.newVersionAvailable = configService.newAppVersion.version;
            }
        }
    }
    
    displayNewVersionAvailable();
    //checkNewVersion();
    
    //-----------------------------------------------------
    // Schedule
    //-----------------------------------------------------
    
    function daysToMs(numDays) {
        return numDays * 24 * 60 * 60 * 1000;
    }
    
    function walkThroughSchedule() {
        
        var today = new Date();
        var nowTime = Date.now();
        
        // once every day send analytics daily hit
        var lastAnalyticsDailyHit = configService.getSchedule('lastAnalyticsDailyHit');
        var todayDate = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
        if (todayDate !== lastAnalyticsDailyHit) {
            analytics.dailyHit();
            configService.setSchedule('lastAnalyticsDailyHit', todayDate);
        }
        
        // once every month send reaport about basic usage informations
        var nextAnalyticsMonthlyReaport = configService.getSchedule('nextAnalyticsMonthlyReaport') || 0;
        if (nextAnalyticsMonthlyReaport === 0) {
            // first reaport in 7 days
            configService.setSchedule('nextAnalyticsMonthlyReaport', nowTime + daysToMs(7));
        } else if (nextAnalyticsMonthlyReaport <= nowTime) {
            analytics.monthlyReaport({
                feedsCount: feedsService.central.feeds.length,
                categoriesCount: feedsService.central.categoriesNames.length,
                articlesDbSize: feedsService.articlesDbSize,
                platform: configService.targetPlatform + '|' + os.platform() + '|' + os.type() + '|' + os.release(),
                windowSize: win.width + 'x' + win.height
            });
            configService.setSchedule('nextAnalyticsMonthlyReaport', nowTime + daysToMs(30));
        }
        
        // check for new version every 7 days
        var nextCheckForUpdates = configService.getSchedule('nextCheckForUpdates') || 0;
        if (nextCheckForUpdates <= nowTime) {
            configService.setSchedule('nextCheckForUpdates', nowTime + daysToMs(7));
            checkNewVersion();
        }
        
        // update all feeds' favicons every 7 days
        var nextFaviconUpdate = configService.getSchedule('nextFaviconUpdate') || 0;
        if (nextFaviconUpdate <= nowTime) {
            faviconsService.updateMany(feedsService.central.feeds);
            configService.setSchedule('nextFaviconUpdate', nowTime + daysToMs(7));
        }
        
    }
    
    // every 30min walk through schedule
    scheduleInterval = setInterval(walkThroughSchedule, 1800000);
    walkThroughSchedule();
}