'use strict';

var sputnik = angular.module('sputnik', ['ngRoute', 'ngSanitize']);

sputnik.config(function ($routeProvider) {
    $routeProvider.when('/', {
        controller: 'ReadCtrl',
        templateUrl: 'views/read.html'
    }).when('/importExport', {
        controller: 'ImportExportCtrl',
        templateUrl: 'views/importExport.html'
    }).when('/add', {
        controller: 'AddFeedCtrl',
        templateUrl: 'views/addFeed.html'
    }).when('/organize', {
        controller: 'OrganizeCtrl',
        templateUrl: 'views/organize.html'
    }).when('/tags', {
        controller: 'TagsCtrl',
        templateUrl: 'views/tags.html'
    }).when('/about/:subview', {
        controller: 'AboutCtrl',
        templateUrl: 'views/about/main.html'
    });
});