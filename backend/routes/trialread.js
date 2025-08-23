const express = require('express');
const router = express.Router();
const Trialread = require('../models/Trialread');

router.get('/files', async (req, res) => {
  try {
    const files = await Trialread.find();
    // console.log("Files fetched from DB:", files);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedFile = await Trialread.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: false } // runValidators off since schema is open
    );

    if (!updatedFile) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.json(updatedFile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
