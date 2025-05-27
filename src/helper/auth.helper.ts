import bcrypt from 'bcrypt';
import e from 'express';
import { PrismaClient, Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;

const saltRounds = 10;

export const generatePassword = (length: number = 10): string => {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+[]{}|;:,.<>?';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, saltRounds);
};

export async function doLogin(
  req: e.Request,
  res: e.Response,
  role: Role,
  key: string,
  prisma: PrismaClient,
) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: 'Veuillez remplir tous les champs.' });
  }

  // Find user by username
  const user = await prisma.user.findUnique({
    where: { username, role: { in: [role, 'ADMIN'] } },
  });

  if (!user) {
    return res.status(404).json({ message: 'Utilisateur non trouvé.' });
  }

  // Compare the password
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return res.status(401).json({ message: 'Mot de passe incorrect.' });
  }

  const keyToUse = user.role === 'ADMIN' ? ADMIN_SECRET_KEY! : key;

  const token = jwt.sign(user, keyToUse, {
    expiresIn: '1d',
  });
  const expiresAt = Date.now() + 1 * 24 * 60 * 60 * 1000;

  res.json({
    authentificated: true,
    token,
    expiresAt,
    isAdmin: user.role === 'ADMIN',
  });
}
