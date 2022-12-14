require("dotenv").config();
const express = require("express");
const app = express();
const path = require("path");
const hbs = require("hbs");
const argon2 = require("argon2");
const cookieParser = require("cookie-parser");
const auth = require("./middleware/auth");
const validator = require("validator");

require("./db/conn");
const Register = require("./models/registers");
const { models } = require("mongoose");

const port = process.env.PORT || 3000;


const static_path = path.join(__dirname, "../public");

const template_path = path.join(__dirname, "../templates/views");
const partials_path = path.join(__dirname, "../templates/partials");

// handlebars helpers
hbs.registerHelper("eq", (a, b) => a === b);

app.use(express.static(static_path));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.set("view engine", "hbs");
app.set("views", template_path);
hbs.registerPartials(partials_path);

app.get("/", (req, res) => {
  // check whether jwt is undefined or not.
  res.render("index", { logged_in: !!req.cookies.jwt });
});

app.get("/contact", (req, res) => {
  res.render("contact", { logged_in: !!req.cookies.jwt });
});

app.get("/index", (_req, res) => {
  res.redirect("/");
});

app.get("/login", (_req, res) => {
  res.render("login");
});
app.get("/register", (_req, res) => {
  res.render("register");
});
app.get("/confirmregister", (_req, res) => {
  res.render("confirmregister");
});

////////secrete///////////////////
app.get("/mappy", auth, async (req, res) => {
  console.log(`the cookie token is ${req.cookies.jwt}`);

  if (!req.user.tokens.find((x) => x.token === req.cookies.jwt.toString())) {
    res.clearCookie("jwt");
    return res.redirect("/login");
  }

  const workouts = req.user.workouts.toJSON();
  res.render("mappy", { workouts: workouts, e: 1 });
});

app.get("/api/mappy/workouts", auth, (req, res) => {
  if (!req.cookies.jwt) {
    return res.sendStatus(403);
  }
  res.setHeader("Content-Type", "application/json");
  res.send(req.user.workouts.toJSON());
});
app.get("/profile", auth, async (req, res) => {
  res.render("profile", { logged_in: !!req.cookies.jwt });
});
///////////////////////////////

app.get("/logout", auth, async function (req, res) {
  try {
    req.user.tokens = req.user.tokens.filter((currElement) => {
      return currElement.token !== req.token;
    });

    //////////////////////////
    res.clearCookie("jwt");
    await req.user.save();
    console.log("logout sucessfully");
    res.status(201).redirect("/index");
  } catch (error) {
    res.status(500).send(error);
  }
});
app.get("/logoutall", auth, async function (req, res) {
  try {
    req.user.tokens = req.user.tokens.filter((currElement) => {
      return currElement.token !== req.token;
    });
    req.user.tokens = [];

    //////////////////////////
    res.clearCookie("jwt");
    await req.user.save();
    console.log("logout sucessfully");
    res.status(201).redirect("/index");
  } catch (error) {
    res.status(500).send(error);
  }
});

//   create new user in our database
app.post("/register", async (req, res) => {
  const password = req.body.pswd;
  const cpassword = req.body.confirmpswd;
  const email = req.body.email;
  const valid = validator.isEmail(email);
  if (!valid) {
    return res.render("register", { validate: true });
  }
  const paswd =
    /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9])(?!.*\s).{8,25}$/;
  if (password !== cpassword) {
    return res.redirect("/register");
  }
  if (!password.match(paswd)) {
    return res.redirect("/register");
  }

  const registerEmployee = new Register({
    name: req.body.name,
    email: req.body.email,
    pswd: password,
  });

  ////generating token for cookiee//////////
  const token = await registerEmployee.generateAuthToken();
  console.log("the token part " + token);

  try {
    await registerEmployee.save();
  } catch (error) {
    return res.render("register", { check: true });
  }

  //////////////////adding cookiee////////////////git
  res.cookie("jwt", token, {
    expires: new Date(Date.now() + 3600 * 1000),
    // httpOnly: true,
  });
  return res.redirect("/index");
});

//login check///////////////////////
app.post("/login", async (req, res) => {
  const user_db = await Register.findOne({ email: req.body.email });
  if (!user_db) {
    return res.render("login", { forgot: true });
  }

  if (!(await argon2.verify(user_db.pswd, req.body.pswd))) {
    return res.render("login", { forgot: true });
  }

  const token = await user_db.generateAuthToken();
  console.log("the token part " + token);

  /////////////adding cookie////////////////////////////////
  res.cookie("jwt", token, {
    expires: new Date(Date.now() + 3600 * 1000),
    httpOnly: true,
    //secure: true,         //---------------only use when you deploy this on secure https
  });

  res.redirect("/");
});
app.post("/mappy", auth, async (req, res) => {
  const duration = req.body.duration;
  const distance = req.body.distance;
  const cadence = req.body.cadence;
  const elevgain = req.body.elevgain;
  const type = req.body.type;
  let pace = (req.body.duration / req.body.distance).toFixed(1);
  let speed = (req.body.distance / req.body.duration / 60).toFixed(1);
  const date = req.body.date;
  const month = req.body.month;
  const identity = req.body.identity;
  const lat = req.body.latitude;
  const lng = req.body.longitude;

  // const workout = new Register
  console.log(
    duration,
    distance,
    cadence,
    elevgain,
    type,
    pace,
    speed,
    date,
    month,
    identity,
    lat,
    lng
  );
  const updatedocument = async (userId) => {
    try {
      const result = await Register.findByIdAndUpdate(
        userId,
        {
          $push: {
            workouts: {
              duration: duration,
              distance: distance,
              cadence: cadence,
              elevgain: elevgain,
              type: type,
              pace: pace,
              speed: speed,
              date: date,
              month: month,
              identity: identity,
              latitude: lat,
              longitude: lng,
            },
          },
        },
        { new: true, useFindAndModify: false }
      );
      // console.log(result);
    } catch (err) {
      console.log(err);
      res.status(500).send(err);
    }
  };
  updatedocument(req.user.id);
  return res.redirect("/mappy");
});

app.post("/mappy/delete", auth, async (req, res) => {
  const ides = req.body.unique;
  console.log(ides);

  try {
    Register.updateOne(
      { _id: req.user.id },
      { $pull: { workouts: { identity: ides } } },
      { safe: true, multi: true },
      function (err, obj) {}
    );
    return res.redirect("/mappy");
  } catch (err) {
    res.status(500).send(err);
  }
});
////////////////////////////////////////////
app.listen(port, () => {
  console.log(`server is running at port no ${port}`);
});
