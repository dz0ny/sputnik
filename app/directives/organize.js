'use strict';

sputnik.directive('organizeFeed', function () {
    return {
        restrict: 'E',
        replace: true,
        templateUrl: './views/directives/organizeFeed.html',
        scope: {
            feed: '=',
            categoriesNames: '=',
        },
        link: function ($scope, element, attrs) {
            $scope.showChangeCategory = false;
            $scope.chosenCategoryName = $scope.feed.category;
            $scope.onCategorySelected = function () {
                $scope.$emit('changeFeedCategory', $scope.feed.url, $scope.chosenCategoryName);
            };
            
            $scope.showDelete = false;
            $scope.onDelete = function () {
                $scope.$emit('deleteFeed', $scope.feed.url);
            };
        }
    };
});

sputnik.directive('organizeCategory', function () {
    return {
        restrict: 'E',
        replace: true,
        templateUrl: './views/directives/organizeCategory.html',
        scope: {
            category: '=',
            categoriesNames: '=',
        },
        link: function ($scope, element, attrs) {
            $scope.showRename = false;
            $scope.newName = $scope.category.name;
            
            $scope.onChangeName = function () {
                $scope.$emit('changeCategoryName', $scope.category.name, $scope.newName);
                $scope.showRename = false;
            };
            
            $scope.showDelete = false;
            $scope.onDelete = function () {
                $scope.$emit('deleteCategory', $scope.category.name);
            };
        }
    };
});