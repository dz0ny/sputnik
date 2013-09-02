'use strict';

function ReadCtrl($scope, $window, feedsService) {
    
    var organizer = require('./helpers/articlesOrganizer');
    
    $scope.state = 'notInitiated';
    
    function refreshFeeds() {
        
        if ($scope.state === 'noFeeds' || $scope.state === 'refreshing') {
            return;
        }
        
        feedsService.downloadFeeds(feedsService.central.all)
        .progress(function (progress) {
            var ratio = Math.round(progress.completed / progress.total * 100);
            angular.element('.refreshing__progress-bar').css('width', ratio + '%');
        })
        .then(loadUnreadArticles);
        
        $scope.state = 'refreshing';
        angular.element('.refreshing__progress-bar').css('width', '0%');
    }
    
    /**
     * 
     */
    function loadUnreadArticles() {
        feedsService.central.loadUnreadArticles()
        .then(function () {
            showArticles();
            $scope.$apply();
        });
    }
    
    function showArticles() {
        $scope.days = organizer.organizeByDays($scope.selectedItem.articles);
        $scope.state = 'articles';
        
        // little hack to scroll to top every time articles list was updated,
        // but articles list is display: none sometimes and then you have
        // to wait for it to appear to set the scroll
        var interval = setInterval(function () {
            var articlesList = angular.element('.js-articles-list');
            if (articlesList.scrollTop() !== 0) {
                articlesList.scrollTop(0);
            } else {
                clearInterval(interval);
            }
            lazyLoadImages();
        }, 1);
    }
    
    $scope.feedsTree = feedsService.central.tree;
    $scope.all = feedsService.central;
    $scope.days = [];
    
    $scope.refresh = refreshFeeds;
    
    $scope.selectedItem = $scope.all;
    $scope.selectItem = function (item) {
        $scope.selectedItem = item;
        if ($scope.state !== 'noFeeds' && $scope.state !== 'refreshing') {
            showArticles();
        }
    };
    
    $scope.markCategoryItemAsRead = function (categoryItem) {
        categoryItem.articles.forEach(function (article) {
            article.setIsRead(true);
        });
    };
    
    if (feedsService.central.all.length === 0) {
        $scope.state = 'noFeeds';
    }
    
    $scope.$emit('readCtrlInstantiated', function (message) {
        switch (message) {
        case 'feedAdded':
            loadUnreadArticles();
            break;
        case 'feedsImported':
        case 'firstRun':
            refreshFeeds();
            break;
        }
    });
    
    if ($scope.state === 'notInitiated') {
        showArticles();
    }
    
    //-----------------------------------------------------
    // Lazy load images
    //-----------------------------------------------------
    
    function lazyLoadImages() {
        angular.element('img[data-lazy-src]').each(function (i, elem) {
            var currScroll = angular.element(".js-articles-list").scrollTop();
            var range = $window.outerHeight * 4;
            if (elem.offsetTop > currScroll - range &&
                elem.offsetTop < currScroll + range) {
                var jqElem = angular.element(elem);
                var src = jqElem.attr('data-lazy-src');
                jqElem.attr('src', src);
                jqElem.removeAttr('data-lazy-src');
            }
        });
    }
    
    angular.element(".js-articles-list").scroll(lazyLoadImages);
    
    //-----------------------------------------------------
    // Scrolling to next unread article
    //-----------------------------------------------------
    
    function findNextUnreadArticleId(referenceArticleGuid) {
        var mode = 'searchingReference';
        var dayIndex = 0;
        var articleIndex = 0;
        var days = $scope.days;
        
        function findNext() {
            for (dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
                var day = days[dayIndex];
                for (articleIndex = 0; articleIndex < day.articles.length; articleIndex += 1) {
                    var art = day.articles[articleIndex];
                    
                    switch (mode) {
                    case 'searchingReference':
                        // find reference article in list
                        if (art.guid === referenceArticleGuid) {
                            mode = 'searchingNextUnread';
                        }
                        break;
                    case 'searchingNextUnread':
                    case 'searchingFromBeginning':
                        // find next unread article just after reference article
                        if (art.isRead === false) {
                            if (articleIndex === 0) {
                                // if an article is first in its day return day id instead of article id
                                return day.id;
                            } else {
                                return art.id;
                            }
                        }
                        break;
                    }
                    
                    // if we have turned full circle, and nothing was found
                    if (mode === 'searchingFromBeginning' &&
                        art.guid === referenceArticleGuid) {
                        return null;
                    }
                    
                    // if last item in list reached without hit,
                    // search again from beginning
                    if (mode === 'searchingNextUnread' &&
                        dayIndex === days.length - 1 &&
                        articleIndex === day.articles.length - 1) {
                        dayIndex = -1;
                        mode = 'searchingFromBeginning';
                    }
                }
            }
            return null;
        }
        
        return findNext();
    }
    
    $scope.$on('articleReadDone', function (evt, articleGuid) {
        var nextId = findNextUnreadArticleId(articleGuid);
        if (nextId) {
            var scroll = angular.element('#' + nextId)[0].offsetTop - 20;
            angular.element(".js-articles-list").animate({
                scrollTop: scroll
            }, 1000);
        }
    });
}