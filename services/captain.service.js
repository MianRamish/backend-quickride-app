const captainModel = require("../models/captain.model");
const { normalizeNigeriaPhone } = require("../utils/nigeria");

module.exports.createCaptain = async (
  firstname,
  lastname,
  email,
  password,
  phone,
  color,
  number,
  capacity,
  type
) => {
  if (!firstname || !email || !password) {
    throw new Error("All fields are required");
  }

  const hashedPassword = await captainModel.hashPassword(password);

  const captain = await captainModel.create({
    fullname: {
      firstname,
      lastname,
    },
    email,
    password: hashedPassword,
    phone: normalizeNigeriaPhone(phone),
    vehicle: {
      color,
      number,
      capacity,
      type,
    },
    location: {
      type: "Point",
      coordinates: [3.3792, 6.5244],
    },
  });

  return captain;
};
