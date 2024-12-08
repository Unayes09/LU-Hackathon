const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.jwt_secret_key; // Replace with a secure secret key
const prisma = require("../db")

// Register User
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, timezone, profession } = req.body;

    // Check if the email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        timezone,
        profession,
      },
    });

    res.status(201).json({ message: "User registered successfully.", user: newUser });
  } catch (error) {
    res.status(500).json({ message: "Error registering user.", error: error.message });
  }
};

// Login User
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email,password)

    // Check if the user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Compare the password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password." });
    }

    // Generate a JWT token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "48h",
    });

    res.status(200).json({ message: "Login successful.", token });
  } catch (error) {
    res.status(500).json({ message: "Error logging in.", error: error.message });
  }
};
