const request = require('supertest');
const app = require('../service');
const { DB, Role } = require('../database/database');

function randomEmail() {
  return `${Math.random().toString(36).substring(2, 12)}@test.com`;
}

let user = {};
let admin = {};
let userToken = '';
let adminToken = '';
let userId;
let adminId;

beforeEach(async () => {
  user = {
    name: 'Test User',
    email: randomEmail(),
    password: 'testpass123',
  };
  admin = {
    name: 'Admin User',
    email: randomEmail(),
    password: 'adminpass123',
  };

  // Create normal user
  await request(app).post('/api/auth').send(user);
  const userRes = await request(app)
    .put('/api/auth')
    .send({ email: user.email, password: user.password });
  userToken = userRes.body.token;
  userId = userRes.body.user.id;

  // Create admin user
  await DB.addUser({
    name: admin.name,
    email: admin.email,
    password: admin.password,
    roles: [{ role: Role.Admin }],
  });
  const adminRes = await request(app)
    .put('/api/auth')
    .send({ email: admin.email, password: admin.password });
  adminToken = adminRes.body.token;
  adminId = adminRes.body.user.id;
});

describe('User Router Tests', () => {
  /* -------------------- GET /api/user/me -------------------- */
  test('GET /api/user/me returns authenticated user', async () => {
    const res = await request(app)
      .get('/api/user/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', userId);
    expect(res.body).toHaveProperty('email', user.email);
  });

  test('GET /api/user/me without token returns 401', async () => {
    const res = await request(app).get('/api/user/me');
    expect(res.status).toBe(401);
  });

  /* -------------------- PUT /api/user/:userId -------------------- */
  test('User can update their own profile', async () => {
    const newName = 'Updated User';
    const res = await request(app)
      .put(`/api/user/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: newName, email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('name', newName);
    expect(res.body).toHaveProperty('token');
  });

  test('Admin can update another user', async () => {
    const newEmail = randomEmail();
    const res = await request(app)
      .put(`/api/user/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: newEmail, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('email', newEmail);
  });

  test('User cannot update another user', async () => {
    const res = await request(app)
      .put(`/api/user/${adminId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Hack Attempt', email: randomEmail() });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('message', 'unauthorized');
  });

  test('PUT /api/user/:id with invalid token returns 401', async () => {
    const res = await request(app)
      .put(`/api/user/${userId}`)
      .set('Authorization', 'Bearer invalid.token.here')
      .send({ name: 'Invalid' });
    expect(res.status).toBe(401);
  });

  /* -------------------- DELETE /api/user/:userId -------------------- */
  test('DELETE /api/user/:userId returns not implemented', async () => {
    const res = await request(app)
      .delete(`/api/user/${userId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'not implemented' });
  });

  test('DELETE /api/user/:userId without auth returns 401', async () => {
    const res = await request(app).delete(`/api/user/${userId}`);
    expect(res.status).toBe(401);
  });

  /* -------------------- GET /api/user/ -------------------- */
  test('GET /api/user/ returns not implemented', async () => {
    const res = await request(app)
      .get('/api/user/')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'not implemented');
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  test('GET /api/user/ without token returns 401', async () => {
    const res = await request(app).get('/api/user/');
    expect(res.status).toBe(401);
  });
});
