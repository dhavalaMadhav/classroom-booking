require("dotenv").config();
const cookie = require('cookie');
const cookieParser = require('cookie-parser');
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
    const express = require('express');
    const path = require('path');
    const connectDB = require('./db/connection');
      const auth = require("./middleware/auth");
      const jwt = require('jsonwebtoken');


const { Booking, User, Room, Block, Timetable, EventBooking } = require('./db/register');

    const app = express();
    const PORT = process.env.PORT || 3000;

    // Connect to MongoDB
    connectDB();
// const password = "123456";
// const pass =  bcrypt.hash(password, 10).then(pass=>{
//     console.log(pass)
// });
// console.log(pass)

    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(cookieParser());

    // Set EJS as template engine
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));

    // ============== ROUTES ==============

    // Home/Landing page
    app.get('/', (req, res) => {
        res.render('index');
    });

    // Login page
    app.get('/login', (req, res) => {
        res.render('login');
    });

// Login POST handler - WITH AUTHENTICATION
app.post('/login', async (req, res) => {
    try {
        const { userId, password } = req.body;
       
        console.log('🔐 Login attempt for user:', userId);

        // Validate input
        if (!userId || !password) {
            return res.status(400).send('User ID and Password are required');
        }

        // Find user in database
        const user = await User.findOne({ userId: userId.trim(), isActive: true });

        // Check if user exists
        if (!user) {
            console.log('❌ User not found:', userId);
            return res.status(401).send('Invalid User ID or Password');
        }

        // Compare password
        const ismatch = await bcrypt.compare(password, user.password);
        
        if (!ismatch) {
            console.log('❌ Invalid password');
            return res.status(401).send('Invalid User ID or Password');
        }

        // Generate token
        const token = await user.generateAuthToken();

        // Set cookie
        res.cookie("jwt", token, {
            expires: new Date(Date.now() + 60*60*1000), // 1 hour
            httpOnly: true,     
            secure: false // Set to true if using HTTPS
        });

        console.log('✅ Login successful:', user.name, '-', user.role);

        // Redirect based on role
        if (user.userId === "admin") {
            return res.redirect('/admin');
        } else {
            const roleRoute = user.role.toLowerCase();
            return res.redirect(`/${roleRoute}`);
        }

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).send('Login error: ' + error.message);
    }
});

// ============== LOGOUT ROUTE ==============
app.get('/logout', auth, async (req, res) => {
    try {
        // Clear the JWT cookie
        res.clearCookie("jwt", {
    httpOnly: true,
    secure: false, // or true if using HTTPS
    path: "/"
});
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token !== req.cookies.jwt; // Remove the current token
        });
        await req.user.save();
        res.redirect("/login");
    } catch (error) {
        console.error("Error during logout:", error);
    }
}); 
    // ============== TEACHER ROUTES ==============

    app.get('/teacher',auth, (req, res) => {
        res.render('teacher-dashboard');
    });

    app.get('/teacher/quick-booking',auth, (req, res) => {
        res.render('teacher-quick-booking');
    });

    app.get('/teacher/requests',auth, async (req, res) => {
        try {
            console.log('📥 Fetching bookings from database...');
            const bookings = await Booking.find().sort({ createdAt: -1 }).lean();
            console.log(`✅ Found ${bookings.length} bookings`);
            res.render('teacher-requests', { bookings });
        } catch (error) {
            console.error('❌ Error fetching bookings:', error);
            res.render('teacher-requests', { bookings: [] });
        }
    });

