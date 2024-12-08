const express = require("express");
const router = express.Router();
const meetController = require("../controllers/meeting_crud");

router.post('/create',meetController.createMeeting)
router.get('/allmeet',meetController.getAllMeetings)
router.get('/single/:id',meetController.getMeetingById)
router.get('/user/:hostId',meetController.getMeetingsByHost)
router.delete('/del/:id',meetController.deleteMeeting)
router.get('/date/:date/user/:userId',meetController.getMeetingsForDates)
router.put('/status/:status/id/:meetingId',meetController.changeMeetingStatus)
router.get('/slot/:slotId',meetController.getMeetingsBySlotId)

module.exports = router;