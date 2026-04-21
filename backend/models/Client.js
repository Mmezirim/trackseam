const mongoose = require("mongoose");

const MeasurementSchema = new mongoose.Schema(
  {
    outfitType:  { type: String, required: true },
    description: { type: String, required: true },
    fields:      { type: Map, of: String, default: {} },
    notes:       { type: String, default: "" },
  },
  { timestamps: true }
);

const ClientSchema = new mongoose.Schema(
  {
    tailor:    { type: mongoose.Schema.Types.ObjectId, ref: "Tailor", required: true, index: true },
    clientId:  { type: String, required: true },
    name:      { type: String, required: true, trim: true },
    phone:     { type: String, default: "" },
    email:     { type: String, default: "" },
    notes:     { type: String, default: "" },
    passwordResetToken:   { type: String },
    passwordResetExpires: { type: Date },
    measurements: [MeasurementSchema],
  },
  { timestamps: true }
);

ClientSchema.index({ tailor: 1, clientId: 1 }, { unique: true });
// TEXT INDEX FOR SEARCHING BY NAME
ClientSchema.index({ name: "text" });

module.exports = mongoose.model("Client", ClientSchema);