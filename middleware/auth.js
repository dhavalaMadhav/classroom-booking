const jwt = require('jsonwebtoken');
const User = require('../db/register').User;

const auth = async (req, res, next) => {
    try {
        // Get token from cookie
        const token = req.cookies.jwt;
        
        if (!token) {
            console.log('⚠️ No token found in cookies');
            return res.status(401).send('Unauthorized: No token provided');
        }

        // Verify token
        const verifyUser = jwt.verify(token, process.env.SECRET_KEY);
        
        // Find user
        const user = await User.findOne({ 
            _id: verifyUser._id,
            'tokens.token': token 
        });

        if (!user) {
            console.log('⚠️ User not found or token invalid');
            return res.status(401).send('Unauthorized: Invalid token');
        }

        // Attach user to request
        req.token = token;
        req.user = user;
        
        console.log('✅ Auth successful for:', user.name);
        next();

    } catch (error) {
        console.error('❌ Auth error:', error.message);
        return res.status(401).send('Unauthorized: ' + error.message);
    }
};

module.exports = auth;
