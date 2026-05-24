const settingsService = require('../services/settingsService');

const getSettings = async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const settings = await settingsService.updateSettings(req.body);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /settings/preview/:type - preview next number without incrementing
const getNextNumberPreview = async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['customer', 'vendor', 'po', 'quote', 'salesOrder', 'invoice'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }
    const preview = await settingsService.previewNextNumber(type);
    res.json({ preview });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getSettings, updateSettings, getNextNumberPreview };
