var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var Comment = require("../models/comment");
var middleware = require("../middleware");
var NodeGeocoder = require('node-geocoder');

// IMAGE UPLOAD
var multer = require('multer');
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|jfif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter})

var cloudinary = require('cloudinary');
cloudinary.config({ 
  cloud_name: 'cacamping', 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});
 
var options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};
var geocoder = NodeGeocoder(options);
var Review = require("../models/review");

// INDEX - show all campgrounds
router.get("/", function(req, res){
	var perPage = 6;
	var pageQuery = parseInt(req.query.page);
  var pageNumber = pageQuery ? pageQuery : 1;
	var noMatch = null;
	if(req.query.search){
		const regex = new RegExp(escapeRegex(req.query.search), "gi");
		// Perform fuzzy search of campgrounds from DB
		// Pagination 
		// Sorting by newest first (doesn't work) : sort({"createdAt":-1})
		Campground.find({name: regex}).skip((perPage * pageNumber) - perPage).limit(perPage).sort({"createdAt":-1}).exec(function (err, allCampgrounds) {
			 Campground.count().exec(function (err, count) {
				if(err){
					console.log(err);
				} else {
					if(allCampgrounds.length === 0){
						var noMatch = "No results match that query, please try again.";
					}
					res.render("campgrounds/index", {
						campgrounds: allCampgrounds,
						current: pageNumber,
						pages: Math.ceil(count / perPage),
						noMatch: noMatch,
						search: req.query.search
					});
				}
			 });
		});
	} else{
		// Get all campgrounds from DB
		Campground.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
			Campground.count().exec(function (err, count) {
				if (err) {
					console.log(err);
				} else {
					res.render("campgrounds/index", {
						campgrounds: allCampgrounds,
						current: pageNumber,
						pages: Math.ceil(count / perPage),
						noMatch: noMatch,
						search: false
					});
				}
			});
		});
	}
	
});

// //CREATE - add new campground to DB
// router.post("/", middleware.isLoggedIn, upload.single('image'), function(req, res) {
// 	// // get data from form and add to campgrounds array
// 	// var name = req.body.name;
// 	// var image = req.body.image;
// 	// var price = req.body.price;
// 	// var desc = req.body.description;
// 	// var author = {
// 	// 	id: req.user._id,
// 	// 	username: req.user.username
// 	// };
//   cloudinary.v2.uploader.upload(req.file.path, function(err, result) {
//     // add cloudinary url for the image to the campground object under image property
//     if (err) {
//       req.flash("error", "Can't upload image, try again later.");
//       req.redirect("back");
//     }
//     req.body.campground.image = result.secure_url;
//     // add author to campground
//     req.body.campground.author = {
//       id: req.user._id,
//       username: req.user.username
//     }
// 	  // console.log(req.body.campground.image);
//     geocoder.geocode(req.body.location, function (err, data) {
//       console.log("this is data", req.body.location);
//       if (err || !data.length) {
//         req.flash('error', 'Invalid address');
//         return res.redirect('back');
//       }
//       var lat = data[0].latitude;
//       var lng = data[0].longitude;
//       var location = data[0].formattedAddress;
//       var newCampground = {name: name, image: image, price: price, description: desc, author:author, location: location, lat: lat, lng: lng};

//       // //Create a new campground and save to DB
//       // Campground.create(newCampground, function(err, newlyCreated){
//       // 	if(err){
//       // 		console.log(err);
//       // 	} else {
//       // 		//redirect back to campgrounds page
//       // 		console.log(newlyCreated);
//       // 		res.redirect("/campgrounds");
//       // 	}
//       // });
//       Campground.create(req.body.campground, function(err, campground) {
//       if (err) {
//         req.flash('error', err.message);
//         return res.redirect('back');
//       }
//       res.redirect('/campgrounds/' + campground.id);
//       });
//     });
//   });
// });

//CREATE - add new campground to DB
router.post("/", middleware.isLoggedIn, upload.single('image'), function(req, res) {
  cloudinary.v2.uploader.upload(req.file.path, function(err, result) {
    if(err) {
      req.flash('error', err.message);
      return res.redirect('back');
    }
    geocoder.geocode(req.body.location, function (err, data) {
      if (err || !data.length) {
        req.flash('error', 'Invalid address');
        return res.redirect('back');
      }
      req.body.campground.lat = data[0].latitude;
      req.body.campground.lng = data[0].longitude;
      req.body.campground.location = data[0].formattedAddress;

        // add cloudinary url for the image to the campground object under image property
      req.body.campground.image = result.secure_url;
      // add author to campground
      req.body.campground.author = {
        id: req.user._id,
        username: req.user.username
      }
      Campground.create(req.body.campground, function(err, campground) {
        if (err) {
          req.flash('error', err.message);
          return res.redirect('back');
        }
        res.redirect('/campgrounds/' + campground.slug);
      });
    });
  });
});

