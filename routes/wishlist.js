const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn } = require("../middleware.js");
const wishlistController = require("../controllers/wishlist.js");

router.get("/wishlist", isLoggedIn, wrapAsync(wishlistController.myWishlist));
router.post("/listings/:id/wishlist", isLoggedIn, wrapAsync(wishlistController.toggleWishlist));

module.exports = router;
