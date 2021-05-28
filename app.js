require('dotenv').config();

var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
var flash = require("connect-flash");
var passport = require("passport");
var LocalStrategy = require("passport-local");
var methodOverride = require("method-override");
var Campground = require("./models/campground");
var Comment = require("./models/comment");
var User = require("./models/user");
var seedDB = require("./seeds");

//Requiring Routes
var commentRoutes = require("./routes/comments"),
	reviewRoutes = require("./routes/reviews"),
	campgroundRoutes = require("./routes/campgrounds"),
	indexRoutes = require("./routes/index");

console.log(process.env.DATABASEURL);

//**********************
// For Goorm Deployment
//**********************
// var url = process.env.DATABASEURL || "mongodb://localhost:27017/yelp_camp_v21"
// mongoose.connect(url, {useNewUrlParser:true});

//**********************
// For Heroku Deployment
//**********************
mongoose.connect("mongodb+srv://yelpcamp:rTxPhhy9mpnqDp4M@cluster0-fhuek.mongodb.net/test?retryWrites=true&w=majority", {
	useNewUrlParser: true,
	useCreateIndex: true
}).then(() => {
		 console.log("Connected to DB!");
}).catch(err => {
		console.log("ERROR:", err.message);
});

 

app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());

app.locals.moment = require('moment');

//Passport Configuration
app.use(require("express-session")({
	secret: "Once again Beamer wins the cutest dog!",
	resave: false,
	saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
	res.locals.currentUser = req.user;
	res.locals.error = req.flash("error");
	res.locals.success = req.flash("success");
	next();
})

app.use("/", indexRoutes);
app.use("/campgrounds/:slug/comments", commentRoutes);
app.use("/campgrounds", campgroundRoutes);
app.use("/campgrounds/:id/reviews", reviewRoutes);


//**********************
// For Heroku Deployment
//**********************
app.listen(process.env.PORT, process.env.IP);


//**********************
// For Goorm Deployment
//**********************
// app.listen(3001, process.env.IP, function(){
// 	console.log("YelpCamp Server has started");
// });

