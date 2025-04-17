"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pg_1 = __importDefault(require("pg"));
const key_1 = __importDefault(require("./key"));
const bcrypt_ts_1 = __importDefault(require("bcrypt-ts"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const { Client } = pg_1.default;
const app = (0, express_1.default)();
app.use(express_1.default.json());
const dbConfig = key_1.default;
const client = new Client(dbConfig);
function initialize() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield client.connect();
            console.log("Connected to PostgreSQL database");
            yield client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        username text COLLATE pg_catalog."default" NOT NULL,
        password text COLLATE pg_catalog."default" NOT NULL,
        email text COLLATE pg_catalog."default" NOT NULL,
        userid SERIAL PRIMARY KEY
      );
    `);
            yield client.query(`
      CREATE TABLE IF NOT EXISTS public.trainschedule (
        startstation text COLLATE pg_catalog."default" NOT NULL,
        endstation text COLLATE pg_catalog."default" NOT NULL,
        trainnumber text COLLATE pg_catalog."default" NOT NULL,
        startdirection text COLLATE pg_catalog."default",
        enddirection text COLLATE pg_catalog."default" NOT NULL,
        arrivaltime time without time zone,
        departuretime time without time zone
      );
    `);
        }
        catch (err) {
            console.error("Error initializing database:", err);
        }
    });
}
initialize();
app.post("/login", (req, res) => {
    const jwtSecretKey = "123";
    const { username, password } = req.body;
    client.query("SELECT * FROM users WHERE username = $1", [username], (err, result) => {
        if (err) {
            res.status(500).send({ message: "Database error" });
        }
        else if (result.rows.length === 0) {
            res.status(401).send({
                authenticated: false,
                message: "Invalid username or password1",
            });
        }
        else {
            const user = result.rows[0];
            const isMatch = bcrypt_ts_1.default.compareSync(password, user.password);
            if (isMatch) {
                const data = {
                    username: user.username,
                    signInTime: Date.now(),
                };
                const token = jsonwebtoken_1.default.sign(data, jwtSecretKey, { expiresIn: "1h" });
                res
                    .status(200)
                    .json({ message: "success", token, username: user.username });
            }
            else {
                res.status(401).send({
                    authenticated: false,
                    message: "Invalid username or password2",
                });
            }
        }
    });
});
app.post("/verifyjwt", (req, res) => {
    const { token } = req.body;
    const jwtSecretKey = "123";
    jsonwebtoken_1.default.verify(token, jwtSecretKey, (err, decoded) => {
        if (err) {
            res.status(401).send({ message: "Invalid token" });
        }
        else {
            res.status(200).send({ authenticated: true, username: decoded.username });
        }
    });
});
app.post("/register", (req, res) => {
    const { email, username, password } = req.body;
    const hashedPassword = bcrypt_ts_1.default.hashSync(password, 10);
    client.query("SELECT * FROM users WHERE username = $1 OR email = $2", [username, email], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send({ message: "Database error1" });
        }
        else if (result.rows.length > 0) {
            res.send({ message: "Username or Email already exists" });
        }
        else {
            client.query("INSERT INTO users (email, username, password) VALUES ($1, $2, $3)", [email, username, hashedPassword], (err) => {
                if (err) {
                    console.log(err);
                    res.status(500).send({ message: "Database error2" });
                }
                else {
                    res.send({ message: "User created successfully" });
                }
            });
        }
    });
});
app.post("/addTrain", (req, res) => {
    const { trainnumber, startstation, endstation, departuretime, arrivaltime, startdirection, enddirection, } = req.body;
    client.query("SELECT * FROM trainschedule WHERE trainnumber = $1 AND departuretime = $2", [trainnumber, departuretime], (err, result) => {
        if (err) {
            console.error("Database error on SELECT:", err);
            return res.status(500).send({ message: "Database error" });
        }
        if (result.rows.length > 0) {
            return res
                .status(400)
                .send({ message: "Train already scheduled at this time" });
        }
        client.query(`INSERT INTO trainschedule (
          trainnumber, startstation, endstation, 
          departuretime, arrivaltime, startdirection, enddirection
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
            trainnumber,
            startstation,
            endstation,
            departuretime,
            arrivaltime,
            startdirection,
            enddirection,
        ], (err) => {
            if (err) {
                console.error("Database error on INSERT:", err);
                res.status(500).send({ message: "Database error" });
            }
            else {
                res.send({ message: "Record created successfully" });
            }
        });
    });
});
app.get("/getTrains", (req, res) => {
    client.query("SELECT * FROM trainschedule", (err, result) => {
        if (err) {
            console.error("Error fetching train schedule:", err);
            return res.status(500).send({ message: "Database error" });
        }
        res.send(result.rows);
    });
});
app.delete("/deleteTrain/:trainnumber", (req, res) => {
    const { trainnumber } = req.params;
    client.query("DELETE FROM trainschedule WHERE trainnumber = $1", [trainnumber], (err) => {
        if (err) {
            console.error("Error deleting train:", err);
            return res.status(500).send({ message: "Database error" });
        }
        res.send({ message: "Train deleted" });
    });
});
app.patch("/updateTrain/:trainnumber", (req, res) => {
    const { trainnumber } = req.params;
    const { startstation, endstation, departuretime, arrivaltime, startdirection, enddirection, } = req.body;
    client.query(`UPDATE trainschedule SET
      startstation = $1,
      endstation = $2,
      departuretime = $3,
      arrivaltime = $4,
      startdirection = $5,
      enddirection = $6
     WHERE trainnumber = $7`, [
        startstation,
        endstation,
        departuretime,
        arrivaltime,
        startdirection,
        enddirection,
        trainnumber,
    ], (err, result) => {
        if (err) {
            console.error("UPDATE error:", err);
            return res.status(500).send({ message: "Update failed" });
        }
        res.send({ message: "Train updated successfully" });
    });
});
const port = process.env.Port || 3001;
app.listen(port, () => {
    console.log(`Serve at http://localhost:${port}`);
    console.log(dbConfig);
});
//# sourceMappingURL=backend.js.map