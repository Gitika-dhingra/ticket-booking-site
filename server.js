const express = require("express");
const mongoose = require("mongoose");
const { createClient } = require("redis");

const app = express();
app.use(express.json());

/* ---------- MongoDB Atlas Connection ---------- */

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Atlas Connected"))
.catch(err => console.log("MongoDB Error:", err));

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

/* ---------- Redis Cloud Connection ---------- */

const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on("error", (err) => console.log("Redis Error:", err));

(async () => {
    try {
        await redisClient.connect();
        console.log("Redis Cloud Connected");
    } catch (err) {
        console.log("Redis Connection Error:", err);
    }
})();

/* ---------- Home Route (Fix for Cannot GET /) ---------- */

app.get("/", (req, res) => {
    res.send("Concurrent Ticket Booking System API is running");
});

/* ---------- Booking API ---------- */

app.post("/book", async (req, res) => {
    const { seatNumber, user } = req.body;

    if (!seatNumber || !user) {
        return res.status(400).json({
            message: "seatNumber and user are required"
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

        if (lock === null) {
            return res.status(400).json({
                message: "Seat already booked or locked"
            });
        }

        const booking = new Booking({ seatNumber, user });
        await booking.save();

        res.status(200).json({
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