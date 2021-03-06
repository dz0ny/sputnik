'use strict';

function AppCtrl($scope, $location, config, feedsService, articlesService, faviconsService, updateService) {
    
    var os = require('os');
    var analytics = require('./helpers/analytics');
    var gui = require('nw.gui');
    var win = gui.Window.get();
    
    $scope.allTags = [];
    
    $scope.lastSignificantEvent = 'appJustStarted';
    
    analytics.init(config.analyticsUrl, config.guid, config.version);
    
    //-----------------------------------------------------
    // Notification bar
    //-----------------------------------------------------
    
    var notificationInterval;
    $scope.notificationBarVisible = false;
    $scope.notificationMessage = null;
    
    $scope.$on('showNotification', function (evt, message) {
        $scope.notificationMessage = message;
        $scope.notificationBarVisible = true;
        $scope.$apply();
        
        // calculate position for notification bar
        var xAxis = $('.column-one').width() + $('.column-two').width() / 2;
        var notifBar = $('.notification-bar');
        var left = xAxis - notifBar.width() / 2 - 32;
        notifBar.css('left', left);
        
        var duration = Math.max(4000, message.length * 120);
        clearInterval(notificationInterval);
        notificationInterval = setInterval(function () {
            $scope.notificationBarVisible = false;
            $scope.$apply();
        }, duration);
    });
    
    //-----------------------------------------------------
    // Model events
    //-----------------------------------------------------
    
    $scope.$on('feedAdded', function (evt, feed) {
        $scope.lastSignificantEvent = 'feedAdded';
    });
    
    $scope.$on('feedSiteUrlSpecified', function (evt, feed) {
        // is siteUrl first time specified try to get its favicon
        faviconsService.updateOne(feed);
    });
    
    $scope.$on('feedRemoved', function (evt, feed) {
        faviconsService.deleteFaviconIfHas(feed);
        // Articles for now are not deleted (seems more user friendly approach)
    });
    
    $scope.$on('feedsImported', function (evt) {
        faviconsService.updateMany(feedsService.feeds);
        $scope.lastSignificantEvent = 'feedsImported';
    });
    
    $scope.$on('tagsListChanged', function (evt) {
        $scope.allTags = articlesService.allTags;
    });
    
    $scope.$on('faviconUpdated', function (evt) {
        $scope.$apply();
    });
    
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
                // reset to safe defaults when something unusable was saved
                if (winState.x < -10 || winState.x > window.screen.width) {
                    winState.x = 0;
                }
                if (winState.y < -10 || winState.y > window.screen.height) {
                    winState.y = 0;
                }
                
                restoreWindowState();
            }
        } else {
            currWinMode = 'normal';
            
            // if nothing saved yet find best default size
            if (window.screen.width > 1024) {
                win.width = 1180;
                win.x = (window.screen.width - win.width) / 2;
            }
            if (window.screen.height > 768) {
                win.height = window.screen.height - 100;
                win.y = (window.screen.height - win.height) / 2;
            }
            
            dumpWindowState();
        }
        
        setTimeout(function () {
            win.show();
        }, 300);
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
    
    function checkForUpdates() {
        updateService.checkUpdates()
        .then(function (newVersion) {
            localStorage.newAppVersion = JSON.stringify({
                version: newVersion
            });
            displayNewVersionAvailable();
            $scope.$apply();
        });
    }
    
    function displayNewVersionAvailable() {
        var newAppVersion = JSON.parse(localStorage.newAppVersion || 'null');
        if (newAppVersion) {
            if (!updateService.isNewerVersion(newAppVersion.version)) {
                // app was updated to latest version, so we can erase this info
                localStorage.removeItem('newAppVersion');
            } else {
                $scope.newVersionAvailable = newAppVersion.version;
            }
        }
    }
    
    displayNewVersionAvailable();
    
    //-----------------------------------------------------
    // Schedule
    //-----------------------------------------------------
    
    function daysToMs(numDays) {
        return numDays * 24 * 60 * 60 * 1000;
    }
    
    function walkThroughSchedule() {
        
        var schedule = JSON.parse(localStorage.schedule || '{}');
        
        var today = new Date();
        var nowTime = Date.now();
        
        // once every day send analytics daily hit
        var todayDate = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
        if (todayDate !== schedule.lastAnalyticsDailyHit) {
            analytics.dailyHit();
            schedule.lastAnalyticsDailyHit = todayDate;
        }
        
        // once every month send reaport about basic usage informations
        if (!schedule.nextAnalyticsMonthlyReaport) {
            // first reaport in 7 days
            schedule.nextAnalyticsMonthlyReaport = nowTime + daysToMs(7);
        } else if (schedule.nextAnalyticsMonthlyReaport <= nowTime) {
            analytics.monthlyReaport({
                feedsCount: feedsService.feeds.length,
                categoriesCount: feedsService.categoriesNames.length,
                tagsCount: articlesService.allTags.length,
                articlesDbSize: articlesService.dbSize,
                platform: config.targetPlatform + '|' + os.platform() + '|' + os.type() + '|' + os.release(),
                windowSize: win.width + 'x' + win.height
            });
            schedule.nextAnalyticsMonthlyReaport = nowTime + daysToMs(30);
        }
        
        // check for new version every 7 days
        if (!schedule.nextCheckForUpdates || schedule.nextCheckForUpdates <= nowTime) {
            schedule.nextCheckForUpdates = nowTime + daysToMs(7);
            checkForUpdates();
        }
        
        // update all feeds' favicons every 7 days
        if (!schedule.nextFaviconUpdate || schedule.nextFaviconUpdate <= nowTime) {
            faviconsService.updateMany(feedsService.feeds);
            schedule.nextFaviconUpdate = nowTime + daysToMs(7);
        }
        
        // perform database compaction every 7 days
        if (!schedule.nextDatabaseCompaction || schedule.nextDatabaseCompaction <= nowTime) {
            // assume month is 31 days
            var olderThan = nowTime - (config.keepArticlesForMonths * 31 * 24 * 60 * 60 * 1000);
            articlesService.removeOlderThan(olderThan, config.keepTaggedArticlesForever)
            .then(function (numRemoved) {
                // done
            });
            schedule.nextDatabaseCompaction = nowTime + daysToMs(3);
        }
        
        // save changed schedule after every run
        localStorage.schedule = JSON.stringify(schedule);
    }
    
    // every 30min walk through schedule
    var scheduleInterval = setInterval(walkThroughSchedule, 1800000);
    // first schedule do after 1 minute from startup
    setTimeout(walkThroughSchedule, 30000);
}