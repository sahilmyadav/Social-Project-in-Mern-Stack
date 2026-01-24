import mongoose from "mongoose";
const DB_NAME = process.env.DB_NAME || "ProjectDB";

const connectDB = async () => {
  try {
    const connectionInstence = await mongoose.connect(process.env.MONGO_URL, {
      dbName: process.env.DB_NAME
    });

    console.log(`\n MongoDB Connected !! DB HOST : ${connectionInstence.connection.host}`);
  } catch (error) {
    console.log('Mongodb connection Failed ', error);
    process.exit(1)
  }
}


export default connectDB