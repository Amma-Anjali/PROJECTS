const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  image: {
    url : String,
    filename : String,
  },
  price: Number,
  location: String,
  country: String,
  reviews : [
    {
      type : Schema.Types.ObjectId,
      ref : "Review"
    }
  ],
  owner : {
    type : Schema.Types.ObjectId,
    ref : "User",
  },

  category: {
  type: String,
  enum: [
    "Trending",
    "Rooms",
    "Iconic Cities",
    "Mountains",
    "Castles",
    "Fire",
    "Pools",
    "Camping",
    "Farms",
    "Arctic",
    "Domes"
  ],
  },
});

// Middleware to delete all reviews if post deleted
listingSchema.post("findOneAndDelete", async (listing) => {
  if(listing){
    await Review.deleteMany({_id : { $in : listing.reviews }});
  }
});

listingSchema.set("toObject", { virtuals: true });
listingSchema.set("toJSON", { virtuals: true });

listingSchema.virtual("averageRating").get(function () {
  if (!this.reviews || this.reviews.length === 0 || typeof this.reviews[0] === "string") {
    return 0;
  }
  if (this.reviews[0].rating === undefined) return 0;
  const total = this.reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
  return Math.round((total / this.reviews.length) * 10) / 10;
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;