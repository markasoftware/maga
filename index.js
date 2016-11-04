var webpage = require('webpage');
var fs = require('fs');
var config = JSON.parse(fs.read('./config.json'));

var page = webpage.create();
page.viewportSize = {
    width: 1920,
    height: 1080
};

var toVote = config.votes;
var chosenLocationIndex = Math.floor(Math.random() * config.locations.length);
var chosenCounty = config.locations[chosenLocationIndex].county;
var possibleCities = config.locations[chosenLocationIndex].city;
var chosenCity = possibleCities[Math.floor(Math.random() * possibleCities.length)];
console.log('Using county ' + chosenCounty + ' and city ' + chosenCity);

function waitUntilExists(selector, cb) {
    function waiting() {
        var doesntExist = page.evaluate(function(sl) {
            return !document.querySelector(sl);
        }, selector);
        if(doesntExist) {
            setTimeout(waiting, 50);
        } else {
            cb();
        }
    }
    waiting();
}

page.open('https://www.sos.wa.gov/elections/mock-election/#/vote/county', function(status) {
    if(status !== 'success') {
        console.log('ERROR: status not successful');
        phantom.exit();
    }
    waitUntilExists('#county > option:nth-child(2)', function() {
        // find and select the correct county
        page.evaluate(function(findMe) {
            var selector = document.querySelector('#county');
            for(var i = 0; i < selector.options.length; ++i) {
                if(selector.options[i].textContent.toLowerCase() === findMe) {
                    selector.selectedIndex = i;
                    break;
                }
            }
            var event = document.createEvent('UIEvent');
            event.initEvent('change', true, true);
            selector.dispatchEvent(event);
        }, chosenCounty);
        console.log('found county successfully');
        page.evaluate(function() {
            document.querySelector("a[href='#/vote/register']").click();
        });
        waitUntilExists('#school', function() {

            // select grade and city
            page.evaluate(function(cityToUse) {
                // generate and select grade
                var gradeToUse = Math.floor(Math.random() * 4 + 9);
                var gradeS = document.querySelector('#grade');
                var cityS = document.querySelector('#city');
                // select grade
                for(var i = 0; i < gradeS.options.length; ++i) {
                    if(gradeS.options[i].textContent.indexOf(gradeToUse) !== -1) {
                        gradeS.selectedIndex = i;
                        break;
                    }
                }
                for(var k = 0; k < cityS.options.length; ++k) {
                    if(cityS.options[k].textContent.toLowerCase() === cityToUse) {
                        cityS.selectedIndex = k;
                        break;
                    }
                }
                var event = document.createEvent('UIEvent');
                event.initEvent('change', true, true);
                gradeS.dispatchEvent(event);
                cityS.dispatchEvent(event);
            }, chosenCity);
            waitUntilExists('#school option:nth-child(2)', function() {
                console.log('school list loaded');
                page.evaluate(function() {
                    var schoolS = document.querySelector('#school');
                    var okSchools = [];
                    var curText;
                    for(var i = 0; i < schoolS.options.length; ++i) {
                        curText = schoolS.options[i].textContent.toLowerCase();
                        if(curText.indexOf('high') !== -1 && curText.indexOf('junior') === -1) {
                            okSchools.push(i);
                        }
                    }
                    schoolS.selectedIndex = okSchools[Math.floor(Math.random() * okSchools.length)];
                    var event = document.createEvent('UIEvent');
                    event.initEvent('change', true, true);
                    schoolS.dispatchEvent(event);
                    document.querySelector('button[type=submit]').click();
                });
                waitUntilExists('a[ng-click="getBallot()"]', function() {
                    page.evaluate(function() {
                        document.querySelector('a[ng-click="getBallot()"]').click();
                    });
                    waitUntilExists('div[ng-repeat="b in ballot"]', part2);
                });
            });
        });
    });
});

// i just want to split it up for cleaner looking code
function part2() {
    console.log('ballot page loaded');
    page.evaluate(function(votes) {
        var voteTitles = Object.keys(votes);
        var ballotThingies = document.querySelectorAll('div[ng-repeat="b in ballot"]');
        for(var i = 0; i < ballotThingies.length; ++i) {
            var cb = ballotThingies[i];
            var ballotTitle = cb.querySelector('.panel-heading > .reset-margin').textContent.toLowerCase();
            var cVoteTitle = voteTitles.filter(function(c) {
                return ballotTitle.indexOf(c) !== -1;
            })[0];
            var cToVote = votes[cVoteTitle];
            var radioLabels = cb.querySelectorAll('label');
            [].forEach.call(radioLabels, function(c) {
                if(c.textContent.toLowerCase().indexOf(cToVote) !== -1) {
                    c.click();
                }
            });
        }
        document.querySelector('button[type=submit]').click();
    }, toVote);
    var failTimeout = setTimeout(function() {
        console.log('ERROR: success page did not load in time');
        page.render('fail.jpg');
        phantom.exit();
    }, 15000);
    waitUntilExists('.ng-hide > h3.text-center', function() {
        console.log('done!');
        page.render('boop.jpg');
        phantom.exit();
    });
}
