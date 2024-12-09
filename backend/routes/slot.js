const express = require("express");
const router = express.Router();
const slotController = require("../controllers/slot_crud");

router.post('/create',slotController.createSlot)
router.get('/allslot',slotController.getAllSlots)
router.get('/single/:id',slotController.getSlotById)
router.get('/user/:id',slotController.getSlotsByUser)
router.put('/update',slotController.updateSlot)
router.get('/date/:date/user/:userId',slotController.getSlotsForDates)
router.put('/delete',slotController.deleteSlot)

module.exports = router;