app.get('/teacher/rooms',auth, async (req, res) => {
    try {
        console.log('📥 Fetching rooms from database...');
        
        // Fetch all active rooms
        const rooms = await Room.find({ isActive: true })
            .sort({ block: 1, roomNo: 1 })
            .lean();
        
        // Get current bookings to check availability
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const todayBookings = await Booking.find({
            date: {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            },
            status: { $in: ['approved', 'pending'] }
        }).lean();
        
        // Add availability status to rooms
        const roomsWithStatus = rooms.map(room => {
            const isBooked = todayBookings.some(booking => 
                booking.roomNo === room.roomNo
            );
            return {
                ...room,
                status: isBooked ? 'Booked' : 'Available'
            };
        });
        
        // Group rooms by block
        const roomsByBlock = {
            Dharithri: roomsWithStatus.filter(r => r.block === 'Dharithri'),
            Main: roomsWithStatus.filter(r => r.block === 'Main'),
            Medha: roomsWithStatus.filter(r => r.block === 'Medha')
        };
        
        // If no rooms exist, create sample data
        if (rooms.length === 0) {
            console.log('⚠️ No rooms found. Creating sample data...');
            const sampleRooms = [
                // Dharithri Block
                { roomNo: 'D-101', block: 'Dharithri', capacity: 40, type: 'classroom', floor: 1 },
                { roomNo: 'D-102', block: 'Dharithri', capacity: 45, type: 'classroom', floor: 1 },
                { roomNo: 'D-Lab1', block: 'Dharithri', capacity: 30, type: 'lab', floor: 2 },
                { roomNo: 'D-203', block: 'Dharithri', capacity: 50, type: 'classroom', floor: 2 },
                
                // Main Block
                { roomNo: 'M-101', block: 'Main', capacity: 60, type: 'classroom', floor: 1 },
                { roomNo: 'M-102', block: 'Main', capacity: 55, type: 'classroom', floor: 1 },
                { roomNo: 'M-201', block: 'Main', capacity: 60, type: 'classroom', floor: 2 },
                { roomNo: 'M-Lab1', block: 'Main', capacity: 35, type: 'lab', floor: 2 },
                { roomNo: 'M-301', block: 'Main', capacity: 50, type: 'classroom', floor: 3 },
                { roomNo: 'M-Seminar', block: 'Main', capacity: 100, type: 'seminar-hall', floor: 1 },
                
                // Medha Block
                { roomNo: 'ME-101', block: 'Medha', capacity: 70, type: 'classroom', floor: 1 },
                { roomNo: 'ME-102', block: 'Medha', capacity: 65, type: 'classroom', floor: 1 },
                { roomNo: 'ME-Lab1', block: 'Medha', capacity: 40, type: 'lab', floor: 1 },
                { roomNo: 'ME-201', block: 'Medha', capacity: 60, type: 'classroom', floor: 2 },
                { roomNo: 'ME-202', block: 'Medha', capacity: 60, type: 'classroom', floor: 2 },
                { roomNo: 'ME-Lab2', block: 'Medha', capacity: 35, type: 'lab', floor: 2 },
                { roomNo: 'ME-301', block: 'Medha', capacity: 80, type: 'seminar-hall', floor: 3 },
                { roomNo: 'ME-Auditorium', block: 'Medha', capacity: 200, type: 'auditorium', floor: 1 }
            ];
            
            await Room.insertMany(sampleRooms);
            const newRooms = await Room.find({ isActive: true })
                .sort({ block: 1, roomNo: 1 })
                .lean();
            
            const newRoomsWithStatus = newRooms.map(room => ({
                ...room,
                status: 'Available'
            }));
            
            const newRoomsByBlock = {
                Dharithri: newRoomsWithStatus.filter(r => r.block === 'Dharithri'),
                Main: newRoomsWithStatus.filter(r => r.block === 'Main'),
                Medha: newRoomsWithStatus.filter(r => r.block === 'Medha')
            };
            
            console.log(`✅ Created ${newRooms.length} rooms`);
            return res.render('teacher-rooms', { roomsByBlock: newRoomsByBlock });
        }
        
        console.log(`✅ Found ${rooms.length} rooms`);
        res.render('teacher-rooms', { roomsByBlock });
    } catch (error) {
        console.error('❌ Error fetching rooms:', error);
        res.render('teacher-rooms', { 
            roomsByBlock: { Dharithri: [], Main: [], Medha: [] } 
        });
    }
});

