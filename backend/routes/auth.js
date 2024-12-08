const express = require("express");
const router = express.Router();
const authController = require("../controllers/authentication");

router.post('/reg',authController.registerUser)
router.post('/login',authController.loginUser)

module.exports = router;