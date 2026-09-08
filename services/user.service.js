const userModel = require("../models/user.model");
<<<<<<< HEAD
const { normalizeNigeriaPhone } = require("../utils/nigeria");
=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc

module.exports.createUser = async (firstname, lastname, email, password, phone) => {
  if (!firstname || !email || !password || !phone) {
    throw new Error("All fields are required");
  }

  const hashedPassword = await userModel.hashPassword(password);

<<<<<<< HEAD
  const referralBase = `${String(firstname).replace(/[^a-z0-9]/gi, "").slice(0, 5)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();

=======
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  const user = await userModel.create({
    fullname: {
      firstname,
      lastname,
    },
    email,
    password: hashedPassword,
<<<<<<< HEAD
    phone: normalizeNigeriaPhone(phone),
    referralCode: referralBase,
=======
    phone,
>>>>>>> addc804220915c5314abc19e357f9f2912d7afbc
  });

  return user;
};
