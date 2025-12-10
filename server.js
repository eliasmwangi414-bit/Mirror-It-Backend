const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ========== CORS ==========
const allowedOrigins = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'https://your-frontend-domain.com',
    'https://*.ngrok.io',
    'https://*.netlify.app',
    'https://*.vercel.app',
    'https://*.github.io'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin) || origin.includes(".ngrok.io")) {
            return callback(null, true);
        }

        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }

        return callback(new Error("CORS blocked"), false);
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));

app.options('*', cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ========== EMAIL CONFIG ==========
let transporter;

if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD // MUST BE GMAIL APP PASSWORD
        }
    });

    transporter.verify()
        .then(() => console.log("📧 Email service is READY"))
        .catch(err => console.error("❌ Email config error:", err));
} else {
    console.log("⚠️ Email disabled. No environment variables found.");
    transporter = {
        sendMail: async (mailOptions) => {
            console.log("\n📧 (DEBUG EMAIL MODE)");
            console.log(mailOptions);
            return { messageId: "debug-" + Date.now() };
        }
    };
}

// ========== PLACE ORDER ==========
app.post('/api/place-order', async (req, res) => {
    try {
        console.log("\n🛒 Incoming Order from:", req.headers.origin);

        const order = req.body;

        if (!order.customer || !order.customer.firstName || !order.customer.phone) {
            return res.status(400).json({ success: false, message: "Missing customer info" });
        }

        if (!order.items || order.items.length === 0) {
            return res.status(400).json({ success: false, message: "No items in order" });
        }

        const orderId = "MIRROR-" + Date.now();

        let subtotal = 0;
        order.items.forEach(item => {
            subtotal += (item.price || 0) * (item.quantity || 1);
        });

        const discount = subtotal * 0.2;
        const shipping = 500;
        const total = subtotal - discount + shipping;

        const completeOrder = {
            orderId,
            customer: {
                name: `${order.customer.firstName} ${order.customer.lastName || ""}`,
                phone: order.customer.phone,
                county: order.customer.county || "N/A",
                town: order.customer.town || "N/A",
                landmark: order.customer.landmark || "N/A",
            },
            items: order.items,
            subtotal: Math.round(subtotal),
            discount: Math.round(discount),
            shipping,
            total: Math.round(total),
            paymentMethod: order.paymentMethod || "Cash on Delivery",
            orderDate: new Date().toLocaleString("en-KE", {
                timeZone: "Africa/Nairobi"
            }),
        };

        // ========== SEND EMAIL ==========
        const emailHTML = `
            <h2>🪞 New Order - ${orderId}</h2>
            <p><strong>Name:</strong> ${completeOrder.customer.name}</p>
            <p><strong>Phone:</strong> ${completeOrder.customer.phone}</p>
            <p><strong>Address:</strong> ${completeOrder.customer.town}, ${completeOrder.customer.county}</p>
            <p><strong>Payment:</strong> ${completeOrder.paymentMethod}</p>

            <h3>Items:</h3>
            <ul>
                ${completeOrder.items.map(i => `<li>${i.name} x ${i.quantity} - KSh ${i.price}</li>`).join("")}
            </ul>

            <p><strong>Total:</strong> KSh ${completeOrder.total.toLocaleString()}</p>
        `;

        const mailOptions = {
            from: process.env.EMAIL_USER || "noreply@mirrorit.co.ke",
            to: process.env.COMPANY_EMAIL || "mwangiminion3@gmail.com",
            subject: `🪞 New Order #${orderId}`,
            html: emailHTML
        };

        await transporter.sendMail(mailOptions);
        console.log("📧 Email sent successfully!");

        return res.json({
            success: true,
            message: "Order placed successfully",
            orderId,
            total: completeOrder.total
        });

    } catch (err) {
        console.error("❌ Order error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: "Running",
        emailConfigured: Boolean(process.env.EMAIL_USER),
        time: new Date().toISOString(),
        origin: req.headers.origin || "Unknown"
    });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`\n🚀 Backend running on port ${PORT}`);
    console.log(`📧 Email: ${process.env.EMAIL_USER ? "Configured" : "NOT configured"}`);
    console.log(`🔗 POST orders to http://localhost:${PORT}/api/place-order`);
});

