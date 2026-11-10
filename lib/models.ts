import mongoose, { Schema, models, model } from "mongoose";

const addressSchema = new Schema(
  {
    country: { type: String, default: "" },
    state: { type: String, default: "" },
    state_district: { type: String, default: "" },
    suburb: { type: String, default: "" },
    street: { type: String, default: "" },
  },
  { _id: false },
);

const mapSchema = new Schema({ lat: Number, lng: Number }, { _id: false });

const propertySchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User" },
    date: String,
    title: { type: String, required: true },
    description: { type: String, required: true },
    propertySize: { type: Number, default: 0 },
    rentalForm: String,
    featuredImage: String,
    premiumSubscription: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0 },
    address: addressSchema,
    amenities: [String],
    galleryImgs: [String],
    price: { type: String, required: true },
    currency: { type: String, default: "USD" },
    discount: { type: Number, default: 0 },
    listingType: { type: String, default: "Property" },
    listingCategory: { type: String, enum: ["Sale", "Rent"] },
    status: String,
    maxGuests: { type: Number, default: 1 },
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    map: mapSchema,
    suspended: { type: Boolean, default: false },
    moderation: { reason: String, by: String, at: Date, via: String },
  },
  { collection: "properties" },
);

const carSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User" },
    views: { type: Number, default: 0 },
    slug: String,
    title: String,
    description: String,
    year: { type: Number, required: true },
    odoReading: { type: Number, default: 0 },
    odoUnit: String,
    doors: Number,
    seats: Number,
    price: { type: Number, default: 0 },
    make: { type: String, required: true },
    carModel: String,
    transmission: String,
    colour: String,
    fuelType: String,
    bodyType: String,
    currency: { type: String, default: "USD" },
    status: { type: String, default: "DRAFT" },
    listingCategory: String,
    listingType: { type: String, default: "Car" },
    featuredImage: String,
    galleryImgs: [String],
    isAuction: Boolean,
    isFeatured: Boolean,
    address: addressSchema,
    map: mapSchema,
    suspended: { type: Boolean, default: false },
    moderation: { reason: String, by: String, at: Date, via: String },
  },
  { collection: "cars", timestamps: true },
);

// Listings suspended from the admin portal are hidden everywhere except when queried by owner.
for (const schema of [propertySchema, carSchema]) {
  schema.pre(["find", "findOne", "countDocuments"], function () {
    const filter = this.getFilter();
    if (!("author" in filter) && !("suspended" in filter)) this.where({ suspended: { $ne: true } });
  });
}

const userSchema = new Schema(
  {
    name: String,
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    image: String,
    role: { type: String, default: "user" },
    // Who the person is on the marketplace. `role` stays reserved for platform staff ("agent").
    accountType: { type: String, enum: ["client", "landlord", "agent"] },
    phone: String,
    profile: {
      agency: String,
      licenseNo: String,
      idNumber: { type: String, select: false },
      yearsExperience: Number,
      regions: [String],
      specialties: [String],
      website: String,
      bio: String,
    },
    verification: {
      status: { type: String, enum: ["none", "pending", "verified", "rejected"], default: "none" },
      submittedAt: Date,
      reviewedAt: Date,
      reviewedBy: String,
      note: String,
      history: [{ _id: false, at: Date, event: String, by: String, note: String }],
    },
    suspended: { type: Boolean, default: false },
    termsAcceptedAt: Date,
    passwordHash: { type: String, select: false },
  },
  { collection: "users", timestamps: true, strict: false },
);

const favouriteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    kind: { type: String, enum: ["property", "car"], required: true },
    listingId: { type: Schema.Types.ObjectId, required: true },
  },
  { collection: "favourites", timestamps: true },
);
favouriteSchema.index({ userId: 1, kind: 1, listingId: 1 }, { unique: true });

const auctionSchema = new Schema(
  {
    kind: { type: String, enum: ["property", "car"], required: true },
    listingId: { type: Schema.Types.ObjectId, required: true },
    sellerId: { type: Schema.Types.ObjectId, required: true, index: true },
    currency: { type: String, default: "USD" },
    startingBid: { type: Number, required: true },
    reservePrice: { type: Number, default: 0 },
    minIncrement: { type: Number, required: true },
    currentBid: { type: Number, default: 0 },
    bidCount: { type: Number, default: 0 },
    highBidderId: Schema.Types.ObjectId,
    endsAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ["live", "sold", "unsold", "cancelled"], default: "live", index: true },
    winnerId: Schema.Types.ObjectId,
  },
  { collection: "ys_auctions", timestamps: true },
);
auctionSchema.index({ kind: 1, listingId: 1 }, { unique: true });

