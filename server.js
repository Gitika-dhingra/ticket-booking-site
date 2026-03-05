const express = require("express");
const mongoose = require("mongoose");
const { createClient } = require("redis");

const app = express();
app.use(express.json());

/* ---------- MongoDB Connection ---------- */

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("MongoDB Connected"))
.catch((err) => console.log("MongoDB Error:", err));

/* ---------- Booking Schema ---------- */

const bookingSchema = new mongoose.Schema({
    seatNumber: {
        type: Number,
        required: true
    },
    user: {
        type: String,
        required: true
    },
    bookedAt: {
        type: Date,
        default: Date.now
    }
});

const Booking = mongoose.model("Booking", bookingSchema);

/* ---------- Redis Connection ---------- */

const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on("error", (err) => console.log("Redis Error:", err));

async function connectRedis() {
    await redisClient.connect();
    console.log("Redis Connected");
}

connectRedis();

/* ---------- Test Route ---------- */

app.get("/", (req, res) => {
    res.send("Ticket Booking System Running");
});

/* ---------- Booking API ---------- */

app.post("/book", async (req, res) => {

    const { seatNumber, user } = req.body;

    if (!seatNumber || !user) {
        return res.status(400).json({
            message: "seatNumber and user required"
        });
    }

    try {

        const lock = await redisClient.set(
            `seat:${seatNumber}`,
            user,
            {
                NX: true,
                EX: 30
            }
        );

        if (!lock) {
            return res.status(400).json({
                message: "Seat already booked"
            });
        }

        const booking = new Booking({
            seatNumber,
            user
        });

        await booking.save();

        res.json({
            message: "Seat booked successfully",
            booking
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

/* ---------- Server ---------- */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});