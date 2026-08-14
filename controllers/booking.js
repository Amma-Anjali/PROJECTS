const Booking = require("../models/booking.js");
const Listing = require("../models/listing.js");

module.exports.createBooking = async (req, res) => {
    let { id } = req.params;
    let { checkIn, checkOut, guests } = req.body.booking;

    let listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found");
        return res.redirect("/listings");
    }

    let checkInDate = new Date(checkIn);
    let checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate) || isNaN(checkOutDate) || checkOutDate <= checkInDate) {
        req.flash("error", "Please pick a valid check-out date after your check-in date");
        return res.redirect(`/listings/${id}`);
    }

    // Prevent overlapping confirmed bookings on the same listing
    let overlapping = await Booking.findOne({
        listing: id,
        status: "confirmed",
        checkIn: { $lt: checkOutDate },
        checkOut: { $gt: checkInDate },
    });

    if (overlapping) {
        req.flash("error", "Those dates are already booked. Try different dates!");
        return res.redirect(`/listings/${id}`);
    }

    let nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    let totalPrice = nights * listing.price;

    let booking = new Booking({
        listing: id,
        user: req.user._id,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guests: Number(guests) || 1,
        nights,
        totalPrice,
    });

    await booking.save();
    req.flash("success", `Trip booked! ${nights} night${nights > 1 ? "s" : ""} for ₹${totalPrice.toLocaleString("en-IN")}`);
    res.redirect("/trips");
};

module.exports.myTrips = async (req, res) => {
    let bookings = await Booking.find({ user: req.user._id })
        .populate("listing")
        .sort({ createdAt: -1 });

    res.render("bookings/index.ejs", { bookings });
};

module.exports.cancelBooking = async (req, res) => {
    let { bookingId } = req.params;
    let booking = await Booking.findById(bookingId);

    if (!booking || !booking.user.equals(req.user._id)) {
        req.flash("error", "You can't cancel this booking");
        return res.redirect("/trips");
    }

    booking.status = "cancelled";
    await booking.save();

    req.flash("success", "Booking cancelled");
    res.redirect("/trips");
};