const bidSchema = new Schema(
  {
    auctionId: { type: Schema.Types.ObjectId, required: true, index: true },
    bidderId: { type: Schema.Types.ObjectId, required: true },
    bidderName: String,
    amount: { type: Number, required: true },
  },
  { collection: "ys_bids", timestamps: true },
);
bidSchema.index({ auctionId: 1, amount: -1 });

const conversationSchema = new Schema(
  {
    kind: { type: String, enum: ["property", "car"], required: true },
    listingId: { type: Schema.Types.ObjectId, required: true },
    listingTitle: String,
    listingImage: String,
    sellerId: { type: Schema.Types.ObjectId, required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, required: true, index: true },
    sellerName: String,
    buyerName: String,
    lastMessage: String,
    lastMessageAt: { type: Date, default: Date.now },
    sellerUnread: { type: Number, default: 0 },
    buyerUnread: { type: Number, default: 0 },
  },
  { collection: "ys_conversations", timestamps: true },
);
conversationSchema.index({ kind: 1, listingId: 1, buyerId: 1 }, { unique: true });

const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, required: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    body: { type: String, required: true, maxlength: 2000 },
  },
  { collection: "ys_messages", timestamps: true },
);
messageSchema.index({ conversationId: 1, createdAt: 1 });

const imageSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
    contentType: { type: String, required: true },
    size: Number,
    data: { type: Buffer, required: true },
  },
  { collection: "ys_images", timestamps: true },
);

export const RESERVATION_ACTIVE = ["pending_payment", "held", "confirmed"] as const;

const historySchema = new Schema({ at: { type: Date, default: Date.now }, event: String, by: String, note: String }, { _id: false });

const reservationSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    kind: { type: String, enum: ["property", "car"], required: true },
    listingId: { type: Schema.Types.ObjectId, required: true },
    listingTitle: String,
    listingImage: String,
    type: { type: String, enum: ["sale", "rent"], required: true },
    buyerId: { type: Schema.Types.ObjectId, required: true, index: true },
    buyerName: String,
    sellerId: { type: Schema.Types.ObjectId, required: true, index: true },
    sellerName: String,
    listingPrice: Number,
    listingCurrency: String,
    feeAmount: { type: Number, required: true },
    feeCurrency: { type: String, default: "ZMW" },
    status: {
      type: String,
      enum: ["pending_payment", "held", "confirmed", "completed", "cancelled", "declined", "expired"],
      default: "pending_payment",
      index: true,
    },
    // Only one active reservation can exist per listing (enforced by the partial unique index below).
    active: { type: Boolean, default: true },
    holdExpiresAt: Date,
    paymentId: Schema.Types.ObjectId,
    paidAt: Date,
    // The seller must close the deal before this moment or the reservation lapses and the buyer is refunded.
    dealDueAt: Date,
    history: [historySchema],
  },
  { collection: "ys_reservations", timestamps: true },
);
reservationSchema.index({ kind: 1, listingId: 1 }, { unique: true, partialFilterExpression: { active: true } });

const commentSchema = new Schema(
  {
    kind: { type: String, enum: ["property", "car"], required: true },
    listingId: { type: Schema.Types.ObjectId, required: true },
    authorId: { type: Schema.Types.ObjectId, required: true, index: true },
    authorName: String,
    body: { type: String, required: true, maxlength: 1000 },
  },
  { collection: "ys_comments", timestamps: true },
);
commentSchema.index({ kind: 1, listingId: 1, createdAt: -1 });

const paymentSchema = new Schema(
  {
    reservationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    idempotencyKey: { type: String, required: true },
    provider: { type: String, required: true },
    network: { type: String, enum: ["mtn", "airtel", "zamtel"], required: true },
    // The full phone number is never persisted, only a masked form for receipts.
    msisdnMasked: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: "ZMW" },
    status: { type: String, enum: ["pending", "succeeded", "failed", "expired", "refunded"], default: "pending", index: true },
    providerRef: { type: String, index: true },
    failureReason: String,
    settledAt: Date,
    refundedAt: Date,
    refundReason: String,
  },
  { collection: "ys_payments", timestamps: true },
);
paymentSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });

export const Property = models.Property || model("Property", propertySchema);
export const Car = models.Car || model("Car", carSchema);
export const User = models.User || model("User", userSchema);
export const Favourite = models.Favourite || model("Favourite", favouriteSchema);

export const Auction = models.Auction || model("Auction", auctionSchema);
export const Bid = models.Bid || model("Bid", bidSchema);
export const Conversation = models.Conversation || model("Conversation", conversationSchema);
export const Message = models.Message || model("Message", messageSchema);
export const Image = models.Image || model("Image", imageSchema);
export const Reservation = models.Reservation || model("Reservation", reservationSchema);
export const Comment = models.Comment || model("Comment", commentSchema);
export const Payment = models.Payment || model("Payment", paymentSchema);

export const isObjectId = (id: string) => mongoose.isValidObjectId(id);
