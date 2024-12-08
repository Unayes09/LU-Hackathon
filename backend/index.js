const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
dotenv.config({ path: "./.env" });

app.listen(8000, () => {
  console.log("Server is running on port 8000");
});

process.on("SIGINT", async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  

app.use("/auth", require("./routes/auth"));
app.use("/slot",require("./routes/slot"));
app.use('/meet',require('./routes/meeting'));