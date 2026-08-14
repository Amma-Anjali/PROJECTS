const Listing = require("../models/listing.js");

// Build MongoDB filter from query parameters
function buildFilter(query) {
    let { category, q, minPrice, maxPrice } = query;
    let filter = {};

    if (category) {
        filter.category = category;
    }

    if (q && q.trim()) {
        filter.$or = [
            { title: { $regex: q, $options: "i" } },
            { location: { $regex: q, $options: "i" } },
            { country: { $regex: q, $options: "i" } },
        ];
    }

    if (minPrice || maxPrice) {
        filter.price = {};

        if (minPrice) {
            filter.price.$gte = Number(minPrice);
        }

        if (maxPrice) {
            filter.price.$lte = Number(maxPrice);
        }
    }

    return filter;
}

// Build sorting
function buildSort(sort) {
    if (sort === "price_asc") return { price: 1 };
    if (sort === "price_desc") return { price: -1 };
    if (sort === "newest") return { _id: -1 };

    return {};
}


// ===============================
// INDEX - Show all listings
// ===============================
module.exports.index = async (req, res) => {
    let filter = buildFilter(req.query);
    let sort = buildSort(req.query.sort);

    let allListings = await Listing.find(filter)
        .sort(sort)
        .populate({
            path: "reviews",
            select: "rating"
        });

    let wishlistIds = [];

    if (req.user && req.user.wishlist) {
        wishlistIds = req.user.wishlist.map((id) => id.toString());
    }

    res.render("listings/index.ejs", {
        allListings,
        wishlistIds,
        query: req.query,
    });
};


// ===============================
// SEARCH
// ===============================
module.exports.search = async (req, res) => {
    let filter = buildFilter(req.query);
    let sort = buildSort(req.query.sort);

    let allListings = await Listing.find(filter)
        .sort(sort)
        .populate({
            path: "reviews",
            select: "rating"
        });

    let wishlistIds = [];

    if (req.user && req.user.wishlist) {
        wishlistIds = req.user.wishlist.map((id) => id.toString());
    }

    res.render("listings/index.ejs", {
        allListings,
        wishlistIds,
        query: req.query,
    });
};


// ===============================
// NEW LISTING FORM
// ===============================
module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs");
};


// ===============================
// SHOW ONE LISTING
// ===============================
module.exports.showListing = async (req, res) => {
    let { id } = req.params;

    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: {
                path: "author",
            },
        })
        .populate("owner");

    if (!listing) {
        req.flash("error", "Listing you requested for doesn't exist!");
        return res.redirect("/listings");
    }

    let isWishlisted = false;

    if (req.user && req.user.wishlist) {
        isWishlisted = req.user.wishlist.some(
            (wid) => wid.equals(listing._id)
        );
    }

    res.render("listings/show.ejs", {
        listing,
        isWishlisted
    });
};


// ===============================
// CREATE LISTING
// ===============================
module.exports.createListing = async (req, res, next) => {
    let url = req.file.path;
    let filename = req.file.filename;

    const newListing = new Listing(req.body.listing);

    newListing.owner = req.user._id;
    newListing.image = {
        url,
        filename
    };

    await newListing.save();

    req.flash("success", "New Listing Created!");

    res.redirect("/listings");
};


// ===============================
// EDIT FORM
// ===============================
module.exports.renderEditForm = async (req, res) => {
    let { id } = req.params;

    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing you requested for doesn't exist!");
        return res.redirect("/listings");
    }

    let originalImageUrl = listing.image.url;

    originalImageUrl = originalImageUrl.replace(
        "/upload",
        "/upload/h_300,w_250"
    );

    res.render("listings/edit.ejs", {
        listing,
        originalImageUrl
    });
};


// ===============================
// UPDATE LISTING
// ===============================
module.exports.updateListing = async (req, res) => {
    let { id } = req.params;

    let listing = await Listing.findByIdAndUpdate(
        id,
        { ...req.body.listing },
        { new: true }
    );

    if (!listing) {
        req.flash("error", "Listing you requested for doesn't exist!");
        return res.redirect("/listings");
    }

    if (typeof req.file !== "undefined") {
        let url = req.file.path;
        let filename = req.file.filename;

        listing.image = {
            url,
            filename
        };
    }

    await listing.save();

    req.flash("success", "Listing Updated");

    res.redirect(`/listings/${id}`);
};


// ===============================
// DELETE LISTING
// ===============================
module.exports.destroyListing = async (req, res) => {
    let { id } = req.params;

    await Listing.findByIdAndDelete(id);

    req.flash("success", "Listing Deleted!");

    res.redirect("/listings");
};