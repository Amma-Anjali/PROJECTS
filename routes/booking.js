const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, validateBooking } = require("../middleware.js");
const bookingController = require("../controllers/booking.js");

router.post("/listings/:id/book", isLoggedIn, validateBooking, wrapAsync(bookingController.createBooking));
router.get("/trips", isLoggedIn, wrapAsync(bookingController.myTrips));
router.delete("/trips/:bookingId", isLoggedIn, wrapAsync(bookingController.cancelBooking));

module.exports = router;
