'use strict';

function monthLabel(month) {
    var labels = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ];
    return labels[month];
}

exports.organizeByDays = function (articles) {
    var days = [];
    articles.sort(function (art1, art2) {
        return art2.pubDate - art1.pubDate;
    });
    var currDate = -1;
    
    var now = new Date();
    var yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    function getDayName(date) {
        if (now.getDate() === date.getDate() &&
            now.getMonth() === date.getMonth() &&
            now.getFullYear() === date.getFullYear()) {
            return 'Today';
        }
        if (yesterday.getDate() === date.getDate() &&
            yesterday.getMonth() === date.getMonth() &&
            yesterday.getFullYear() === date.getFullYear()) {
            return 'Yesterday';
        }
        return date.getDate() + ' ' + monthLabel(date.getMonth());
    }
    
    for (var i = 0; i < articles.length; i += 1) {
        var art = articles[i];
        var pubDate = new Date(art.pubDate);
        if (currDate !== pubDate.getDate()) {
            var day = {
                id: 'day-' + pubDate.getTime(),
                name: getDayName(pubDate),
                articles: [],
            };
            days.push(day);
            currDate = pubDate.getDate();
        }
        day.articles.push(art);
    }
    return days;
}