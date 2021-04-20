const dotenv = require("dotenv").config();
const express = require("express");
const axios = require('axios');
const path = require("path");
const PORT = process.env.PORT || 5000;
const { Pool } = require("pg");
const cors = require("cors");
const bodyParser = require("body-parser");
const { start } = require("repl");
const passport = require("passport");

const homepageHelper = require('./homepageHelper')
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({
  user: process.env.USER,
  host: process.env.HOST,
  database: process.env.DATABASE,
  password: process.env.PASSWORD,
  port: 5432,
  ssl: true,
});


const app = express();
app.use(cors());
app.use(bodyParser()); //parses json data for us

app
  .use(express.static(path.join(__dirname, "public")))
  .use(express.urlencoded({ extended: true }))
  .set("views", path.join(__dirname, "views"))
  .set("view engine", "ejs")

  .get('/home', async (req, res) => {

    let userClasses = [];  // All user classes
    let userStops = [];  // All user pitstops

    let upcomingClasses = [];
    let upcomingStops = [];

    let timeUntilNextClass = 'No more classes today.';  // How long until next class
    let route = null;  // Route from Google Maps API

    let startingPoint = null;
    let endingPoint = null;

    if (req.query.userID) {  // If user ID specified

      // Get a list of all user classes
      try {
        let result = await pool.query(
          "SELECT classes.name className, buildings.name buildingName, room, time, monday, tuesday, wednesday, thursday, friday, lat, lng FROM (classes INNER JOIN userclasses on classes.id = userclasses.class) INNER JOIN buildings on classes.building = buildings.id WHERE userid = " + req.query.userID);
        userClasses = result ? result.rows : [];
      } catch (err) { }  // For now no need to handle error

      // Get a list of all user pitstops
      try {
        let result = await pool.query(
          "SELECT day, time, location, lat, lng FROM (userpitstops INNER JOIN pitstops ON pitstops.id = userpitstops.stopid) INNER JOIN buildings ON buildings.id = pitstops.building WHERE userid = " + req.query.userID
        );
        userStops = result ? result.rows : [];
      } catch (err) { } // Again, no need to handle any errors


      upcomingClasses = homepageHelper.parseUpcomingClasses(userClasses);

      upcomingStops = homepageHelper.parseUpcomingStops(userStops);

      // If there are more classes today, update the time until the next one
      if (upcomingClasses.length > 0) {
        let currentTime = new Date()
        currentTime.setHours(currentTime.getHours() - 4);  // Account for UTC offset.
        let nextClassTime = new Date()
        let [classHours, classMinutes] = upcomingClasses[0].time.split(":"); // Split timestamp on ":"
        nextClassTime.setDate(currentTime.getDate());
        nextClassTime.setHours(classHours);
        nextClassTime.setMinutes(classMinutes);
        nextClassTime.setSeconds(0);
        let timeDiff = new Date(nextClassTime - currentTime);
        timeUntilNextClass = timeDiff.getHours() + ' Hours, ' + timeDiff.getMinutes() + ' Minutes';
      }

      if (upcomingClasses.length > 0 && upcomingStops.length > 0) {
        endingPoint = upcomingClasses[0].time > upcomingStops[0].time ? upcomingStops[0] : upcomingClasses[0];
      } else if (upcomingClasses.length > 0) {
        endingPoint = upcomingClasses[0];
      } else if (upcomingStops.length > 0) {
        endingPoint = upcomingStops[0];
      }

      // Get the current class user is in based on the whole class list and user stop list.
      startingPoint = homepageHelper.getStartingPointForMap(userClasses, userStops);

    }

    let output = {
      'classes': upcomingClasses,
      'timeUntilNextClass': timeUntilNextClass,
      'stops': upcomingStops,
      'route': route,
      'startingPoint': startingPoint,
      'endingPoint': endingPoint
    };

    if (startingPoint && endingPoint) {
      axios.get(`https://maps.googleapis.com/maps/api/directions/json?origin=${startingPoint.lat},${startingPoint.lng}&destination=${endingPoint.lat},${endingPoint.lng}&mode=walking&key=${process.env.DIRECTIONS_KEY}`
      ).then((res) => {
        output['route'] = res.data;
        res.send(JSON.stringify(output));
      }).catch((err) => {
        res.send(JSON.stringify(output));
      });
    } else {
      res.send(JSON.stringify(output));
    }
  })
  // For getting all login information
  .get("/users", async (req, res) => 
  {
    try 
    {
      pool.query("SELECT * FROM users", (err, result) => 
      {
        if (err) 
        {
          res.sendStatus(404);
        } 
        else 
        {
          const results = { results: result ? result.rows : null };
          res.send(JSON.stringify(results));
        }
      });
    } 
    catch (err) 
    {
      console.error(err);
      res.send("Error " + err);
    }
  })
  // For posting all user login information
  .post("/savelogin", (req, res) => {

    let username = `'${req.body.username}'`;
    let password = `'${req.body.password}'`;

    let totalSQL = "SELECT * FROM users WHERE first_name = " + username + " AND password = " + password;

    pool.query(totalSQL, (error, result) => 
    {
      if (error) 
      {
          console.log(error);
          res.sendStatus(404);
      }
      else 
      { 
          res.sendStatus(200);
      }
    });
  })
  // For posting all user signup information
  .post("/savesignup", (req, res) => {

    let additionalSQL = "";
    
    additionalSQL += `(${req.body.id}, '${req.body.firstName}', '${req.body.lastName}', '${req.body.major}', '${req.body.emailAddress}', '${req.body.password}');,`;

    additionalSQL = additionalSQL.substring(0, additionalSQL.length - 1);

    let totalSQL = "INSERT INTO users (id, first_name, last_name, major, email_address, password) VALUES " + additionalSQL + `"`;

    pool.query(totalSQL, (error, result) => 
    {
      if (error) 
      {
          console.log(error);
          res.sendStatus(404);
      }
      else 
      {
          res.sendStatus(200);
      }
    });
  })
  //For Getting all buildings
  .get("/buildings", async (req, res) => {
    if (req.query.id) {
      try {
        pool.query(
          "SELECT * FROM buildings where id = " + req.query.id,
          (err, result) => {
            if (err) {
              res.sendStatus(404);
            } else {
              const results = { results: result ? result.rows : null };
              res.send(JSON.stringify(results));
            }
          }
        );
      } catch (err) {
        console.error(err);
        res.send("Error " + err);
      }
    } else if (req.query.name) {
      try {
        pool.query(
          "SELECT * FROM buildings where name = " + req.query.name,
          (err, result) => {
            if (err) {
              res.sendStatus(404);
            } else {
              const results = { results: result ? result.rows : null };
              res.send(JSON.stringify(results));
            }
          }
        );
      } catch (err) {
        console.error(err);
        res.send("Error " + err);
      }
    } else {
      try {
        pool.query("SELECT * FROM buildings", (err, result) => {
          if (err) {
            res.sendStatus(404);
          } else {
            const results = { results: result ? result.rows : null };
            res.send(JSON.stringify(results));
          }
        });
      } catch (err) {
        console.error(err);
        res.send("Error " + err);
      }
    }
  })
  // For getting all classes information
  .get("/classes", async (req, res) => {
    try {
      pool.query(
        "SELECT * FROM classes where id = " + req.query.id,
        (err, result) => {
          if (err) {
            res.sendStatus(404);
          } else {
            const results = { results: result ? result.rows : null };
            res.send(JSON.stringify(results));
          }
        }
      );
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  //For Getting all selectable classes in adding menu
  .get("/classOptions", async (req, res) => {
    try {
      pool.query("SELECT * FROM classOptions", (err, result) => {
        if (err) {
          res.sendStatus(404);
        } else {
          const results = { results: result ? result.rows : null };
          res.send(JSON.stringify(results));
        }
      });
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  // For getting all user classes
  .get("/userclasses", async (req, res) => {
    try {
      pool.query(
        "SELECT * FROM userclasses where userID = " + req.query.userID,
        (err, result) => {
          if (err) {
            res.sendStatus(404);
          } else {
            const results = { results: result ? result.rows : null };
            res.send(JSON.stringify(results));
          }
        }
      );
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .post("/saveclasses", (req, res) => {
    try {
      pool.query("SELECT COUNT(*) FROM classes", (err, result) => {
        if (err) {
          console.log(err);
          res.sendStatus(404);
        } else {
          let primaryID = parseInt(result.rows[0].count) + 1;
          let classIDs = [];
        
          let additionalSQL = "";
          for (let i=0; i < req.body.classList.length; i++) {
            let obj = req.body.classList[i];
            let monday = obj.days.includes("Mon");
            let tuesday = obj.days.includes("Tues");
            let wednesday = obj.days.includes("Weds");
            let thursday = obj.days.includes("Thurs");
            let friday = obj.days.includes("Fri");
            additionalSQL += "('" + primaryID + "', '" 
            + obj.name + "', '"
            + obj.building + "', '"
            + obj.room + "', '"
            + obj.time + "', '"
            + monday + "', '"
            + tuesday + "', '"
            + wednesday + "', '"
            + thursday + "', '"
            + friday + "'),";
            classIDs.push(primaryID);
            primaryID++;
          }

          additionalSQL = additionalSQL.substring(0,additionalSQL.length - 1);

          let totalSQL =
            "INSERT INTO classes (id, name, building, room, time, monday, tuesday, wednesday, thursday, friday) VALUES " +
            additionalSQL;

          pool.query(totalSQL, (err, result) => {
            if (err) {
              console.log(err);
              res.sendStatus(404);
            } else {
              pool.query(
              "DELETE FROM userclasses where userID = " + req.body.userID,
                (err, result) => {
                  let additionalSQL2 = "";

                  for (let i=0; i < req.body.classList.length; i++) {
                    additionalSQL2 += "(" + req.body.userID +", " + classIDs[i] + "),";
                  }
                  
                  additionalSQL2 = additionalSQL2.substring(0,additionalSQL2.length - 1);

                  let totalSQL2 =
                    "INSERT INTO userclasses (userID, class) VALUES " +
                    additionalSQL2;

                    pool.query(totalSQL2, (err, result) => {
                      if (err) {
                        console.log(err);
                        res.sendStatus(404);
                      } else {
                        res.sendStatus(200);
                      }
                    });
                }
              );
            }
          });
         
        }
      });
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  //For Getting all pitstops
  .get("/pitstops", async (req, res) => {
    try {
      pool.query("SELECT * FROM pitstops", (err, result) => {
        //console.log(err, result);
        if (err) {
          res.sendStatus(404);
        } else {
          const results = { results: result ? result.rows : null };
          // console.log(results);
          res.send(JSON.stringify(results));
        }
      });
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })

  .get("/userpitstops", async (req, res) => {
    try {
      pool.query(
        "SELECT * FROM userpitstops where userID = " + req.query.userID,
        (err, result) => {
          //console.log(err, result);
          if (err) {
            res.sendStatus(404);
          } else {
            const results = { results: result ? result.rows : null };
            // console.log(results);
            res.send(JSON.stringify(results));
          }
        }
      );
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })

  // /db is a debugging view into the complete order_table database table
  .get("/db", async (req, res) => {
    try {
      const client = await pool.connect();
      const result = await client.query("SELECT * FROM order_table");
      const results = { results: result ? result.rows : null };
      res.render("pages/db", results);
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

app.post("/savepitstops", (req, res) => {
  try {
    pool.query(
      "DELETE FROM userpitstops where userID = " + req.body.userID,
      (err, result) => {
        if (err) {
          res.sendStatus(404);
        } else {
          let additionalSQL = "";

          for (let rowNum in req.body.rows) {
            let row = req.body.rows[rowNum];

            formattedDate = new Date(row.time);
            let dayMap = {
              0: "Sunday",
              1: "Monday",
              2: "Tuesday",
              3: "Wednesday",
              4: "Thursday",
              5: "Friday",
              6: "Saturday"
            };

            formattedDate.setHours(formattedDate.getHours() - 4);
            stopDay = dayMap[formattedDate.getDay()];
            stopTime = formattedDate.getHours()+":"+formattedDate.getMinutes()+":00"  

            // Add row to SQL to insert
            additionalSQL +=
              `(${req.body.userID}, ${row.id}, '${row.time}', '${stopDay}', '${stopTime}'),`;
          }

          // Remove ending comma
          additionalSQL = additionalSQL.substring(0, additionalSQL.length - 1);

          let totalSQL =
            "INSERT INTO userpitstops (userID, stopID, stopTime, day, time) VALUES " +
            additionalSQL;

          if (additionalSQL.length === 0) {  // If no pit stops then don't send data
            res.sendStatus(200);
            return;
          }

          pool.query(totalSQL, (err, result) => {
            if (err) {
              console.log(err);
              res.sendStatus(404);
            } else {
              res.sendStatus(200);
            }
          });
        }
      }
    );
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
});
