
const mongoose = require('mongoose');

const TrialreadSchema = new mongoose.Schema({},{ strict: false });

module.exports = mongoose.model('Trialread', TrialreadSchema,'trialread');
