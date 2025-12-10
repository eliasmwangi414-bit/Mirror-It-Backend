const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ========== CORS FOR PRODUCTION ==========
const allowedOrigins = [
    'http://localhost:5500',      // Local development
    'http://127.0.0.1:5500',      // Local development
    'http://localhost:3000',      // React/Vue dev server
    'https://your-frontend-domain.com', // ← YOUR PRODUCTION FRONTEND
    'https://*.ngrok.io',         // All ngrok subdomains
    'https://*.netlify.app',      // Netlify
    'https://*.vercel.app',       // Vercel
    'https://*.github.io',        // GitHub Pages
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            // Check if it's an ngrok URL
            if (origin.includes('.ngrok.io')) {
                return callback(null, true);
            }
            
            // For production, you might want to be stricter
            if (process.env.NODE_ENV === 'production') {
                const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
                return callback(new Error(msg), false);
            } else {
                // In development, allow all
                return callback(null, true);
            }
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Handle preflight requests
app.options('*', cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ========== EMAIL CONFIG ==========
let transporter;
if (process.env.NODE_ENV === 'production') {
    // Production email config
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
    console.log('📧 Production email service configured');
} else {
    // Development email config
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
        console.log('📧 Development email service configured');
    } else {
        console.log('⚠️  No email credentials found. Using console mode.');
        transporter = {
            sendMail: async function(mailOptions) {
                console.log('\n📧 DEBUG EMAIL:');
                console.log('To:', mailOptions.to);
                console.log('Subject:', mailOptions.subject);
                console.log('Body:', mailOptions.text?.substring(0, 200) + '...');
                return { messageId: 'debug-' + Date.now() };
            }
        };
    }
}

// ========== ORDER ENDPOINT ==========
app.post('/api/place-order', async (req, res) => {
    try {
        console.log('\n🛒 NEW ORDER from:', req.headers.origin || 'Unknown origin');
        
        const order = req.body;
        
        // Validation
        if (!order.customer || !order.customer.firstName || !order.customer.phone) {
            return res.status(400).json({
                success: false,
                message: 'Missing required customer information'
            });
        }

        if (!order.items || order.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No items in order'
            });
        }

        // Generate order ID
        const orderId = 'MIRROR-' + Date.now();
        
        // Calculate totals
        let subtotal = 0;
        order.items.forEach(item => {
            subtotal += (item.price || 0) * (item.quantity || 1);
        });
        
        const discount = subtotal * 0.20;
        const shipping = 500;
        const total = (subtotal - discount) + shipping;

        // Create order object
        const completeOrder = {
            orderId: orderId,
            customer: {
                name: `${order.customer.firstName} ${order.customer.lastName || ''}`.trim(),
                phone: order.customer.phone,
                county: order.customer.county || 'Not specified',
                town: order.customer.town || 'Not specified',
                landmark: order.customer.landmark || 'Not specified',
                address: `${order.customer.town || ''}, ${order.customer.county || ''}`
            },
            items: order.items,
            subtotal: Math.round(subtotal),
            discount: Math.round(discount),
            shipping: shipping,
            total: Math.round(total),
            paymentMethod: order.paymentMethod || 'Cash on Delivery',
            orderDate: new Date().toLocaleString('en-KE', {
                timeZone: 'Africa/Nairobi'
            }),
            source: req.headers.origin || 'Direct'
        };

        console.log('📦 Order details:', {
            id: orderId,
            customer: completeOrder.customer.name,
            total: total,
            items: order.items.length
        });

        // Send email
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER || '"MirrorIt Store" <noreply@mirrorit.co.ke>',
                to: process.env.COMPANY_EMAIL || 'mwangiminion3@gmail.com',
                subject: `🪞 New Order #${orderId} - ${completeOrder.customer.name}`,
                html: `<h2>New Order #${orderId}</h2>
                       <p><strong>Customer:</strong> ${completeOrder.customer.name}</p>
                       <p><strong>Phone:</strong> ${completeOrder.customer.phone}</p>
                       <p><strong>Total:</strong> KSh ${total.toLocaleString()}</p>`,
                text: `New Order #${orderId}\nCustomer: ${completeOrder.customer.name}\nPhone: ${completeOrder.customer.phone}\nTotal: KSh ${total}`
            };

            await transporter.sendMail(mailOptions);
            console.log('📧 Email sent successfully');
        } catch (emailError) {
            console.error('Email error:', emailError.message);
            // Don't fail the order if email fails
        }

        // Return success response
        res.json({
            success: true,
            message: 'Order placed successfully!',
            orderId: orderId,
            orderTotal: total,
            emailSent: true
        });

    } catch (error) {
        console.error('❌ Order processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process order',
            error: error.message
        });
    }
});

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        service: 'MirrorIt Store Backend',
        status: 'Running',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        origin: req.headers.origin || 'Not specified'
    });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`\n🚀 MirrorIt Backend ${process.env.NODE_ENV || 'development'} server running`);
    console.log(`🔗 Port: ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📧 Email: ${process.env.EMAIL_USER ? 'Configured' : 'Not configured'}`);
    console.log(`\n✅ Ready to accept orders at: http://localhost:${PORT}/api/place-order`);
});