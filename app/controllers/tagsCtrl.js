'use strict';

function TagsCtrl($scope, feedsService) {
    
    $scope.changeTagName = function (tagId, newName) {
        feedsService.changeTagName(tagId, newName)
        .then(function () {
            $scope.$emit('tagsChanged');
            $scope.$apply();
        });
    };
    
    $scope.removeTag = function (tagId) {
        feedsService.removeTag(tagId)
        .then(function () {
            $scope.$emit('tagsChanged');
            $scope.$apply();
        });
    };
    
}