const User = require("../models/user.js");
const Listing = require("../models/listing.js");

module.exports.toggleWishlist = async (req, res) => {
    let { id } = req.params;
    let user = await User.findById(req.user._id);

    let alreadySaved = user.wishlist.some((wid) => wid.equals(id));

    if (alreadySaved) {
        user.wishlist.pull(id);
        await user.save();
        req.flash("success", "Removed from wishlist");
    } else {
        user.wishlist.push(id);
        await user.save();
        req.flash("success", "Saved to wishlist!");
    }

    res.redirect(req.get("Referer") || `/listings/${id}`);
};

module.exports.myWishlist = async (req, res) => {
    let user = await User.findById(req.user._id).populate({
        path: "wishlist",
        populate: { path: "reviews", select: "rating" },
    });

    res.render("wishlist.ejs", { allListings: user.wishlist });
};
