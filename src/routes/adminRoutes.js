const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
const { hashPassword } = require('../helper/auth.helper');
const {
  isAuthenticated,
  getAuthUrl,
  authenticate,
} = require('../helper/authGoogle');
const asyncHandler = require('../helper/asyncHandler').default;

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Non autorisé' });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
      },
    });
    res.json(users);
  }),
);

router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Non autorisé' });
    }

    const { id } = req.params;
    // get user
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
    });
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    // check if it is not the last user with this role
    const users = await prisma.user.findMany({
      where: { role: user.role },
    });
    if (users.length === 1) {
      return res
        .status(400)
        .json({ message: `Impossible de supprimer le dernier ${user.role}.` });
    }
    // delete user
    await prisma.user.delete({
      where: { id: parseInt(id) },
    });

    res.json(user);
  }),
);

router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    const { id } = req.params;
    const { password } = req.body;
    const hashedPassword = await hashPassword(password);
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { password: hashedPassword },
    });
    res.json(updatedUser);
  }),
);

router.put(
  '/users',
  asyncHandler(async (req, res) => {
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    const { username, password, role } = req.body;
    const hashedPassword = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: { username, password: hashedPassword, role },
    });
    res.json(newUser);
  }),
);

router.get(
  '/auth/google/url',
  asyncHandler(async (req, res) => {
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Non autorisé' });
    }

    if (isAuthenticated()) {
      return res.status(200).json({ message: 'Déjà authentifié' });
    }

    const url = getAuthUrl();

    res.status(200).json({ url });
  }),
);

router.get(
  '/auth/google/is-authenticated',
  asyncHandler(async (req, res) => {
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Non autorisé' });
    }

    res.status(200).json({ isAuthenticated: isAuthenticated() });
  }),
);

module.exports = router;
