'use strict';

sputnik.directive('article', function ($sanitize) {
    
    var cheerio = require('cheerio');
    var urlUtil = require('url');
    
    function processHtml(content, articleUrl) {
        var dom = cheerio.load(content);
        
        var maxWidth = 620;
        
        function flashPatch(i, elem) {
            // get the same size of patch as original tag has
            var width = parseInt(dom(elem).attr('width'), 10);
            var height = parseInt(dom(elem).attr('height'), 10);
            if (width > maxWidth) {
                var ratio = width / height;
                width = maxWidth;
                height = Math.round(maxWidth / ratio);
            }
            
            var patchStr = '<a class="flash-patch" href="' + articleUrl + '">There is Flash plugin in this article (probably video),<br/>click here to see it in the browser.</a>';
            
            dom(elem).replaceWith(patchStr);
        }
        
        /*dom('iframe').each(function (i, elem) {
        
        // force http protocol if lack of any
        var src = dom(elem).attr('src');
        var url = urlUtil.parse(src);
        if (!url.protocol) {
        elem.attribs.src = urlUtil.resolve('http:', src);
        }
        
        // if iframe too big for sputnik downsize it while maintaining aspect ratio
        var width = parseInt(dom(elem).attr('width'));
        var height = parseInt(dom(elem).attr('height'));
        if (width > maxWidth) {
        var ratio = width / height;
        dom(elem).attr('width', maxWidth);
        dom(elem).attr('height', Math.round(maxWidth / ratio));
        }
        });*/
        
        dom('object').each(flashPatch);
        dom('iframe').each(flashPatch);
        
        return dom.html();
    }
    
    function lazyLoadImages(content) {
        var dom = cheerio.load(content);
        
        dom('img').each(function (i, elem) {
            var src = dom(elem).attr('src');
            if (src) {
                dom(elem).attr('data-lazy-src', src);
                dom(elem).removeAttr('src');
            }
        });
        
        return dom.html();
    }
    
    return {
        restrict: 'E',
        replace: true,
        templateUrl: './views/directives/article.html',
        scope: true,
        link: function ($scope, element, attrs) {
            
            var articleContent = $scope.artData.content;
            articleContent = processHtml(articleContent, $scope.artData.link);
            articleContent = $sanitize(articleContent);
            articleContent = lazyLoadImages(articleContent);
            $scope.articleContent = articleContent;
            
            $scope.showPickTagMenu = false;
            
            // when rollover title hilight 'see in browser' button
            element.find('.js-title').hover(function (evt) {
                element.find('.js-see-in-browser').addClass('hovered');
            }, function (evt) {
                element.find('.js-see-in-browser').removeClass('hovered');
            });
            
            $scope.toggleIsRead = function () {
                $scope.artData.setIsRead(!$scope.artData.isRead);
            };
            
            $scope.toggleTag = function (tagId) {
                $scope.artData.toggleTag(tagId)
                .then(function () {
                    $scope.showPickTagMenu = false;
                    $scope.$apply();
                });
            };
            
            $scope.addNewTag = function () {
                if (!$scope.newTagName || $scope.newTagName === '') {
                    return;
                }
                $scope.artData.addNewTag($scope.newTagName)
                .then(function () {
                    $scope.newTagName = '';
                    $scope.showPickTagMenu = false;
                    $scope.$emit('tagsChanged');
                    $scope.$apply();
                });
            };
            
            $scope.articleHasTag = function (tag) {
                for (var i = 0; i < $scope.artData.tags.length; i += 1) {
                    if ($scope.artData.tags[i]._id === tag._id) {
                        return true;
                    }
                }
                return false;
            };
            
            // right click anywhere on an article makes it read
            // and scrolls to next unread article
            element.bind('contextmenu', function(evt) {
                $scope.$apply(function() {
                    evt.preventDefault();
                    $scope.artData.setIsRead(true);
                    $scope.$emit('articleReadDone', $scope.artData.guid);
                });
            });
            
        }
    };
});