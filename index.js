var webpage = require('webpage');
var fs = require('fs');
var system = require('system');
var config = JSON.parse(fs.read('./config.json'));
var isDebug = system.args[1];
if(isDebug) {
    console.log('running in debug mode');
}

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

var failTimeout = setTimeout(function() {
    console.log('TIMEOUT');
    phantom.exit();
}, 10000);

page.open('https://www.sos.wa.gov/elections/mock-election/#/vote/county', function(status) {
    if(status !== 'success') {
        console.log('ERROR: status not successful');
        phantom.exit();
    }
    console.log('page loaded');
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
        page.evaluate(function() {
            document.querySelector("a[href='#/vote/register']").click();
        });
        waitUntilExists('#school', function() {

            // select grade and city
            var wasOk = page.evaluate(function(cityToUse) {
                var gradeS = document.querySelector('#grade');
                var cityS = document.querySelector('#city');
                // select grade
                gradeS.selectedIndex = Math.floor(Math.random() * gradeS.options.length);
                var clicked = false;
                for(var k = 0; k < cityS.options.length; ++k) {
                    if(cityS.options[k].textContent.toLowerCase() .indexOf(cityToUse) !== -1) {
                        cityS.selectedIndex = k;
                        clicked = true;
                        break;
                    }
                }
                if(!clicked) {
                    return false;
                }
                var event = document.createEvent('UIEvent');
                event.initEvent('change', true, true);
                gradeS.dispatchEvent(event);
                cityS.dispatchEvent(event);
                return true;
            }, chosenCity);
            if(!wasOk) {
                console.log('ERROR: City not found?', chosenCity);
                phantom.exit();
            }
            console.log('school not loaded yet...');
            waitUntilExists('#school option:nth-child(2)', function() {
                console.log('stuff but school clicked');
                page.evaluate(function() {
                    var schoolS = document.querySelector('#school');
                    schoolS.selectedIndex = Math.floor(Math.random() * schoolS.options.length);
                    var event = document.createEvent('UIEvent');
                    event.initEvent('change', true, true);
                    schoolS.dispatchEvent(event);
                    document.querySelector('button[type=submit]').click();
                });
                console.log('stuff really clicked');
                waitUntilExists('a[ng-click="getBallot()"]', function() {
                    page.evaluate(function() {
                        document.querySelector('a[ng-click="getBallot()"]').click();
                    });
                    console.log('before part 2');
                    waitUntilExists('div[ng-repeat="b in ballot"]', function() {
                        setTimeout(part2, 3000);
                    });
                });
            });
        });
    });
});

// i just want to split it up for cleaner looking code
function part2() {
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
    if(isDebug) {
        page.render('ballot-page.jpg');
    }
    console.log('before final thingy');
    setTimeout(function(){
        clearTimeout(failTimeout);
        if(isDebug) {
            page.render('boop.jpg');
        }
        console.log('DONE with county ' + chosenCounty + ' and city ' + chosenCity);
        phantom.exit();
    }, 1500);
}
