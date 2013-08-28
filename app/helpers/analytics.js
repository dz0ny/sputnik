'use strict';

var request = require('request');
var querystring = require('querystring');
var url;

function hit(payload) {
    request.post({
        headers: {'content-type' : 'application/x-www-form-urlencoded'},
        url:     url,
        body:    querystring.stringify(payload)
    });
}

exports.init = function (analyticsUrl) {
    url = analyticsUrl;
};

exports.dailyHit = function (analyticsObj) {
    analyticsObj.type = 'dailyHit';
    hit(analyticsObj);
};

exports.monthlyReaport = function (analyticsObj) {
    analyticsObj.type = 'monthlyReaport';
    hit(analyticsObj);
};