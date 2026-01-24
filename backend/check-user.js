import { User } from './src/models/user.model.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const emailToCheck = process.argv[2];

if (!emailToCheck) {
    console.log('Please provide an email to check');
    process.exit(1);
}

const checkUser = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(`Checking for user: ${emailToCheck}`);

        const user = await User.findOne({ email: emailToCheck });

        if (user) {
            console.log('❌ User FOUND in database:');
            console.log(`- ID: ${user._id}`);
            console.log(`- Email: ${user.email}`);
            console.log(`- Username: ${user.username}`);
            console.log(`- Profile Completed: ${user.profileCompleted}`);
            console.log('\nThis user will cause "User already exists" error in the new flow.');
        } else {
            console.log('✅ User NOT found in database.');
            console.log('You can use this email for the new registration flow.');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

checkUser();
