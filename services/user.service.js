const userModel = require("../models/user.model");
const { normalizeNigeriaPhone } = require("../utils/nigeria");

module.exports.createUser = async (firstname, lastname, email, password, phone) => {
  if (!firstname || !email || !password || !phone) {
    throw new Error("All fields are required");
  }

  const hashedPassword = await userModel.hashPassword(password);

  const referralBase = `${String(firstname).replace(/[^a-z0-9]/gi, "").slice(0, 5)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();

  const user = await userModel.create({
    fullname: {
      firstname,
      lastname,
    },
    email,
    password: hashedPassword,
    phone: normalizeNigeriaPhone(phone),
    referralCode: referralBase,
  });

  return user;
};
