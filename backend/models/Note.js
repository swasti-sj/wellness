const mongoose = require("mongoose");
const { encryptField, decryptField } = require("../utils/fieldEncryption");

const NoteSchema = new mongoose.Schema({
  appointment: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Appointment", 
    required: true 
  },
  text: { 
    type: String, 
    required: true 
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    caption: {
      type: String,
      default: ''
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

// Encrypt the clinical note text before it's written to MongoDB — anyone
// with direct database access (but not the FIELD_ENCRYPTION_KEY) sees
// only ciphertext, not the note itself.
NoteSchema.pre("save", function (next) {
  if (this.isModified("text")) {
    this.text = encryptField(this.text);
  }
  next();
});

// Decrypt it back for legitimate app requests. Runs after any find/findOne
// so every route automatically gets readable text without needing its own
// decrypt logic. Plain-text notes saved before this existed are returned
// unchanged (decryptField only acts on values tagged "enc:").
function decryptNoteDoc(doc) {
  if (doc && typeof doc.text !== "undefined") {
    doc.text = decryptField(doc.text);
  }
}

NoteSchema.post(["find"], function (docs) {
  (docs || []).forEach(decryptNoteDoc);
});

NoteSchema.post(["findOne", "findOneAndUpdate"], function (doc) {
  decryptNoteDoc(doc);
});

// Also decrypt immediately after note.save() — pre('save') scrambles
// `text` on that same in-memory document, and routes that respond with
// the just-saved object (instead of re-fetching it) would otherwise send
// the encrypted version straight back to the frontend.
NoteSchema.post("save", function (doc) {
  decryptNoteDoc(doc);
});

module.exports = mongoose.model("Note", NoteSchema);
