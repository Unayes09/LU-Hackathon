const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");

router.post('/body/:slotId',aiController.generateJSONwithSlot)
router.post('/guest',aiController.generateJSONForGuest)

module.exports = router;