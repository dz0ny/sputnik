'use strict';

var sputnik = angular.module('sputnik', ['ngRoute', 'ngSanitize']);

sputnik.config(function ($routeProvider, configService) {
    
    var feedsStorage = require('./models/feedsStorage');
    var dataPath = configService.dataHomeFolder + '/feeds.json';
    sputnik.value('feedsStorage', feedsStorage.make(dataPath));
    
    var articlesStorage = require('./models/articlesStorage');
    var dbPath = configService.dataHomeFolder + '/articles.nedb';
    sputnik.value('articlesStorage', articlesStorage.make(dbPath));
    
    sputnik.value('opml', require('./helpers/opml'));
    
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