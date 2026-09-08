const captainModel = require("../models/captain.model");
<<<<<<< HEAD
const { normalizeNigeriaPhone } = require("../utils/nigeria");
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

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
<<<<<<< HEAD
    phone: normalizeNigeriaPhone(phone),
=======
    phone,
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
    vehicle: {
      color,
      number,
      capacity,
      type,
    },
    location: {
      type: "Point",
<<<<<<< HEAD
      coordinates: [3.3792, 6.5244],
=======
      coordinates: [-79.3832, 43.6532],
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
    },
  });

  return captain;
};
