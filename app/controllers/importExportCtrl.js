'use strict';

function ImportExportCtrl($scope, $location, feedsService) {
    var opml = require('./helpers/opml');
    var fs = require('fs');
    
    $scope.state = 'waitingForUser';
    
    $scope.exportVisible = (feedsService.central.tree.length > 0);
    
    $scope.openImportDialog = function () {
        angular.element('#selectedOpmlPath').trigger('click');
    };
    
    angular.element('#selectedOpmlPath').change(function () {
        var filePath = this.value;
        $scope.$apply(function () {
            var opmlFileContent = fs.readFileSync(filePath);
            var isValid = opml.isOpml(opmlFileContent);
            if (isValid) {
                opml.import(opmlFileContent, feedsService.central.addFeed);
                $scope.$emit('importFeedsSuccess');
                $location.path('/');
            } else {
                $scope.state = 'importFileInvalid';
            }
        });
    });
    
    $scope.openExportDialog = function () {
        angular.element('#saveOpmlToPath').trigger('click');
    };
    
    angular.element('#saveOpmlToPath').change(function () {
        var filePath = this.value;
        var opmlData = opml.export(feedsService.central.tree);
        fs.writeFileSync(filePath, opmlData);
        $scope.state = 'exportDone';
        $scope.$apply();
    });
    
}