const express = require("express");
const router = express.Router();
const authController = require("../controllers/authentication");
const histController = require("../controllers/history")

router.post('/reg',authController.registerUser)
router.post('/login',authController.loginUser)
router.get('/profile',authController.findUserByEmail)
router.get('/users',authController.getAllUsers)
router.get('/history',histController.getAllHistory)
router.put('/nid',authController.updateNotificationId)
router.get('/user/:id',authController.findUserByUserId)
router.get('/nt/:userId',histController.getUserNotifications)

module.exports = router;