//NEW = show form to create new campground
router.get("/new", middleware.isLoggedIn, function(req, res){
	res.render("campgrounds/new");
});

//SHOW - shows more info about one campground
router.get("/:slug", function(req, res){
	//find the campground with provided slug
	Campground.findOne({slug: req.params.slug}).populate("comments likes").populate({
    path: "reviews",
    options: {sort: {createdAt: -1}}
  }).exec(function (err, foundCampground) {
		if(err || !foundCampground){
			req.flash("error", "Campground not found!");
			res.redirect("back");
		} else {
			//render show template with that campground
			res.render("campgrounds/show", {campground: foundCampground});
    }
	});
});

//EDIT CAMPGROUND ROUTE
router.get("/:slug/edit", middleware.checkCampgroundOwnership, function(req, res){
	Campground.findOne({slug: req.params.slug}, function(err, foundCampground){
		res.render("campgrounds/edit", {campground: foundCampground});	
	});
});

//UPDATE CAMPGROUND ROUTE
router.put("/:slug", middleware.checkCampgroundOwnership, function(req, res){
	geocoder.geocode(req.body.location, function (err, data) {
		if (err || !data.length) {
			req.flash('error', 'Invalid address');
			return res.redirect('back');
		}
    req.body.campground.lat = data[0].latitude;
    req.body.campground.lng = data[0].longitude;
    req.body.campground.location = data[0].formattedAddress;
	
 	 // delete req.body.campground.rating;

	//find and update the correct campground
		Campground.findOne({slug: req.params.slug}, function(err, campground){
			if(err){
				res.redirect("/campgrounds");
			} else {
          campground.name = req.body.campground.name;
          campground.price = req.body.campground.price;
          campground.image = req.body.campground.image;
          campground.location = req.body.campground.location;
          campground.description = req.body.campground.description;
          campground.save(function (err) {
				    res.redirect("/campgrounds/" + campground.slug);
		    });                     
		  }
    });
  });    
});

//DESTROY CAMPGROUND ROUTE and Delete associated comments and reviews
router.delete("/:slug", middleware.checkCampgroundOwnership, function (req, res) {
	Campground.findOneAndRemove({slug: req.params.slug}, function(err, campground){
		if (err) {
			res.redirect("/campgrounds");
		} else {
			// deletes all comments associated with the campground
			Comment.remove({"_id": {$in: campground.comments}}, function (err) {
				if (err) {
					console.log(err);
					return res.redirect("/campgrounds");
				}
				// deletes all reviews associated with the campground
				Review.remove({"_id": {$in: campground.reviews}}, function (err) {
					if (err) {
						console.log(err);
						return res.redirect("/campgrounds");
					}
					//  delete the campground
					// campground.remove();
					req.flash("success", "Campground deleted successfully!");
					res.redirect("/campgrounds");
				});
			});
		}
	});
});

// Campground Like Route
router.post("/:slug/like", middleware.isLoggedIn, function (req, res) {

	Campground.findOne({slug: req.params.slug}, function(err, foundCampground){
		if (err) {
			console.log(err);
			return res.redirect("/campgrounds");
		}
		// eval(require("locus"));
		// check if req.user._id exists in foundCampground.likes
		var foundUserLike = foundCampground.likes.some(function (like) {
			return like.equals(req.user._id);
		});

		if (foundUserLike) {
			// user already liked, removing like
			foundCampground.likes.pull(req.user._id);
		} else {
			// adding the new user like
			foundCampground.likes.push(req.user);
		}

		foundCampground.save(function (err) {
			if (err) {
				console.log(err);
				return res.redirect("/campgrounds");
			}
			return res.redirect("/campgrounds/" + foundCampground.slug);
		});
	});
});

// //DESTROY CAMPGROUND ROUTE and Delete associated comments
// router.delete("/:id", middleware.checkCampgroundOwnership, function(req, res, next){
// 	Campground.findById(req.params.id, function(err, campground){
// 		Comment.remove({
// 			"_id": {$in: campground.comments}
// 		}, function(err){
// 			if(err) return next(err);
// 			campground.remove();
// 			res.redirect("/campgrounds");
// 		});
// 	});
// });

// router.delete("/:id", checkCampgroundOwnership, function(req, res){
// 	Campground.findByIdAndRemove(req.params.id, function(err){
// 		if(err){
// 			res.redirect("/campgrounds");
// 		} else{
// 			res.redirect("/campgrounds");
// 		}
// 	});
// });

// router.delete("/:id", isLoggedIn, (req, res) => {
//     Campground.findByIdAndRemove(req.params.id, (err, campgroundRemoved) => {
//         if (err) {
//             console.log(err);
//         }
//         Comment.deleteMany( {_id: { $in: campgroundRemoved.comments } }, (err) => {
//             if (err) {
//                 console.log(err);
//             }
//             res.redirect("/campgrounds");
//         });
//     })
// });

//Fuzzy search function
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = router;