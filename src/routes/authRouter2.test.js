const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { authRouter, setAuthUser } = require('./authRouter');
const { DB, Role } = require('../database/database');

jest.mock('../database/database');
jest.mock('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(setAuthUser); // middleware to set req.user
app.use('/api/auth', authRouter);

beforeEach(() => {
  jest.clearAllMocks();
});

// --- Registration tests ---
describe('POST /api/auth', () => {
  test('registers a new user successfully', async () => {
    DB.addUser.mockResolvedValue({ id: 1, name: 'User', email: 'u@test.com', roles: [{ role: Role.Diner }] });
    jwt.sign.mockReturnValue('mock-token');
    DB.loginUser.mockResolvedValue();

    const res = await request(app)
      .post('/api/auth')
      .send({ name: 'User', email: 'u@test.com', password: 'pass' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('mock-token');
    expect(res.body.user).toHaveProperty('id', 1);
  });

  test('fails registration if missing fields', async () => {
    const res = await request(app).post('/api/auth').send({ email: 'a@test.com' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });
});

// --- Login tests ---
describe('PUT /api/auth', () => {
  test('logs in existing user successfully', async () => {
    DB.getUser.mockResolvedValue({ id: 2, email: 'a@test.com', roles: [{ role: Role.Diner }] });
    jwt.sign.mockReturnValue('jwt-token');
    DB.loginUser.mockResolvedValue();

    const res = await request(app)
      .put('/api/auth')
      .send({ email: 'a@test.com', password: 'pass' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('jwt-token');
    expect(res.body.user.id).toBe(2);
  });

  test('fails login with invalid credentials', async () => {
    DB.getUser.mockRejectedValue(new Error('unknown user'));
    const res = await request(app)
      .put('/api/auth')
      .send({ email: 'invalid@test.com', password: 'wrong' });

    expect(res.status).toBe(500); // asyncHandler converts throw to 500
  });
});

// --- Logout tests ---
describe('DELETE /api/auth', () => {
  test('logs out successfully when authorized', async () => {
    DB.logoutUser.mockResolvedValue();
    const token = 'a.b.c';

    const res = await request(app)
      .delete('/api/auth')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('logout successful');
    expect(DB.logoutUser).toHaveBeenCalledWith(token.split('.')[2]);
  });

  test('fails logout when unauthorized', async () => {
    const res = await request(app).delete('/api/auth');
    expect(res.status).toBe(401);
  });
});

// --- Auth middleware tests ---
describe('auth middleware', () => {
  test('sets req.user when token is valid', async () => {
    DB.isLoggedIn.mockResolvedValue(true);
    jwt.verify.mockReturnValue({ id: 1, roles: [{ role: Role.Diner }] });

    const req = { headers: { authorization: 'Bearer a.b.c' } };
    const res = {};
    const next = jest.fn();

    await setAuthUser(req, res, next);

    expect(req.user).toHaveProperty('id', 1);
    expect(req.user.isRole(Role.Diner)).toBe(true);
    expect(next).toHaveBeenCalled();
  });

  test('sets req.user to null if token invalid', async () => {
    DB.isLoggedIn.mockResolvedValue(false);
    const req = { headers: { authorization: 'Bearer invalid' } };
    const res = {};
    const next = jest.fn();

    await setAuthUser(req, res, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  test('authenticateToken returns 401 if no user', () => {
    const req = { user: null };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const next = jest.fn();

    authRouter.authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