app.post('/teacher/quick-booking',auth, async (req, res) => {
    try {
        const { facultyName, facultyId, block, roomNo, date, timeSlot, purpose } = req.body;

        console.log('📝 Creating new booking...');

        // Validate required fields including block
        if (!facultyName || !facultyId || !block || !roomNo || !date || !timeSlot || !purpose) {
            return res.status(400).send('All fields are required');
        }

        // Check for existing booking
        const existingBooking = await Booking.findOne({
            roomNo: roomNo.toUpperCase(),
            date: new Date(date),
            timeSlot,
            status: { $in: ['pending', 'approved'] }
        });

        if (existingBooking) {
            return res.status(400).send('This room is already booked for the selected date and time slot');
        }

        // Create new booking with block
        const newBooking = new Booking({
            facultyName,
            facultyId,
            block,
            roomNo: roomNo.toUpperCase(),
            date: new Date(date),
            timeSlot,
            purpose,
            status: 'pending'
        });

        await newBooking.save();
        console.log('✅ Booking created successfully');
        res.redirect('/teacher/requests');
    } catch (error) {
        console.error('❌ Error creating booking:', error);
        res.status(500).send('Error creating booking: ' + error.message);
    }
});

    app.post('/teacher/cancel-booking/:id',auth, async (req, res) => {
        try {
            const bookingId = req.params.id;
            const booking = await Booking.findById(bookingId);
            
            if (!booking) {
                return res.status(404).send('Booking not found');
            }

            if (booking.status === 'approved') {
                return res.status(400).send('Cannot cancel approved bookings');
            }

            booking.status = 'cancelled';
            await booking.save();
            console.log('✅ Booking cancelled');
            res.redirect('/teacher/requests');
        } catch (error) {
            console.error('❌ Error cancelling booking:', error);
            res.status(500).send('Error cancelling booking');
        }
    });

    // ============== ADMIN ROUTES ==============

    // Admin Dashboard
    app.get('/admin',auth, async (req, res) => {
        try {
            console.log('📊 Fetching admin statistics...');
            
            const totalRequests = await Booking.countDocuments();
            const approvedBookings = await Booking.countDocuments({ status: 'approved' });
            const pendingRequests = await Booking.countDocuments({ status: 'pending' });
            const rejectedRequests = await Booking.countDocuments({ status: 'rejected' });

            const stats = {
                totalRequests,
                approvedBookings,
                pendingRequests,
                rejectedRequests
            };

            console.log('✅ Statistics:', stats);
            res.render('admin-dashboard', { stats });
        } catch (error) {
            console.error('❌ Error fetching stats:', error);
            res.render('admin-dashboard', { 
                stats: {
                    totalRequests: 0,
                    approvedBookings: 0,
                    pendingRequests: 0,
                    rejectedRequests: 0
                }
            });
        }
    });

// Admin Pending Requests (Includes Teacher + Organiser Events)
app.get('/admin/pending', auth, async (req, res) => {
    try {
        console.log('📥 Fetching pending requests and events...');

        // Teacher bookings
        const pendingBookings = await Booking.find({ status: 'pending' })
            .sort({ createdAt: -1 })
            .lean();

        // Organiser event bookings
        const pendingEvents = await EventBooking.find({ status: 'pending' })
            .sort({ createdAt: -1 })
            .lean();

        console.log(`✅ Found ${pendingBookings.length} teacher requests, ${pendingEvents.length} event requests`);
        res.render('admin-pending', { bookings: pendingBookings, events: pendingEvents });
    } catch (error) {
        console.error('❌ Error fetching pending data:', error);
        res.render('admin-pending', { bookings: [], events: [] });
    }
});


    // Admin view organiser events
app.get('/admin/events', auth, async (req, res) => {
    try {
        const events = await EventBooking.find().sort({ createdAt: -1 }).lean();
        res.render('admin-events', { events });
    } catch (error) {
        console.error('❌ Error loading event requests:', error);
        res.render('admin-events', { events: [] });
    }
});


    // Approve Booking
    app.post('/admin/approve-booking/:id',auth, async (req, res) => {
        try {
            const booking = await Booking.findById(req.params.id);
            if (!booking) {
                return res.status(404).send('Booking not found');
            }

            booking.status = 'approved';
            booking.approvedBy = 'Admin';
            booking.approvalDate = new Date();
            await booking.save();

            console.log('✅ Booking approved');
            res.redirect('/admin/pending');
        } catch (error) {
            console.error('❌ Error approving booking:', error);
            res.status(500).send('Error approving booking');
        }
    });

    // Approve Event Request
