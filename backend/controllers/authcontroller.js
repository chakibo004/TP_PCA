// controllers/authController.js
const Users = require("../models/users");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");

const otpStore = {}; // { [sessionId]: { email, code, expiresAt, tries, remember } }
const users = {};
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "pcaptp@gmail.com",
    pass: "empp xwyr qgxo pqir ",
  },
});

const sendOtpEmail = async (email, code) => {
  await transporter.sendMail({
    from: '"Sécurité Auth" <no-reply@auth.com>',
    to: email,
    subject: "Code de vérification",
    text: `Votre code de vérification est : ${code}`,
  });
};

const register = async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: "Champs requis manquants" });
  }

  if (await Users.findOne({ where: { username } })) {
    return res.status(409).json({ message: "Nom d'utilisateur déjà utilisé" });
  }
  if (await Users.findOne({ where: { email } })) {
    return res.status(409).json({ message: "Email déjà utilisé" });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const sessionId = uuidv4();
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[sessionId] = {
    pendingUser: { username, email, password_hash },
    code,
    expiresAt: Date.now() + 5 * 60 * 1000,
    tries: 0,
    remember: false,
  };

  await sendOtpEmail(email, code);
  res.status(201).json({ sessionId });
};

const verifyRegisterOtp = async (req, res) => {
  const { sessionId, code } = req.body;
  const entry = otpStore[sessionId];
  if (!entry) {
    return res.status(400).json({ message: "Session invalide" });
  }

  if (Date.now() > entry.expiresAt) {
    delete otpStore[sessionId];
    return res.status(401).json({ message: "Code expiré" });
  }

  entry.tries++;
  if (entry.tries > 3) {
    delete otpStore[sessionId];
    return res.status(403).json({ message: "Trop de tentatives" });
  }

  if (entry.code !== code) {
    return res.status(401).json({ message: "Code invalide" });
  }

  const { username, email, password_hash } = entry.pendingUser;
  await Users.create({ username, email, password_hash });

  delete otpStore[sessionId];
  res.json({ message: "Inscription confirmée" });
};

const login = async (req, res) => {
  const { username, password, remember = false } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Champs requis manquants" });
  }

  const user = await Users.findOne({ where: { username } });
  if (!user) {
    return res.status(401).json({ message: "Utilisateur non trouvé" });
  }
  if (user.blacklisted) {
    return res
      .status(403)
      .json({ message: "Compte bloqué après trop de tentatives" });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ message: "Mot de passe incorrect" });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const sessionId = uuidv4();
  otpStore[sessionId] = {
    email: user.email,
    code,
    expiresAt: Date.now() + 5 * 60 * 1000,
    tries: 0,
    remember,
  };

  await sendOtpEmail(user.email, code);
  res.status(200).json({ sessionId });
};

const verifyOtp = async (req, res) => {
  const { sessionId, code } = req.body;
  const entry = otpStore[sessionId];
  // ... (existing validation: entry, expiresAt, tries) ...

  if (entry.code !== code) {
    return res.status(401).json({ message: "Code invalide" });
  }

  // Code is valid, find user
  const user = await Users.findOne({ where: { email: entry.email } });
  if (!user) {
    // Should not happen if login found the user, but good practice
    delete otpStore[sessionId];
    return res
      .status(404)
      .json({ message: "Utilisateur non trouvé après vérification OTP" });
  }

  delete otpStore[sessionId]; // Clean up OTP entry

  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: entry.remember ? "7d" : "1h" } // Use remember flag for expiration
  );

  const oneHour = 3600 * 1000;
  const oneWeek = 7 * 24 * oneHour;
  const expiresInMs = entry.remember ? oneWeek : oneHour;
  const tokenExpiration = Date.now() + expiresInMs;

  // **Important**: Update the shared 'users' object upon successful login verification
  // We don't store socketId here, it will be stored when the socket connects and authenticates
  if (!users[user.id]) {
    users[user.id] = {};
  }
  users[user.id].username = user.username; // Store username
  users[user.id].socketId = null; // Initialize socketId as null

  res
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: expiresInMs,
    })
    .status(200)
    .json({
      message: "✅ Authentification réussie !",
      userId: user.id,
      username: user.username,
      tokenExpiration,
    });
};

module.exports = {
  register,
  verifyRegisterOtp,
  login,
  verifyOtp,
  users, // **Export the users object**
};
