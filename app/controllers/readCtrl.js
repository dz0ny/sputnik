'use strict';

function ReadCtrl($scope, $window, feedsService, articlesService, downloadService) {
    
    var Q = require('q');
    var organizer = require('./helpers/articlesOrganizer');
    
    var pageIndex = 0;
    var articlesPerPage = 50;
    var presentedArticles = [];
    
    function downloadFeeds() {
        
        if (feedsService.feeds.length === 0 || downloadService.isWorking) {
            return;
        }
        
        downloadService.download()
        .then(function () {
            showArticles();
        },
        function (failMessage) {
            if (failMessage === 'No connection') {
                console.log('No connection!!!');
            }
        },
        function (progress) {
            var ratio = Math.round(progress.completed / progress.total * 100);
            angular.element('.refreshing__progress-bar').css('width', ratio + '%');
        });
        
        $scope.state = 'refreshing';
        angular.element('.refreshing__progress-bar').css('width', '0%');
    }
    
    function showArticles() {
        var from = pageIndex * articlesPerPage;
        var to = from + articlesPerPage;
        
        console.log("pagination from: " + from + " to: " + to);
        
        var feedUrls;
        if ($scope.selectedItem.type === 'feed') {
            feedUrls = [$scope.selectedItem.url];
        } else {
            feedUrls = $scope.selectedItem.feeds.map(function (feed) {
                return feed.url;
            });
        }
        
        var options = {};
        if ($scope.selectedTag) {
            options.tagId = $scope.selectedTag._id;
        }
        
        articlesService.getArticles(feedUrls, from, to, options)
        .then(function (result) {
            $scope.isPrevPage = (from > 0);
            $scope.isNextPage = (to <= result.numAll);
            
            console.log("result.numAll: " + result.numAll);
            
            renderArticles(result.articles);
            $scope.$apply();
        });
    }
    
    function renderArticles(articles) {
        organizer.sortChronologically(articles);
        presentedArticles = articles;
        $scope.days = organizer.organizeByDays(articles);
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
    
    $scope.feedsTree = feedsService.tree;
    $scope.all = feedsService;
    $scope.days = [];
    
    $scope.refresh = downloadFeeds;
    
    $scope.selectedItem = $scope.all;
    $scope.selectItem = function (item) {
        $scope.selectedItem = item;
        pageIndex = 0;
        if ($scope.state !== 'noFeeds' && $scope.state !== 'refreshing') {
            showArticles();
        }
    };
    
    $scope.onTagSelected = function () {
        pageIndex = 0;
        showArticles();
    };
    
    $scope.prevPage = function () {
        if ($scope.isPrevPage) {
            pageIndex -= 1;
            showArticles();
        }
    };
    
    $scope.nextPage = function () {
        if ($scope.isNextPage) {
            pageIndex += 1;
            showArticles();
        }
    };
    
    $scope.markCategoryAsRead = function () {
        var promises = [];
        $scope.days.forEach(function (day) {
            day.articles.forEach(function (art) {
                if (!art.isRead) {
                    promises.push(art.setIsRead(true));
                }
            }); 
        });
        Q.all(promises)
        .then(function () {
            // above code changes to read only articles on this side
            // this code marks as read everything on other pages of this list
            return feedsService.markAllArticlesAsRead($scope.selectedItem.feeds);
        })
        .then(function () {
            $scope.$apply();
        });
    };
    
    $scope.$on('articleReadStateChange', function () {
        if ($scope.selectedItem.unreadArticlesCount === 0) {
            showEverythingReadInfo();
        }
        $scope.$apply();
    });
    
    var showEverythingReadInfoAnimationInterval;
    function showEverythingReadInfo() {
        var ele = angular.element(".popup");
        ele.addClass('popup--visible');
        clearInterval(showEverythingReadInfoAnimationInterval);
        showEverythingReadInfoAnimationInterval = setInterval(function () {
            ele.removeClass('popup--visible');
        }, 4000);
    }
    
    //-----------------------------------------------------
    // Init
    //-----------------------------------------------------
    
    var articlesList = angular.element(".js-articles-list");
    
    if (feedsService.feeds.length === 0) {
        $scope.state = 'noFeeds';
    } else if ($scope.$parent.lastSignificantEvent === 'appJustStarted' ||
               $scope.$parent.lastSignificantEvent === 'feedAdded' ||
               $scope.$parent.lastSignificantEvent === 'feedsImported') {
        downloadFeeds();
        $scope.$parent.lastSignificantEvent = null;
    } else {
        showArticles();
    }
    
    //-----------------------------------------------------
    // Lazy load images
    //-----------------------------------------------------
    
    var autoScrolling = false;
    
    function lazyLoadImages() {
        if (autoScrolling) {
            // we don't want to load images while autoScrolling,
            // because height of loaded image can raise from 0 to X pixels
            // and it messes with point in page we are scrolling to
            return;
        }
        angular.element('img[data-lazy-src]').each(function (i, elem) {
            var currScroll = angular.element(".js-articles-list").scrollTop();
            var range = $window.outerHeight * 5;
            if (elem.offsetTop >= currScroll &&
                elem.offsetTop < currScroll + range) {
                var jqElem = angular.element(elem);
                var src = jqElem.attr('data-lazy-src');
                jqElem.attr('src', src);
                jqElem.removeAttr('data-lazy-src');
            }
        });
    }
    
    articlesList.scroll(lazyLoadImages);
    
    //-----------------------------------------------------
    // Key bindings
    //-----------------------------------------------------
    
    function keyDownBindings(event) {
        if ($scope.state !== 'articles') {
            return;
        }
        switch (event.keyCode) {
            // up
            case 38:
                scrollTo('-1');
                event.preventDefault();
                break;
            // down
            case 40:
                scrollTo('+1');
                event.preventDefault();
                break;
        }
    }
    
    function keyUpBindings(event) {
        if ($scope.state !== 'articles') {
            return;
        }
        switch (event.keyCode) {
            // left
            case 37:
                scrollTo('prev');
                event.preventDefault();
                break;
            // right
            case 39:
                scrollTo('next');
                event.preventDefault();
                break;
            // space
            case 32:
                markFirstAsReadAndScrollToNext();
                event.preventDefault();
                break;
            // enter
            case 13:
                // TODO mark all as read
                event.preventDefault();
                break;
        }
    }
    
    document.addEventListener('keydown', keyDownBindings, false);
    document.addEventListener('keyup', keyUpBindings, false);
    
    $scope.$on('$destroy', function () {
        document.removeEventListener('keydown', keyDownBindings, false);
        document.removeEventListener('keyup', keyUpBindings, false);
    });
    
    //-----------------------------------------------------
    // Scrolling to articles
    //-----------------------------------------------------
    
    /**
     * Checks if any part of given article is visible on screen.
     */
    function articleVisibleInViewport(article) {
        var el = angular.element('#' + article.id);
        var bounds = el[0].getBoundingClientRect();
        var notVisible = bounds.bottom < 0 || bounds.top > articlesList.height();
        return !notVisible;
    }
    
    /**
     * Returns first article from top which is partially visible on screen.
     */
    function getFirstVisibleArticle() {
        for (var i = 0; i < presentedArticles.length; i += 1) {
            if (articleVisibleInViewport(presentedArticles[i])) {
                break;
            }
        }
        return presentedArticles[i];
    }
    
    /**
     * Returns next or previous neighbour to given article;
     */
    function getArticleNeighbour(what, referenceArticle) {
        for (var i = 0; i < presentedArticles.length; i += 1) {
            if (presentedArticles[i] === referenceArticle) {
                if (what === 'prev') {
                    if (i === 0) {
                        return null; // first article doesn't have previous
                    }
                    return presentedArticles[i - 1];
                } else if (what === 'next') {
                    if (i === presentedArticles.length - 1) {
                        return null; // last article doesn't have next
                    }
                    return presentedArticles[i + 1];
                }
            }
        }
        
        return null;
    }
    
    function getNextUnreadArticle(referenceArticle) {
        var i;
        var referenceIndex;
        var mode = 'searchingReference';
        
        for (i = 0; i < presentedArticles.length; i += 1) {
            if (mode === 'searchingUnread') {
                if (i === referenceIndex) {
                    // done full circle and no unread article found
                    break;
                } else if (!presentedArticles[i].isRead) {
                    return presentedArticles[i];
                }
                if (i === presentedArticles.length - 1) {
                    // search once again from beginning
                    i = 0;
                }
            }
            if (mode === 'searchingReference') {
                if (presentedArticles[i] === referenceArticle) {
                    referenceIndex = i;
                    mode = 'searchingUnread';
                }
            }
        }
        
        return null;
    }
    
    function scrollTo(what) {
        var position;
        var article;
        var duration = 600;
        
        switch (what) {
            case '+1':
            case '-1':
                duration = 300;
                var distance = 400;
                if (what === '-1') { distance = -distance; }
                position = articlesList.scrollTop() + distance;
                break;
            case 'nextUnread':
                article = getNextUnreadArticle(getFirstVisibleArticle());
                if (article) {
                    position = angular.element('#' + article.id)[0].offsetTop - 20;
                } else {
                    // TODO search for unread article on other pages
                }
                break;
            case 'prev':
            case 'next':
                article = getArticleNeighbour(what, getFirstVisibleArticle());
                if (article) {
                    position = angular.element('#' + article.id)[0].offsetTop - 20;
                } else {
                    position = (what === 'prev') ? 0 : articlesList[0].scrollHeight;
                }
                break;
        }
        
        // TODO smooth animation when many actions in short time
        
        autoScrolling = true;
        angular.element(".js-articles-list").animate({
            scrollTop: position
        }, duration, afterAutoScroll);
    }
    
    function afterAutoScroll() {
        autoScrolling = false;
        // while autoScrolling we have suspended images lazy loading
        // so now event have to be fired to let them load
        articlesList.scroll();
    }
    
    function markFirstAsReadAndScrollToNext() {
        var article = getFirstVisibleArticle();
        article.setIsRead(true)
        .then(function () {
            $scope.$apply();
            scrollTo('nextUnread');
        });
    }
    
    articlesList.bind('contextmenu', markFirstAsReadAndScrollToNext);
    
}