app.post('/admin/approve-event/:id', auth, async (req, res) => {
    try {
        const event = await EventBooking.findById(req.params.id);
        if (!event) return res.status(404).send('Event not found');
        event.status = 'approved';
        event.approvedBy = req.user.name || 'Admin';
        event.approvalDate = new Date();
        await event.save();
        console.log('✅ Event approved');
        res.redirect('/admin/pending');
    } catch (error) {
        console.error('❌ Error approving event:', error);
        res.status(500).send('Error approving event');
    }
});

// Reject Event Request
app.post('/admin/reject-event/:id', auth, async (req, res) => {
    try {
        const event = await EventBooking.findById(req.params.id);
        if (!event) return res.status(404).send('Event not found');
        event.status = 'rejected';
        event.rejectionReason = req.body.reason || 'No reason specified';
        await event.save();
        console.log('❌ Event rejected');
        res.redirect('/admin/pending');
    } catch (error) {
        console.error('❌ Error rejecting event:', error);
        res.status(500).send('Error rejecting event');
    }
});


    // Reject Booking
    app.post('/admin/reject-booking/:id',auth, async (req, res) => {
        try {
            const { reason } = req.body;
            const booking = await Booking.findById(req.params.id);
            
            if (!booking) {
                return res.status(404).send('Booking not found');
            }

            booking.status = 'rejected';
            booking.rejectionReason = reason || 'No reason provided';
            await booking.save();

            console.log('✅ Booking rejected');
            res.redirect('/admin/pending');
        } catch (error) {
            console.error('❌ Error rejecting booking:', error);
            res.status(500).send('Error rejecting booking');
        }
    });

    // Approved Requests
    app.get('/admin/approved',auth, async (req, res) => {
        try {
            const approvedBookings = await Booking.find({ status: 'approved' })
                .sort({ approvalDate: -1 })
                .lean();
            
            console.log(`✅ Found ${approvedBookings.length} approved bookings`);
            res.render('admin-approved', { bookings: approvedBookings });
        } catch (error) {
            console.error('❌ Error fetching approved bookings:', error);
            res.render('admin-approved', { bookings: [] });
        }
    });

    // Rejected Requests
    app.get('/admin/rejected',auth, async (req, res) => {
        try {
            const rejectedBookings = await Booking.find({ status: 'rejected' })
                .sort({ updatedAt: -1 })
                .lean();
            
            console.log(`✅ Found ${rejectedBookings.length} rejected bookings`);
            res.render('admin-rejected', { bookings: rejectedBookings });
        } catch (error) {
            console.error('❌ Error fetching rejected bookings:', error);
            res.render('admin-rejected', { bookings: [] });
        }
    });

    // Manage Users
    app.get('/admin/users',auth, async (req, res) => {
        try {
            const users = await User.find().sort({ createdAt: -1 }).lean();
            console.log(`✅ Found ${users.length} users`);
            res.render('admin-users', { users });
        } catch (error) {
            console.error('❌ Error fetching users:', error);
            res.render('admin-users', { users: [] });
        }
    });

    // Create User
    app.post('/admin/create-user',auth, async (req, res) => {
        try {
            const { name, role, userId, password } = req.body;

            if (!name || !role || !userId || !password) {
                return res.status(400).send('All fields are required');
            }

            const existingUser = await User.findOne({ userId });
            if (existingUser) {
                return res.status(400).send('User ID already exists');
            }

            const newUser = new User({ name, role, userId, password });
            await newUser.save();
            
            console.log('✅ User created');
            res.redirect('/admin/users');
        } catch (error) {
            console.error('❌ Error creating user:', error);
            res.status(500).send('Error creating user: ' + error.message);
        }
    });

    // Delete User
    app.post('/admin/delete-user/:id',auth, async (req, res) => {
        try {
            await User.findByIdAndDelete(req.params.id);
            console.log('✅ User deleted');
            res.redirect('/admin/users');
        } catch (error) {
            console.error('❌ Error deleting user:', error);
            res.status(500).send('Error deleting user');
        }
    });

    // ============== STUDENT ROUTES ==============

    // Student Dashboard (Overview/Notifications)
    app.get('/student',auth, async (req, res) => {
        try {
            // For now, showing static notifications
            // TODO: Fetch from notifications collection when implemented
            const notifications = [
                { message: 'Lab A-105 reserved today for project demo.' },
                { message: 'Seminar Hall unavailable this afternoon.' }
            ];
            
            res.render('student-dashboard', { notifications });
        } catch (error) {
            console.error('❌ Error loading student dashboard:', error);
            res.render('student-dashboard', { notifications: [] });
        }
    });

    // Student Timetable
    app.get('/student/timetable',auth, async (req, res) => {
        try {
            console.log('📅 Fetching timetable from database...');
            
            // Get current day of week
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const today = days[new Date().getDay()];
            
            // Fetch timetable for today
            const timetable = await Timetable.find({ 
                dayOfWeek: today,
                isActive: true 
            }).sort({ timeSlot: 1 }).lean();
            
            // If no timetable found, create sample data
            if (timetable.length === 0) {
                console.log('⚠️ No timetable found. Creating sample data...');
                const sampleTimetable = [
                    {
                        timeSlot: '08:00-09:00',
                        subject: 'Maths-II',
                        roomNo: 'A-101',
                        faculty: 'Dr. Rao',
                        dayOfWeek: today
                    },
                    {
                        timeSlot: '09:00-10:00',
                        subject: 'Physics',
                        roomNo: 'A-104',
                        faculty: 'Prof. Iyer',
                        dayOfWeek: today
                    },
                    {
                        timeSlot: '10:00-11:00',
                        subject: 'C Programming',
                        roomNo: 'Lab-1',
                        faculty: 'Ms. Jain',
                        dayOfWeek: today
                    }
                ];
                
                await Timetable.insertMany(sampleTimetable);
                const newTimetable = await Timetable.find({ 
                    dayOfWeek: today,
                    isActive: true 
                }).sort({ timeSlot: 1 }).lean();
                
                console.log(`✅ Created ${newTimetable.length} timetable entries`);
                return res.render('student-timetable', { timetable: newTimetable, today });
            }
            
            console.log(`✅ Found ${timetable.length} classes for ${today}`);
            res.render('student-timetable', { timetable, today });
        } catch (error) {
            console.error('❌ Error fetching timetable:', error);
            res.render('student-timetable', { timetable: [], today: 'Today' });
        }
    });

    // Student View Rooms
    app.get('/student/rooms',auth, async (req, res) => {
        try {
            console.log('📥 Fetching rooms from database...');
            
            // Fetch all rooms with availability status
            const rooms = await Room.find({ isActive: true })
                .sort({ block: 1, roomNo: 1 })
                .lean();
            
            // Get current bookings to check availability
            const now = new Date();
            const currentBookings = await Booking.find({
                date: {
                    $gte: new Date(now.setHours(0, 0, 0, 0)),
                    $lt: new Date(now.setHours(23, 59, 59, 999))
                },
                status: { $in: ['approved', 'pending'] }
            }).lean();
            
            // Mark rooms as available or booked
            const roomsWithStatus = rooms.map(room => {
                const isBooked = currentBookings.some(booking => 
                    booking.roomNo === room.roomNo
                );
                return {
                    ...room,
                    status: isBooked ? 'Booked' : 'Available'
                };
            });
            
            // If no rooms, create sample data
            if (rooms.length === 0) {
                console.log('⚠️ No rooms found. Creating sample data...');
                const sampleRooms = [
                    { roomNo: 'A-101', block: 'Main', capacity: 60, type: 'classroom' },
                    { roomNo: 'A-104', block: 'Main', capacity: 50, type: 'classroom' },
                    { roomNo: 'Lab-1', block: 'Dharithri', capacity: 30, type: 'lab' },
                    { roomNo: 'B-207', block: 'Medha', capacity: 80, type: 'seminar-hall' }
                ];
                
                await Room.insertMany(sampleRooms);
                const newRooms = await Room.find({ isActive: true }).lean();
                
                const newRoomsWithStatus = newRooms.map(room => ({
                    ...room,
                    status: 'Available'
                }));
                
                console.log(`✅ Created ${newRooms.length} rooms`);
                return res.render('student-rooms', { rooms: newRoomsWithStatus });
            }
            
            console.log(`✅ Found ${rooms.length} rooms`);
            res.render('student-rooms', { rooms: roomsWithStatus });
        } catch (error) {
            console.error('❌ Error fetching rooms:', error);
            res.render('student-rooms', { rooms: [] });
        }
    });

    // Student Notifications
    app.get('/student/notifications',auth, async (req, res) => {
        try {
            // TODO: Implement proper notifications system
            const notifications = [
                { message: 'Lab A-105 reserved today for project demo.' },
                { message: 'Seminar Hall unavailable this afternoon.' }
            ];
            
            res.render('student-notifications', { notifications });
        } catch (error) {
            console.error('❌ Error loading notifications:', error);
            res.render('student-notifications', { notifications: [] });
        }
    });

