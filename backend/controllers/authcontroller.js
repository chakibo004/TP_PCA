const Users = require("../models/users");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

const otpStore = {};

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

  if (!username || !email || !password)
    return res.status(400).json({ message: "Champs requis manquants" });

  try {
    const usernameTaken = await Users.findOne({ where: { username } });
    if (usernameTaken)
      return res
        .status(409)
        .json({ message: "Nom d'utilisateur déjà utilisé" });

    const emailTaken = await Users.findOne({ where: { email } });
    if (emailTaken)
      return res.status(409).json({ message: "Email déjà utilisé" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await Users.create({
      username,
      email,
      password_hash: hashedPassword,
    }); 

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore[email] = { code: otp, expiresAt };

    await sendOtpEmail(email, otp);

    res.status(201).json({ message: "Code de vérification envoyé par email" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await Users.findOne({ where: { username } });
    if (!user)
      return res.status(401).json({ message: "Utilisateur non trouvé" });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword)
      return res.status(401).json({ message: "Mot de passe incorrect" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore[user.email] = { code: otp, expiresAt };

    await sendOtpEmail(user.email, otp);

    res.status(200).json({ message: "Code de vérification envoyé par email" });
  } catch (err) {
    console.error("Erreur pendant la connexion :", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

const verifyOtp = (req, res) => {
  const { email, code } = req.body;
  const entry = otpStore[email];

  if (!entry) return res.status(400).json({ message: "Aucun code actif" });

  if (Date.now() > entry.expiresAt) {
    delete otpStore[email];
    return res.status(401).json({ message: "Code expiré" });
  }

  entry.tries = (entry.tries || 0) + 1;

  if (entry.tries > 3) {
    delete otpStore[email];
    return res.status(403).json({ message: "Trop de tentatives. Veuillez vous reconnecter." });
  }

  if (code !== entry.code) {
    return res.status(401).json({ message: "Code invalide" });
  }

  delete otpStore[email];
  return res.json({ message: "✅ Code vérifié. Authentification réussie !" });
};

module.exports = { register, login, verifyOtp };
