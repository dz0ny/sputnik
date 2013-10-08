'use strict';

sputnik.directive('pickTagMenu', function ($rootScope) {
    return {
        restrict: 'E',
        replace: true,
        templateUrl: './views/directives/pickTagMenu.html',
        scope: true,
        link: function ($scope, element) {
            
            var article = null;
            
            $scope.show = false;
            
            $rootScope.$on('showPickTag', function (evt, art) {
                article = art;
                $scope.show = true;
                $scope.$apply();
            });
            
            $scope.toggleTag = function (tagId) {
                article.toggleTag(tagId)
                .then(function () {
                    $scope.show = false;
                    $scope.$apply();
                });
            };
            
            $scope.addNewTag = function () {
                if (!$scope.newTagName || $scope.newTagName === '') {
                    return;
                }
                article.addNewTag($scope.newTagName)
                .then(function () {
                    $scope.newTagName = '';
                    $scope.show = false;
                    $scope.$apply();
                });
            };
            
            $scope.articleHasTag = function (tag) {
                for (var i = 0; i < article.tags.length; i += 1) {
                    if (article.tags[i]._id === tag._id) {
                        return true;
                    }
                }
                return false;
            };
            
        }
    };
});