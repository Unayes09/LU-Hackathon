const express = require("express");
const router = express.Router();
const authController = require("../controllers/authentication");

router.post('/reg',authController.registerUser)
router.post('/login',authController.loginUser)
router.get('/profile',authController.findUserByEmail)
router.get('/users',authController.getAllUsers)

module.exports = router;