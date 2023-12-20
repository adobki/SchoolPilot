/* eslint-disable func-names */
/* eslint-disable import/no-extraneous-dependencies */
// models/user.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, {
  timestamps: true,
});

// static method to save a user to the database
userSchema.statics.createUser = async function (userData) {
  // check if the user already exists
  const existingUser = await this.findOne({ email: userData.email });
  if (existingUser) {
    throw new Error('User already exists');
  }
  const newUser = new this(userData);
  await newUser.save();
  return newUser;
};

userSchema.statics.loginUser = async function (userData) {
  const user = await this.findOne({ email: userData.email });
  if (!user) {
    throw new Error('User not found');
  }
  // compare the hash password
  const isPasswordValid = await bcrypt.compare(userData.password, user.password);
  if (!isPasswordValid) {
    throw new Error('Incorrect password');
  }
  return user;
};

// Compile model from schema
const User = mongoose.model('User', userSchema);
module.exports = User;
