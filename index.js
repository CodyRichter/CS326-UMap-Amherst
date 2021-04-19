const dotenv = require("dotenv").config();
const express = require("express");
const path = require("path");
const PORT = process.env.PORT || 5000;
const { Pool } = require("pg");
const cors = require("cors");
const bodyParser = require("body-parser");

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
  .get("/test", (req, res) =>
    res.render("pages/test", { users: ["John", "Paul", "Ringo"] })
  )
  .get("/", function (req, res) {
    res.sendFile(path.join(__dirname + "/index.html"));
  })
  // For getting all login information
  .get("/users", async (req, res) => 
  {
    try 
    {
      pool.query("SELECT * FROM users", (error, result) => 
      {
        if (error) 
        {
          res.sendStatus(404);
        } 
        else 
        {
          const results = 
          { 
            results: result ? result.rows : null 
          };
          res.send(JSON.stringify(results));
        }
      });
    } 
    catch (error) 
    {
      console.error(error);
      res.send("Error " + error);
    }
  })
  // For posting all user login information
  .post("/saveusers", (req, res) => 
  {
    try 
    {
      pool.query(
        "DELETE FROM user where id = " + req.body.id,
        (error, result) => 
        {
          if (error) 
          {
            res.sendStatus(404);
          } 
          else 
          {
            let additionalSQL = "";

            for (let rowNum in req.body.rows) 
            {
              let row = req.body.rows[rowNum];
              additionalSQL += "(" + req.body.id + ", '" + row.first_name + ", '" + row.last_name + ", '" + row.major + ", '" + row.email_address + ", '" + row.password + "'),";
            }

            additionalSQL = additionalSQL.substring(0, additionalSQL.length - 1);

            let totalSQL = "INSERT INTO users (id, first_name, last_name, major, email_address, password) VALUES " + additionalSQL;

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
          }
        }
      );
    } 
    catch (error) 
    {
      console.error(error);
      res.send("Error " + error);
    }
  })
  //For Getting all buildings
  .get("/buildings", async (req, res) => {
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
  })
  //For Getting all classes
  .get("/classes", async (req, res) => {
    try {
      pool.query("SELECT * FROM classes", (err, result) => {
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
      pool.query(
        "DELETE FROM userclasses where userID = " + req.body.userID,
        (err, result) => {
          if (err) {
            res.sendStatus(404);
          } else {
            let additionalSQL = "";

            for (let rowNum in req.body.rows) {
              let row = req.body.rows[rowNum];
              additionalSQL +=
                "(" +
                req.body.userID +
                ", '" +
                row.name +
                ", '" +
                row.days +
                ", '" +
                row.building +
                ", '" +
                row.time +
                ", '" +
                row.room +
                "'),";
            }

            additionalSQL = additionalSQL.substring(
              0,
              additionalSQL.length - 1
            );

            let totalSQL =
              "INSERT INTO userclasses (userID, name, days, building, time, room) VALUES " +
              additionalSQL;

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
            additionalSQL +=
              "(" + req.body.userID + ", " + row.id + ", '" + row.time + "'),";
          }

          additionalSQL = additionalSQL.substring(0, additionalSQL.length - 1);

          let totalSQL =
            "INSERT INTO userpitstops (userID, stopID, stopTime) VALUES " +
            additionalSQL;

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