// ============== ORGANISER ROUTES ==============
app.post('/organiser/book-hall', auth, async (req, res) => {
  try {
    const {
      eventName,
      hallNo,
      eventDate,
      startTime,
      endTime,
      expectedAttendees,
      eventType,
      description
    } = req.body;

    if (!eventName || !hallNo || !eventDate || !startTime || !endTime || !eventType) {
      return res.status(400).send('All required fields must be filled');
    }

    // Optional: check if hall is already booked for that date/time here

    const newBooking = new EventBooking({
      eventName,
      organiserName: req.user.name,
      organiserId: req.user.userId,
      hallNo,
      eventDate: new Date(eventDate),
      startTime,
      endTime,
      expectedAttendees,
      eventType,
      description,
      status: 'pending'  // default status
    });

    await newBooking.save();
    res.redirect('/organiser/events'); // redirect after successful booking

  } catch (error) {
    console.error('Error booking hall:', error);
    res.status(500).send('Internal Server Error');
  }
});


// Organiser Dashboard (Overview)
app.get('/organiser',auth, async (req, res) => {
    try {
        const totalEvents = await EventBooking.countDocuments();
        const pendingEvents = await EventBooking.countDocuments({ status: 'pending' });
        const approvedEvents = await EventBooking.countDocuments({ status: 'approved' });
        const upcomingEvents = await EventBooking.countDocuments({
            status: 'approved',
            eventDate: { $gte: new Date() }
        });

        const stats = {
            totalEvents,
            pendingEvents,
            approvedEvents,
            upcomingEvents
        };

        res.render('organiser-dashboard', { stats });
    } catch (error) {
        console.error('❌ Error fetching organiser stats:', error);
        res.render('organiser-dashboard', {
            stats: { totalEvents: 0, pendingEvents: 0, approvedEvents: 0, upcomingEvents: 0 }
        });
    }
});

