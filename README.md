# Application de Communication Sécurisée

Une application de messagerie sécurisée démontrant différentes approches de chiffrement et des modèles de communication sécurisée. Ce projet implémente des modèles de chiffrement pair-à-pair et assisté par serveur, ainsi qu'un système d'authentification robuste.

## 🔐 Fonctionnalités principales

### 1. Chiffrement Pair-à-Pair (De bout en bout)

- Échange de clés Diffie-Hellman direct entre les utilisateurs
- Chiffrement de bout en bout où même le serveur ne peut pas lire les messages
- Chiffrement AES-256 pour tout le contenu des messages
- Secret de transmission parfait grâce à des clés de session uniques

### 2. Chiffrement Assisté par Serveur (Modèle KDC)

- Le serveur agit comme un Centre de Distribution de Clés (KDC)
- Canal sécurisé Diffie-Hellman entre chaque utilisateur et le serveur
- Le serveur génère et distribue les clés de session
- Communication chiffrée avec gestion centralisée

### 3. Système d'Authentification

- Authentification basée sur JWT avec des cookies sécurisés HTTP-only
- Authentification à deux facteurs avec vérification par email (OTP)
- Gestion des sessions avec expiration personnalisable
- Suivi en temps réel du statut en ligne des utilisateurs

## 📋 Prérequis

- Node.js (v14+ recommandé)
- npm ou yarn
- Base de données MySQL ou MariaDB
- Compte Gmail pour l'envoi des emails OTP (ou un autre fournisseur d'email)

## 🚀 Démarrage

### Cloner le dépôt

```bash
git clone https://github.com/chakibo004/TP_PCA.git
```

### Configuration du Backend

1. Installer les dépendances :

```bash
cd backend
npm install
```

2. Créer un fichier `.env` dans le répertoire backend :

```
# Paramètres du serveur
PORT=4000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_here
FRONTEND_URL=http://localhost:4001

# Paramètres de la base de données
DB_HOST=localhost
DB_USER=your_db_username
DB_PASS=your_db_password
DB_NAME=secure_chat_db

# Paramètres email (pour OTP)
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_app_password
```

3. Démarrer le serveur backend :

```bash
npm start
```

### Configuration du Frontend

1. Installer les dépendances :

```bash
cd frontend
npm install
```

2. Créer un fichier `.env` dans le répertoire frontend :

```
VITE_API_URL=http://localhost:4000
```

3. Démarrer le serveur de développement frontend :

```bash
# Ou directement avec npm
npm run dev
```

L'application devrait maintenant fonctionner avec le backend sur le port 4000 et le frontend sur le port 4001.

## 🔒 Architecture de Sécurité

### Flux de Communication Pair-à-Pair

1. L'utilisateur A initie une poignée de main, générant les paramètres DH (p, g) et sa clé publique (Apub)
2. L'utilisateur B répond avec sa clé publique (Bpub)
3. Les deux utilisateurs dérivent indépendamment le même secret partagé
4. Le secret est utilisé pour générer des clés de chiffrement AES-256
5. Tous les messages sont chiffrés/déchiffrés localement sur chaque appareil

### Flux de Communication Assistée par Serveur

1. Chaque utilisateur établit un canal DH sécurisé avec le serveur
2. L'utilisateur A demande une session avec l'utilisateur B
3. Le serveur génère une clé de session aléatoire
4. Le serveur chiffre cette clé séparément pour les deux utilisateurs en utilisant leurs secrets DH respectifs
5. Les utilisateurs déchiffrent la clé de session et l'utilisent pour chiffrer les messages

### Flux d'Authentification

1. L'utilisateur s'inscrit avec un nom d'utilisateur, un email et un mot de passe
2. Le système envoie un code OTP à l'email de l'utilisateur
3. L'utilisateur vérifie son identité avec l'OTP
4. Lors des connexions suivantes, l'utilisateur fournit son nom d'utilisateur et son mot de passe
5. Après vérification, un JWT est émis dans un cookie HTTP-only
6. Toutes les requêtes API et connexions WebSocket utilisent ce token pour l'authentification

## 🧪 Tests

L'application inclut des fonctionnalités intégrées pour vérifier visuellement que le chiffrement fonctionne :

- Indicateurs de chiffrement des messages
- Affichage de l'état de connexion
- Notifications de fin de poignée de main
- Indicateurs en ligne/hors ligne des utilisateurs

## 📦 Structure du Projet

```
├── backend/
│   ├── config/          # Configuration de la base de données
│   ├── controllers/     # Logique métier
│   ├── middlewares/     # Middlewares d'authentification
│   ├── models/          # Modèles de données
│   └── routes/          # Points d'entrée API
│
└── frontend/
    ├── public/          # Fichiers statiques
    └── src/
        ├── components/  # Composants React
        ├── pages/       # Composants de pages
        ├── redux/       # Gestion d'état
        └── services/    # Services API
```

## 🛡️ Meilleures Pratiques de Sécurité Implémentées

- Pas de stockage de mots de passe en clair (hachage bcrypt)
- Protection contre les CSRF avec des cookies sécurisés
- Prévention des XSS via l'encodage du contenu
- Fonctions de dérivation de clés sécurisées
- Requêtes SQL paramétrées pour éviter les injections
- Limitation du taux sur les points d'entrée d'authentification
- Rotation automatique des clés de session
- Cookies HTTP-only pour le stockage des JWT

---

Créé avec ❤️ pour des communications sécurisées
