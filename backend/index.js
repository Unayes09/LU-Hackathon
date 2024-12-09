const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const {Server} = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
dotenv.config({ path: "./.env" });

const server = app.listen(8000, () => {
    console.log("Server is running on port 8000");
});

process.on("SIGINT", async () => {
    await prisma.$disconnect();
    process.exit(0);
});

app.use("/auth", require("./routes/auth"));
app.use("/slot",require("./routes/slot"));
app.use('/meet',require('./routes/meeting'));
app.use('/ai',require('./routes/ai'));
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("join_room", (data) => {
    socket.join(data);
    console.log(`User with ID: ${socket.id} joined room: ${data.messid}`);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected", socket.id);
  });

  socket.on("message", (data) => {
    console.log(data);
    //socket.broadcast.emit("message-recieve", data);
    socket.broadcast.emit("message-recieve", data);
});
});