app.get('/organiser/halls', auth, async (req, res) => {
  try {
    const halls = await Room.find({ isActive: true, type: { $in: ['auditorium', 'seminar-hall'] } }).lean();

    // Fetch all approved events for any date
    const approvedEvents = await EventBooking.find({ status: 'approved' }).lean();

    const hallsWithStatus = halls.map(hall => {
      const hasApprovedBooking = approvedEvents.some(event => event.hallNo === hall.roomNo);
      const status = hasApprovedBooking ? 'Occupied' : 'Free';
      const isApproved = hasApprovedBooking;

      console.log(`Hall ${hall.roomNo}: status=${status}, isApproved=${isApproved}`);

      return {
        ...hall,
        status,
        isApproved
      };
    });

    res.render('organiser-halls', { halls: hallsWithStatus });
  } catch (error) {
    console.error('Error fetching halls:', error);
    if (!res.headersSent) {
      res.render('organiser-halls', { halls: [] });
    }
  }
});



// Event Requests
app.get('/organiser/events', auth, async (req, res) => {
    try {
        // Fetch approved events only
        const events = await EventBooking.find({ status: 'approved' })
            .sort({ eventDate: 1 })
            .lean();

        res.render('organiser-events', { events });
    } catch (error) {
        console.error('❌ Error fetching approved events:', error);
        res.render('organiser-events', { events: [] });
    }
});


// Settings
app.get('/organiser/settings',auth, (req, res) => {
    res.render('organiser-settings');
});

    // 404 handler
    app.use((req, res) => {
        res.status(404).send('Page not found');
    });

    // Error handler
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).send('Something went wrong!');
    });


    // Start server
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
