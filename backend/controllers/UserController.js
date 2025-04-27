// controllers/userController.js
const Users = require("../models/users");

const listUsers = async (req, res) => {
  try {
    // récupère tous les users (id + username)
    const all = await Users.findAll({
      attributes: ["id", "username"],
    });
    // on enlève l'utilisateur courant côté serveur
    const filtered = all
      .map(u => u.toJSON())
      .filter(u => u.id !== req.user.userId);

    res.json(filtered);
    console.log("Liste des utilisateurs envoyée:", filtered);
  } catch (err) {
    console.error("Erreur listUsers:", err);
    
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = { listUsers };
