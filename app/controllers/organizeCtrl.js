'use strict';

function OrganizeCtrl($scope, feedsService) {
    
    function refresh() {
        $scope.feedsTree = feedsService.central.tree;
        $scope.categoriesNames = feedsService.central.categoriesNames;
    }
    
    refresh();
    
    $scope.newCategoryName = '';
    $scope.addNewCategory = function () {
        feedsService.central.addCategory($scope.newCategoryName);
        $scope.newCategoryName = '';
        refresh();
    };
    
    $scope.$on('changeFeedCategory', function (e, feedUrl, newCategoryName) {
        //console.log('changeCategory: '+feedUrl+'  '+newCategoryName);
        feedsService.central.changeFeedCategory(feedUrl, newCategoryName);
        refresh();
    });
    $scope.$on('deleteFeed', function (e, feedUrl) {
        //console.log('deleteFeed: '+feedUrl);
        feedsService.central.removeFeed(feedUrl);
        refresh();
    });
    
    $scope.$on('changeCategoryName', function (e, oldName, newName) {
        //console.log('changeCategoryName: '+oldName+'  '+newName);
        feedsService.central.changeCategoryName(oldName, newName);
        refresh();
    });
    $scope.$on('deleteCategory', function (e, name) {
        //console.log('deleteCategory: '+name);
        feedsService.central.removeCategory(name);
        refresh();
    });
}