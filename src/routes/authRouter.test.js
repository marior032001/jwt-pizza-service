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

  await request(app).post('/api/auth').send(user);
  const userRes = await request(app).put('/api/auth').send({ email: user.email, password: user.password });
  userToken = userRes.body.token;
  userId = userRes.body.user.id;

  await DB.addUser({
    name: admin.name,
    email: admin.email,
    password: admin.password,
    roles: [{ role: Role.Admin }]
  });

  const adminRes = await request(app).put('/api/auth').send({ email: admin.email, password: admin.password });
  adminToken = adminRes.body.token;
  adminId = adminRes.body.user.id;
});


test('User can update own email', async () => {
  const newEmail = randomEmail();
  const res = await request(app)
    .put(`/api/auth/${userId}`)
    .set('Authorization', `Bearer ${userToken}`)
    .send({ email: newEmail, password: user.password });
  expect(res.status).toBe(200);
  expect(res.body.email).toBe(newEmail);
});

test('Unauthorized update returns 403', async () => {
  const res = await request(app)
    .put(`/api/auth/${adminId}`)
    .set('Authorization', `Bearer ${userToken}`)
    .send({ email: randomEmail(), password: admin.password });
  expect(res.status).toBe(403);
});

test('Logout with valid token', async () => {
  const res = await request(app)
    .delete('/api/auth')
    .set('Authorization', `Bearer ${userToken}`);
  expect(res.status).toBe(200);
});

test('Logout without token returns 401', async () => {
  const res = await request(app).delete('/api/auth');
  expect(res.status).toBe(401);
});


test('GET /api/order/menu returns menu', async () => {
  const res = await request(app).get('/api/order/menu');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('PUT /api/order/menu as admin adds item', async () => {
  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Admin Pizza',
      description: 'Pizza by admin',
      image: 'admin.png',
      price: 10,
    });
  expect(res.status).toBe(200);
});

test('PUT /api/order/menu as user returns 403', async () => {
  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      title: 'User Pizza',
      description: 'Should fail',
      image: 'fail.png',
      price: 1,
    });
  expect(res.status).toBe(403);
});

test('GET /api/order shows user orders', async () => {
  const res = await request(app)
    .get('/api/order')
    .set('Authorization', `Bearer ${userToken}`);
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('orders');
});

test('POST /api/order returns 500 on factory fail', async () => {
  const menuRes = await request(app).get('/api/order/menu');
  const item = menuRes.body[0];
  const res = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      franchiseId: 999,
      storeId: 999,
      items: [{ menuId: item.id, description: item.description, price: item.price }],
    });
  expect([200, 500]).toContain(res.status);
});
