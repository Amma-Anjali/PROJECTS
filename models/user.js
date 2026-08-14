const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

// console.log(passportLocalMongoose);

const userSchema = new Schema({
    email : {
        type : String,
        required : true
    },
    wishlist: [
        {
            type: Schema.Types.ObjectId,
            ref: "Listing",
        }
    ],
});

const plugin = passportLocalMongoose.default || passportLocalMongoose;
userSchema.plugin(plugin);

module.exports = mongoose.model("User", userSchema);