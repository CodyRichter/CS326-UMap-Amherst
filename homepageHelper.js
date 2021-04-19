
function getClassesToday(classes) {
    let dayMap = {
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday",
        5: "friday"
    };

    let currentTime = new Date();  // Get current datetime
    currentTime.setHours(currentTime.getHours() - 4);  // Account for UTC offset.
    let currentDay = currentTime.getDay();

    function isClassToday(currentClass) {
        return currentClass[dayMap[currentDay]];
    }

    // Return a list of all classes still upcoming today, in ascencing order
    return classes.filter(isClassToday);
}

function getStopsToday(stops) {
    // NOTE: This day map is flipped compared to the class one.
    let dayMap = {
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5
    };

    let currentTime = new Date();  // Get current datetime
    currentTime.setHours(currentTime.getHours() - 4);  // Account for UTC offset.
    let currentDay = currentTime.getDay();

    function isStopToday(currentStop) {
        return (currentDay === dayMap[currentStop.day]);
    }

    return stops.filter(isStopToday);
}


module.exports = {

    getClassesToday: getClassesToday,
    getStopsToday: getStopsToday,


    // Helper function for main method. Will parse all of a user's classes and return a sorted
    // list of the classes which still are upcoming today.
    parseUpcomingClasses: function (classes) {

        classes = getClassesToday(classes); // Only work on classes today

        let currentTime = new Date();  // Get current datetime
        currentTime.setHours(currentTime.getHours() - 4);  // Account for UTC offset.

        // Reducer function. We will only accept classes that are today, and that have not already started.
        function isClassUpcoming(currentClass) {
            let classTime = new Date()
            let [classHours, classMinutes] = currentClass.time.split(":"); // Split timestamp on ":"
            classTime.setDate(currentTime.getDate());
            classTime.setHours(classHours);
            classTime.setMinutes(classMinutes);
            classTime.setSeconds(0);

            return classTime > currentTime; // Only return classes that havent started yet.
        }

        // Return a list of all classes still upcoming today, in ascencing order
        return classes.filter(isClassUpcoming).sort((class1, class2) => {
            return class1.time > class2.time;
        });
    },


    // Helper function for main method. Will parse all of a user's pitstops and return a sorted
    // list of all of the stops which are upcoming today.
    parseUpcomingStops: function (stops) {

        stops = getStopsToday(stops); // Only work on stops today

        let currentTime = new Date();  // Get current datetime
        currentTime.setHours(currentTime.getHours() - 4);  // Account for UTC offset.

        function isStopUpcoming(currentStop) {
            let stopTime = new Date();
            let [stopHours, stopMinutes] = currentStop.time.split(":"); // Split timestamp on ":"
            stopTime.setDate(currentTime.getDate());
            stopTime.setHours(stopHours);
            stopTime.setMinutes(stopMinutes);
            stopTime.setSeconds(0);

            return stopTime > currentTime; // Only return stops that havent started yet.
        }

        // Return sorted list of stops
        return stops.filter(isStopUpcoming).sort((stop1, stop2) => {
            return stop1.time > stop2.time;
        });
    },

    // Helper function for main method. Will obtain the current/previous event to act as the starting point
    // on the map.
    getStartingPointForMap: function (classes, stops) {

        // Ensure we only look at stops and classes that will happen today.
        classes = getClassesToday(classes);
        stops = getStopsToday(stops);

        // Keep track of all daily events in a single array
        let combinedEvents = [];

        for (let dailyClass of classes) {
            combinedEvents.push({
                name: dailyClass.classname,
                time: dailyClass.time,
                lat: dailyClass.lat,
                lng: dailyClass.lng
            });
        }

        for (let dailyStop of stops) {
            combinedEvents.push({
                name: dailyStop.location,
                time: dailyStop.time,
                lat: dailyStop.lat,
                lng: dailyStop.lng
            });
        }

        // Put events in chronological order
        combinedEvents = combinedEvents.sort((a, b) => {
            return a.time > b.time;
        });

        // Get current time in correct format
        let currentTime = new Date().toLocaleTimeString("en-US", {
            hour12: false,
            timeZone: "America/New_York"
        });

        let previousEvent = {};
        for (let event of combinedEvents) {
            if (event.time > currentTime) {
                break;
            }
            previousEvent = event;
        }

        return [previousEvent, combinedEvents, currentTime];
    }

};
