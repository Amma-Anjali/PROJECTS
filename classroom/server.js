const express = require("express");
const app = express();
const users = require("./routes/user.js");
const posts = require("./routes/post.js");
const session = require("express-session");
const flash = require("connect-flash");
const path = require("path");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

const sessionOptions = {
    secret : "mysupersecretstring",
    resave : false,
    saveUninitialized : true,
};

app.use(session(sessionOptions));
app.use(flash());

app.get("/register", (req, res) => {
    let {name = "anonymous"} = req.query;
    req.session.name = name;
    //console.log(req.session.name);
    if(name === "anonymous"){
        req.flash("error", " user not found");
    }else{
        req.flash("success", "user registered successfully!")
    }
    res.redirect("/hello");
});
app.get("/hello", (req, res) => {
    res.locals.successMsg = req.flash("success");
    res.locals.errorMsg = req.flash("error");
    res.render("page.ejs", {name : req.session.name});
    next();
});

// app.get("/hello", (req, res) => {
//     res.send(`hello, ${req.session.name}`);
// });


app.listen(3000, () => {
    console.log("server is listening to 3000");
});

// app.use(session({ secret : "mysupersecretstring",
//     resave : true,
//     saveUninitialized : true,
// }));


// app.get("/reqcount", (req, res) => {
//     if(req.session.count){
//         req.session.count++;
//     }else{
//         req.session.count = 1;
//     }

//     res.send(`You sent a request ${req.session.count} times`);
// });


// app.get("/reqcount", (req, res) => {
//     res.send(`You sent a request x times`);
// });




// const cookieParser = require("cookie-parser");
// // middleware
// app.use(cookieParser("secretecode"));

// app.get("/getsignedcookie", (req, res) => {
//     res.cookie("made-in", "India", {signed : true});
//     res.send("signed cookie sent");
// });
// app.get("/verify", (req, res) => {
//     console.log(req.cookies);         // raw cookies (untrusted)
//     console.log(req.signedCookies);   // verified cookies (trusted)

//     res.send("verified");
// });

// app.get("/getcookies", (req, res) => {
//     res.cookie("greet", "hello");
//     res.cookie("Hi", "Kanna");
//     res.cookie("Hello", "Radha");
//     res.send("sent you some cookies");
// });
// app.get("/greet", (req, res) => {
//     let {name = "anonymous"} = req.cookies;
//     res.send(`Hi, ${name}`);

// });

// app.use("/users", users);
// app.use("/posts", posts);
