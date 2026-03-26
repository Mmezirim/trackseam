const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const TailorSchema = new mongoose.Schema(
  {
    shopName: { type: String, required: true, unique: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
  },
  { timestamps: true }
);

// HASH PASSWORD BEFORE SAVING
TailorSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// COMPARE PASSWORD METHOD
TailorSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// NEVER RETURN PASSWORD IN RESPONSES
TailorSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("Tailor", TailorSchema); 