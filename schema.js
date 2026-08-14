const Joi = require('joi');

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        location: Joi.string().required(),
        country: Joi.string().required(),
        price: Joi.number().required().min(0),
        image: Joi.string().allow("", null),

        category: Joi.string().required()
    }).required()
});
module.exports.reviewSchema = Joi.object({
    review : Joi.object({
        rating : Joi.number().required().min(1).max(5),
        comment : Joi.string().required(),
    }).required(),
});

module.exports.bookingSchema = Joi.object({
    booking: Joi.object({
        checkIn: Joi.string().required(),
        checkOut: Joi.string().required(),
        guests: Joi.number().min(1).default(1),
    }).required(),
});