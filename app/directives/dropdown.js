'use strict';

sputnik.directive('dropdown', function () {
    return {
        restrict: 'C',
        link: function ($scope, element) {
            var btn = angular.element(element.children()[0]);
            btn.bind('click', function () {
                element.toggleClass('dropdown--opened');
            });
        }
    };
});